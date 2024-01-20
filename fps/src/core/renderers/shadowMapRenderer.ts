import { Mat4, mat4, vec3 } from "wgpu-matrix";
import { createShadowMapBindGroup, createShadowPipelineAsync } from "../pipelines/shadowMapPipeline";
import { Scene } from "../scene";
import { Light } from "../light";
import { InstancesBufferWriter } from "../instancesBufferWriter";
import { ModelInstance } from "../modelInstance";
import { ModelAsset } from "../modelAsset";
import { BoundingBox, calcBBCenter, calcBBUnion, transformBoundingBox } from "../boundingBox";

type RenderGroupKey = ModelAsset;

export type ShadowMapArray = { texture_array: GPUTexture, views: ShadowMap[] }

export class ShadowMap {
    constructor(
        public readonly id: number,
        public readonly size: number,
        public readonly texture: GPUTexture,
        public readonly textureView: GPUTextureView,
        public light_mat: Mat4,
        public readonly light: Light,
        public readonly boundingBox: BoundingBox
    ) { }

    static createAndAssignShadowMap(device: GPUDevice, scene: Scene, size: number = 1024.0): ShadowMapArray {
        let selectedLights = scene.lights.filter(x => x.useShadowMap);
        let views = []
        let boxes = scene.models.map(x => x.getBoundingBox());
        let bb = calcBBUnion(boxes);
        let texture_array = device.createTexture({
            size: [size, size, selectedLights.length],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            format: 'depth32float',
        });

        for (let i = 0; i < selectedLights.length; i++) {
            let light = selectedLights[i];
            light.shadowMap = new ShadowMap(
                0,
                size,
                texture_array,
                texture_array.createView({
                    label: `shadpw map view ${i}`,
                    dimension: "2d",
                    aspect: "all",
                    baseMipLevel: 0,
                    baseArrayLayer: i,
                    arrayLayerCount: 1,
                }),
                mat4.identity(),
                light,
                bb
            );
            views.push(light.shadowMap);
        }
        return { texture_array, views };
    }

    public createViewMat(shadowMap: ShadowMap) {
        // calculating a good spot for the directional light view
        // by using the scenes bounding box
        const bb = shadowMap.boundingBox;
        const bbCenter = calcBBCenter(bb);
        const bbSpan = vec3.distance(bb.min, bb.max);
        const lightDir = vec3.normalize(shadowMap.light.positionOrDirection);
        const lightPos = vec3.addScaled(bbCenter, lightDir, -bbSpan);
        const lightViewMatrix = mat4.lookAt(lightPos, bbCenter, [0, 1, 0]);
        const bb_lightSpace = transformBoundingBox(bb, lightViewMatrix);

        const lightProjectionMatrix = mat4.create();
        {
            const left = bb_lightSpace.min[0];
            const right = bb_lightSpace.max[0];
            const bottom = bb_lightSpace.min[1];
            const top = bb_lightSpace.max[1];
            const near = 0;
            const far = -bb_lightSpace.min[2];
            mat4.ortho(left, right, bottom, top, near, far, lightProjectionMatrix);
        }

        const lightViewProjMatrix = mat4.multiply(
            lightProjectionMatrix,
            lightViewMatrix
        );
        this.light_mat = lightViewProjMatrix;
    }
}

export class ShadowMapRenderer {

    private shadowPipeline!: GPURenderPipeline;
    private instanceBuffers!: InstancesBufferWriter[];
    private lightBuffer: GPUBuffer | null = null;
    ;

    constructor(private device: GPUDevice, private models: ModelInstance[], private shadowMaps: ShadowMap[]) {

    }

    async initializeAsync() {
        this.shadowPipeline = await createShadowPipelineAsync(this.device);
        this.instanceBuffers = [...this.groupByAsset(this.models).values()].map(x => new InstancesBufferWriter(x));
        this.instanceBuffers.forEach(x => {
            x.writeToGpu(this.device);
        });
        this.writeToGpu()
    }

    render(encoder: GPUCommandEncoder) {

        for (let i = 0; i < this.shadowMaps.length; i++) {
            this.writeToGpu()
            const desc: GPURenderPassDescriptor = {
                colorAttachments: [],
                depthStencilAttachment: {
                    view: this.shadowMaps[i].textureView,
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store',
                },
            };
            for (let b of this.instanceBuffers) {
                b.writeToGpu(this.device);
                const asset = b.instances[0].asset;
                const count = b.instances.length;
                const pass = encoder.beginRenderPass(desc);
                pass.setPipeline(this.shadowPipeline);
                pass.setBindGroup(0, createShadowMapBindGroup(this.device, this.shadowPipeline, b.gpuBuffer, this.getBuffer()));
                pass.setVertexBuffer(0, asset.vertexBuffer);
                pass.draw(asset.vertexCount, count);
                pass.end();
                desc.depthStencilAttachment!.depthLoadOp = "load";
            }
        }
    }

    getBuffer(): GPUBuffer {
        if (!this.lightBuffer)
            throw new Error("Buffer not initialzed");
        return this.lightBuffer;
    }
    groupByAsset(instances: ModelInstance[]): Map<RenderGroupKey, ModelInstance[]> {
        const getKey = (x: ModelInstance) => {
            return x.asset;
        };
        let groups: Map<RenderGroupKey, ModelInstance[]> = instances.reduce((acc, m) => {
            let key = getKey(m);
            if (!acc.has(key))
                acc.set(key, []);
            acc.get(key)?.push(m);
            return acc;
        }, new Map<RenderGroupKey, ModelInstance[]>());

        return groups;
    }

    private writeToGpu() {
        if (!this.lightBuffer) {
            this.lightBuffer = this.device.createBuffer({
                label: `light view buffer`,
                size: 64 * this.shadowMaps.length,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            for (let i = 0; i < this.shadowMaps.length; i++) {
                let map = this.shadowMaps[i];
                map.createViewMat(map);
                this.device.queue.writeBuffer(this.lightBuffer, i * 64, map.light_mat as Float32Array);
            }
        }
    }
}