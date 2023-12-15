import { Mat4, mat4 } from "wgpu-matrix";
import { ModelInstance } from "./modelInstance";
import { Camera } from "./camera/camera";

export class MeshRenderer {
    private uniformBuffer!: GPUBuffer;
    private pipeline!: GPURenderPipeline;
    private bindingGroup!: GPUBindGroup;
    private shaderModule!: GPUShaderModule;
    private viewProjectionMatrix: Mat4 = mat4.identity();

    constructor(
        private instances: ModelInstance[],
        private camera: Camera,
        private device: GPUDevice,
        private canvasFormat: GPUTextureFormat,
        private aaSampleCount: number | undefined,
    ) { }

    async initializeAsync() {
        this.uniformBuffer = this.device.createBuffer(this.getUniformsDesc(this.instances.length * 64));
        let entity = this.instances[0];
        await entity.asset.load(this.device, true);
        this.shaderModule = this.device.createShaderModule(entity.asset.shader);
        this.pipeline = await this.device.createRenderPipelineAsync(this.createPipelineDesc(entity.asset.vertexBufferLayout, this.shaderModule));

        const samplerDescriptor: GPUSamplerDescriptor = {
            addressModeU: 'repeat',
            addressModeV: 'repeat',
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
            lodMinClamp: 0,
            lodMaxClamp: 4,
            maxAnisotropy: 16,
        };
        const sampler = this.device.createSampler(samplerDescriptor);
        this.bindingGroup = this.device.createBindGroup(this.getBindingGroupDesc(this.pipeline, entity.asset.texture ? sampler : null, entity.asset.texture));
    }

    private getUniformsDesc(size: number): GPUBufferDescriptor {
        return {
            label: "entity data buffer",
            size: size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        }
    }

    render(renderPass: GPURenderPassEncoder) {
        this.updateTransforms();
        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindingGroup);
        renderPass.setVertexBuffer(0, this.instances[0].asset.vertexBuffer);
        renderPass.draw(this.instances[0].asset.vertexCount, this.instances.length, 0, 0);
    }

    private updateTransforms() {
        mat4.multiply(this.camera.projectionMatrix, this.camera.view, this.viewProjectionMatrix);
        for (let i = 0; i < this.instances.length; i++) {
            let modelMatrix = this.instances[i].transform;
            let modelViewProjecitonMatrix = mat4.multiply(this.viewProjectionMatrix, modelMatrix);
            this.device.queue.writeBuffer(this.uniformBuffer, i * 64, modelViewProjecitonMatrix as Float32Array);
        }
    }

    private getBindingGroupDesc(pipeline: GPURenderPipeline, sampler: GPUSampler | null, texture: GPUTexture | null): GPUBindGroupDescriptor {

        let desc: GPUBindGroupDescriptor = {
            label: "binding group",
            layout: pipeline.getBindGroupLayout(0),
            entries:
                [
                    {
                        binding: 0,
                        resource: { buffer: this.uniformBuffer }
                    }
                ]
        };

        if (sampler) {
            (<GPUBindGroupEntry[]>desc.entries).push(
                {
                    binding: 1,
                    resource: sampler,
                }
            );
        }

        if (texture) {
            (<GPUBindGroupEntry[]>desc.entries).push(
                {
                    binding: 2,
                    resource: texture.createView(),
                }
            );
        }
        return desc;
    }

    private createPipelineDesc(vertexBufferLayout: GPUVertexBufferLayout, shaderModule: GPUShaderModule): GPURenderPipelineDescriptor {
        return {
            label: "mesh pipeline",
            layout: "auto",
            vertex: {
                module: shaderModule,
                entryPoint: "vertexMain",
                buffers: [vertexBufferLayout]
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fragmentMain",
                targets: [{
                    format: this.canvasFormat,
                    blend: {
                        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                        alpha: {}
                    }
                }]
            },
            primitive: {
                topology: "triangle-list",
                cullMode: 'back',
            },
            multisample: this.aaSampleCount ? { count: this.aaSampleCount, } : undefined,
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        };
    }
}
