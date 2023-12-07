import { Mat4, mat4 } from "wgpu-matrix";
import { ModelInstance } from "./modelInstance";
import { Camera } from "./camera/camera";
import { InputHandler } from "./input";

export class MeshRenderer {
    private uniformBuffer!: GPUBuffer;
    private pipeline!: GPURenderPipeline;
    private bindingGroup!: GPUBindGroup;
    private shaderModule!: GPUShaderModule;
    private viewProjectionMatrix: Mat4 = mat4.identity();

    constructor(
        private instances: ModelInstance[],
        private device: GPUDevice,
        private aaSampleCount: number | undefined,
        private width: number,
        private height: number,
        private canvasFormat: GPUTextureFormat,
        public camera: Camera,
        public inputHandler: InputHandler
    ) { }

    async initializeAsync() {
        this.uniformBuffer = this.device.createBuffer(this.getUniformsDesc(this.instances.length * 64));
        let entity = this.instances[0];
        await entity.asset.load(this.device, true);
        this.shaderModule = this.device.createShaderModule(entity.asset.shader);
        this.pipeline = await this.device.createRenderPipelineAsync(this.createCubePipelineDesc(entity.asset.vertexBufferLayout, this.shaderModule));

        const samplerDescriptor: GPUSamplerDescriptor = {
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
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

    render(deltaTime: number, renderPass: GPURenderPassEncoder) {
        this.updateTransforms(deltaTime);
        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindingGroup);
        renderPass.setVertexBuffer(0, this.instances[0].asset.vertexBuffer);
        renderPass.draw(this.instances[0].asset.vertexCount, this.instances.length, 0, 0);
    }

    protected updateTransforms(deltaTime: number) {
        const vp = this.getViewProjectionMatrix(deltaTime);
        for (let i = 0; i < this.instances.length; i++) {
            let modelMatrix = this.instances[i].transform;
            let modelViewProjecitonMatrix = mat4.multiply(vp, modelMatrix);
            this.device.queue.writeBuffer(this.uniformBuffer, i * 64, modelViewProjecitonMatrix as Float32Array);
        }
    }

    getViewProjectionMatrix(deltaTime: number) {
        const aspect = this.width / this.height;
        // matrix applying perspective distortion
        const projectionMatrix = mat4.perspective(
            (2 * Math.PI) / 5,
            aspect,
            1,
            100.0
        );
        // projection and view matrix are split because lightning calculation need to be done post view 
        mat4.multiply(projectionMatrix, this.camera.view, this.viewProjectionMatrix);
        return this.viewProjectionMatrix as Float32Array;
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

    private createCubePipelineDesc(vertexBufferLayout: GPUVertexBufferLayout, shaderModule: GPUShaderModule): GPURenderPipelineDescriptor {
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
