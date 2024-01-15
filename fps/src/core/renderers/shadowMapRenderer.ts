import { Mat4, mat4, vec3 } from "wgpu-matrix";
import { createShadowMapBindGroup, createShadowPipelineAsync } from "../pipelines/shadowMapPipeline";
import { Scene } from "../scene";
import { Light } from "../light";
import { InstancesBufferWriter } from "../instancesBufferWriter";

export class ShadowMap {

    static create(device: GPUDevice, size: number, light: Light): ShadowMap {
        return new ShadowMap(0, size, device.createTexture({
            size: [size, size, 1],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            format: 'depth32float',
        }), mat4.identity(), light)
    }

    constructor(
        public id: number,
        public size: number,
        public texture: GPUTexture,
        public light_mat: Mat4,
        public light: Light
    ) { }
}

export class ShadowMapRenderer {

    private shadowMap: ShadowMap | null = null;
    private shadowPipeline!: GPURenderPipeline;
    private instances!: InstancesBufferWriter;

    constructor(private device: GPUDevice, private scene: Scene) {
        this.shadowMap = this.scene.lights[0].shadowMap;
    }

    async initializeAsync() {
        this.shadowPipeline = await createShadowPipelineAsync(this.device);
        this.instances = new InstancesBufferWriter(this.scene.models);
        this.instances.writeToGpu(this.device);
        this.writeToGpu()
    }

    render(encoder: GPUCommandEncoder) {
        if (!this.shadowMap)
            return;
        this.instances.writeToGpu(this.device);
        const asset = this.scene.models[0].asset;
        const count = this.scene.models.length;
        const desc: GPURenderPassDescriptor = {
            colorAttachments: [],
            depthStencilAttachment: {
                view: this.shadowMap.texture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        };
        const pass = encoder.beginRenderPass(desc);
        pass.setPipeline(this.shadowPipeline);
        this.writeToGpu()
        pass.setBindGroup(0, createShadowMapBindGroup(this.device, this.shadowPipeline, this.instances.gpuBuffer, this.lightBuffer!));
        pass.setVertexBuffer(0, asset.vertexBuffer);
        pass.draw(asset.vertexCount, count);
        pass.end();
    }

    private lightBuffer: GPUBuffer | null = null;
    private writeToGpu() {
        if (!this.lightBuffer && this.shadowMap) {
            this.lightBuffer = this.device.createBuffer({ label: "light buffer", size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            const upVector = vec3.fromValues(0, 1, 0);
            const origin = vec3.fromValues(0, 0, 0);
            const lightViewMatrix = mat4.lookAt(this.shadowMap.light.positionOrDirection, origin, upVector);
            const lightProjectionMatrix = mat4.create();
            {
                const left = -80;
                const right = 80;
                const bottom = -80;
                const top = 80;
                const near = -200;
                const far = 350;
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