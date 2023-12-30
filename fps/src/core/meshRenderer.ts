import { ModelInstance } from "./modelInstance";
import { Camera } from "./camera/camera";
import { DirectLight } from "./light";
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";
import { MeshRendererUniforms } from "./meshRendererUniforms";

export class MeshRenderer {
    private uniforms: MeshRendererUniforms;
    private pipeline!: GPURenderPipeline;
    private bindingGroup!: GPUBindGroup;
    private shaderModule!: GPUShaderModule;
    private material: BlinnPhongMaterial;

    constructor(
        private instances: ModelInstance[],
        private camera: Camera,
        private device: GPUDevice,
        private canvasFormat: GPUTextureFormat,
        private aaSampleCount: number | undefined,
        private light: DirectLight,
    ) {
        this.material = this.instances[0].asset.material;
        this.uniforms = new MeshRendererUniforms(this.camera, this.instances);
    }

    async initializeAsync() {
        let entity = this.instances[0];
        await entity.asset.load(this.device, true);
        this.shaderModule = this.device.createShaderModule(entity.asset.shader);
        this.pipeline = await this.device.createRenderPipelineAsync(this.createPipelineDesc(entity.asset.vertexBufferLayout, this.shaderModule));

        this.uniforms.writeToGpu(this.device);
        this.light.writeToGpu(this.device);
        this.material.writeToGpu(this.device);

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

    render(renderPass: GPURenderPassEncoder) {
        this.light.writeToGpu(this.device);
        this.uniforms.writeToGpu(this.device);
        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindingGroup);
        renderPass.setVertexBuffer(0, this.instances[0].asset.vertexBuffer);
        renderPass.draw(this.instances[0].asset.vertexCount, this.instances.length, 0, 0);
    }

    private getBindingGroupDesc(pipeline: GPURenderPipeline, sampler: GPUSampler | null, texture: GPUTexture | null): GPUBindGroupDescriptor {

        let desc: GPUBindGroupDescriptor = {
            label: "binding group",
            layout: pipeline.getBindGroupLayout(0),
            entries:
                [
                    {
                        binding: 0,
                        resource: { buffer: this.uniforms.gpuBuffer }
                    },
                    {
                        binding: 1,
                        resource: { buffer: this.light.gpuBuffer }
                    },
                    {
                        binding: 2,
                        resource: { buffer: this.material.gpuBuffer }
                    }
                ]
        };

        if (sampler) {
            (<GPUBindGroupEntry[]>desc.entries).push(
                {
                    binding: 3,
                    resource: sampler,
                }
            );
        }

        if (texture) {
            (<GPUBindGroupEntry[]>desc.entries).push(
                {
                    binding: 4,
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
