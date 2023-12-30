import { Mat4, mat4, vec4 } from "wgpu-matrix";
import { ModelInstance } from "./modelInstance";
import { Camera } from "./camera/camera";
import { DirectLight } from "./light";
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";

export class MeshRenderer {
    private uniformBuffer!: GPUBuffer;
    private pipeline!: GPURenderPipeline;
    private bindingGroup!: GPUBindGroup;
    private shaderModule!: GPUShaderModule;
    private viewProjectionMatrix: Mat4 = mat4.identity();
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
    }

    async initializeAsync() {
        //allocate model and normal mats
        this.uniformBuffer = this.device.createBuffer(this.getUniformsDesc(64 + 16 + this.instances.length * 64 * 2));
        let entity = this.instances[0];
        await entity.asset.load(this.device, true);
        this.shaderModule = this.device.createShaderModule(entity.asset.shader);
        this.pipeline = await this.device.createRenderPipelineAsync(this.createPipelineDesc(entity.asset.vertexBufferLayout, this.shaderModule));

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

    private getUniformsDesc(size: number): GPUBufferDescriptor {
        return {
            label: "entity data buffer",
            size: size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        }
    }

    render(renderPass: GPURenderPassEncoder) {
        this.light.writeToGpu(this.device);
        this.updateTransforms();
        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindingGroup);
        renderPass.setVertexBuffer(0, this.instances[0].asset.vertexBuffer);
        renderPass.draw(this.instances[0].asset.vertexCount, this.instances.length, 0, 0);
    }

    private updateTransforms() {
        mat4.multiply(this.camera.projectionMatrix, this.camera.view, this.viewProjectionMatrix);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, this.viewProjectionMatrix as Float32Array);
        this.device.queue.writeBuffer(this.uniformBuffer, 64, this.camera.position as Float32Array);
        for (let i = 0; i < this.instances.length; i++) {
            let modelMatrix = this.instances[i].transform;
            let normalMatrix = mat4.transpose(mat4.invert(this.instances[i].transform));
            this.device.queue.writeBuffer(this.uniformBuffer, 64 + 16 + i * 128, modelMatrix as Float32Array);
            this.device.queue.writeBuffer(this.uniformBuffer, 64 + 16 + i * 128 + 64, normalMatrix as Float32Array);
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
