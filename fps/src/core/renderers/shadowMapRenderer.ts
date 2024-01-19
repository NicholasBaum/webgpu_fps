import { Mat4, mat4, vec3 } from "wgpu-matrix";
import { createShadowMapBindGroup, createShadowPipelineAsync } from "../pipelines/shadowMapPipeline";
import { Scene } from "../scene";
import { Light } from "../light";
import { InstancesBufferWriter } from "../instancesBufferWriter";
import { ModelInstance } from "../modelInstance";
import { ModelAsset } from "../modelAsset";
import { BoundingBox, calcBBCenter, calcBBRadius, calcBBUnion, transformBoundingBox } from "../boundingBox";

type RenderGroupKey = ModelAsset;

export class ShadowMap {

    static create(device: GPUDevice, size: number, light: Light, scene: Scene): ShadowMap {

        let boxes = scene.models.map(x => x.getBoundingBox());
        let bb = calcBBUnion(boxes);

        return new ShadowMap(0, size,
            device.createTexture({
                size: [size, size, 1],
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                format: 'depth32float',
            }),
            mat4.identity(),
            light,
            bb,
        )
    }

    constructor(
        public id: number,
        public size: number,
        public texture: GPUTexture,
        public light_mat: Mat4,
        public light: Light,
        public boundingBox: BoundingBox
    ) { }
}

export class ShadowMapRenderer {

    private shadowMap: ShadowMap | null = null;
    private shadowPipeline!: GPURenderPipeline;
    private instanceBuffers!: InstancesBufferWriter[];

    constructor(private device: GPUDevice, private scene: Scene) {
        this.shadowMap = this.scene.lights[0].shadowMap;
    }

    async initializeAsync() {
        this.shadowPipeline = await createShadowPipelineAsync(this.device);
        this.instanceBuffers = [...this.groupByAsset(this.scene.models).values()].map(x => new InstancesBufferWriter(x));
        this.instanceBuffers.forEach(x => {
            x.writeToGpu(this.device);
        });
        this.writeToGpu()
    }

    render(encoder: GPUCommandEncoder) {
        if (!this.shadowMap)
            return;
        this.writeToGpu()
        const desc: GPURenderPassDescriptor = {
            colorAttachments: [],
            depthStencilAttachment: {
                view: this.shadowMap.texture.createView(),
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
            pass.setBindGroup(0, createShadowMapBindGroup(this.device, this.shadowPipeline, b.gpuBuffer, this.lightBuffer!));
            pass.setVertexBuffer(0, asset.vertexBuffer);
            pass.draw(asset.vertexCount, count);
            pass.end();
            desc.depthStencilAttachment!.depthLoadOp = "load";
        }
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

    private lightBuffer: GPUBuffer | null = null;
    private writeToGpu() {
        if (!this.lightBuffer && this.shadowMap) {
            this.lightBuffer = this.device.createBuffer({ label: "light view buffer", size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

            // calculating a good spot for the directional light view
            // by using the scenes bounding box
            const bb = this.shadowMap.boundingBox;
            const bbCenter = calcBBCenter(bb);
            const bbSpan = vec3.distance(bb.min, bb.max);
            const lightDir = vec3.normalize(this.shadowMap.light.positionOrDirection);
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
            this.shadowMap.light_mat = lightViewProjMatrix;
            this.device.queue.writeBuffer(this.lightBuffer, 0, this.shadowMap.light_mat as Float32Array);
        }
    }
}