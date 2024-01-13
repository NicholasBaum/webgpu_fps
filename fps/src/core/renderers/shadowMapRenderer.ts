import { mat4, vec3 } from "wgpu-matrix";
import { ModelInstance } from "../modelInstance";
import { createShadowMapBindGroup, createShadowPipelineAsync } from "../pipelines/shadowMapPipeline";
import { Scene } from "../scene";
import { Light } from "../light";

export class ShadowMapRenderer {

    private shadowDepthTextureSize = 1024;
    shadowDepthTextureView!: GPUTextureView;
    private shadowPipeline!: GPURenderPipeline;
    private _gpuBuffer!: GPUBuffer;


    constructor(private device: GPUDevice, private scene: Scene) {

    }

    async initializeAsync() {
        this.shadowPipeline = await createShadowPipelineAsync(this.device);

        this.writeToGpu(this.device, this.scene.models[0]);
        const shadowDepthTexture = this.device.createTexture({
            size: [this.shadowDepthTextureSize, this.shadowDepthTextureSize, 1],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            format: 'depth32float',
        });
        this.shadowDepthTextureView = shadowDepthTexture.createView();
    }

    render(encoder: GPUCommandEncoder) {
        this.writeToGpu(this.device, this.scene.models[0]);
        const model = this.scene.models[0];
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
        pass.setBindGroup(0, createShadowMapBindGroup(this.device, this.shadowPipeline, this._gpuBuffer, this.getLightViewMatrix(light)));
        pass.setVertexBuffer(0, model.asset.vertexBuffer);
        pass.draw(36, 2)
        pass.end();
    }

    private writeToGpu(device: GPUDevice, model: ModelInstance) {

        if (!this._gpuBuffer) {
            this._gpuBuffer = device.createBuffer({
                label: "shadow models uniforms buffer",
                //  [model_mat, normal_mat]
                size: 128,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
        }

        let modelMatrix = model.transform;
        let normalMatrix = mat4.transpose(mat4.invert(model.transform));
        device.queue.writeBuffer(this._gpuBuffer, 0, modelMatrix as Float32Array);
        device.queue.writeBuffer(this._gpuBuffer, 64, normalMatrix as Float32Array);
    }

    private lightBuffer: GPUBuffer | null = null;
    private getLightViewMatrix(light: Light): GPUBuffer {
        if (!this.lightBuffer) {
            this.lightBuffer = this.device.createBuffer({ label: "light buffer", size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            const upVector = vec3.fromValues(0, 1, 0);
            const origin = vec3.fromValues(0, 0, 0);
            const lightViewMatrix = mat4.lookAt(vec3.mulScalar(light.positionOrDirection, -1), origin, upVector);
            const lightProjectionMatrix = mat4.create();
            {
                const left = -80;
                const right = 80;
                const bottom = -80;
                const top = 80;
                const near = 0;
                const far = 50;
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