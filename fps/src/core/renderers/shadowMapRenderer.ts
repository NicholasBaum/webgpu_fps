import { mat4, vec3 } from "wgpu-matrix";
import { createShadowMapBindGroup, createShadowPipelineAsync } from "../pipelines/shadowMapPipeline";
import { Scene } from "../scene";
import { Light } from "../light";
import { InstancesBufferWriter } from "../instancesBufferWriter";

export class ShadowMapRenderer {

    private shadowDepthTextureSize = 1024;
    shadowDepthTextureView!: GPUTextureView;
    private shadowPipeline!: GPURenderPipeline;
    private instances!: InstancesBufferWriter;


    constructor(private device: GPUDevice, private scene: Scene) {

    }

    async initializeAsync() {
        this.shadowPipeline = await createShadowPipelineAsync(this.device);
        this.instances = new InstancesBufferWriter(this.scene.models);
        this.instances.writeToGpu(this.device);
        const shadowDepthTexture = this.device.createTexture({
            size: [this.shadowDepthTextureSize, this.shadowDepthTextureSize, 1],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            format: 'depth32float',
        });
        this.shadowDepthTextureView = shadowDepthTexture.createView();
    }

    render(encoder: GPUCommandEncoder) {
        this.instances.writeToGpu(this.device);
        const asset = this.scene.models[0].asset;
        const count = this.scene.models.length;
        const light = this.scene.lights[0];
        const desc: GPURenderPassDescriptor = {
            colorAttachments: [],
            depthStencilAttachment: {
                view: this.shadowDepthTextureView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        };
        const pass = encoder.beginRenderPass(desc);
        pass.setPipeline(this.shadowPipeline);
        pass.setBindGroup(0, createShadowMapBindGroup(this.device, this.shadowPipeline, this.instances.gpuBuffer, this.getLightViewMatrix(light)));
        pass.setVertexBuffer(0, asset.vertexBuffer);
        pass.draw(asset.vertexCount, count);
        pass.end();
    }

    private lightBuffer: GPUBuffer | null = null;
    private getLightViewMatrix(light: Light): GPUBuffer {
        if (!this.lightBuffer) {
            this.lightBuffer = this.device.createBuffer({ label: "light buffer", size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            const upVector = vec3.fromValues(0, 1, 0);
            const origin = vec3.fromValues(0, 0, 0);
            const lightViewMatrix = mat4.lookAt(light.positionOrDirection, origin, upVector);
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
            this.device.queue.writeBuffer(this.lightBuffer, 0, lightViewProjMatrix as Float32Array);
        }
        return this.lightBuffer;
    }
}