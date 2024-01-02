import { ModelInstance } from "./modelInstance";
import { Camera } from "./camera/camera";
import { DirectLight, LightsArray } from "./light";
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";
import { MeshRendererUniforms } from "./meshRendererUniforms";

import shader from '../shaders/blinn_phong_shader.wgsl'

export class MeshRenderer {

    private pipeline!: GPURenderPipeline;
    private bindingGroup!: GPUBindGroup;
    private shaderModule!: GPUShaderModule;
    private sampler!: GPUSampler;

    private uniforms: MeshRendererUniforms;
    private material: BlinnPhongMaterial;
    private refEntity: ModelInstance;


    constructor(
        private instances: ModelInstance[],
        private camera: Camera,
        private device: GPUDevice,
        private canvasFormat: GPUTextureFormat,
        private aaSampleCount: number | undefined,
        private lights: LightsArray,
    ) {
        this.refEntity = this.instances[0];
        this.material = this.refEntity.asset.material;
        this.uniforms = new MeshRendererUniforms(this.camera, this.instances);
    }

    async initializeAsync() {
        this.refEntity.asset.writeMeshToGpu(this.device);
        this.uniforms.writeToGpu(this.device);
        this.lights.writeToGpu(this.device);
        this.material.writeToGpu(this.device);
        await this.material.writeTextureToGpuAsync(this.device, true);
        this.shaderModule = this.device.createShaderModule({ label: "Blinn Phong Shader", code: shader });
        this.sampler = this.createSampler();

        // creates a bindgroup layout basically describing all the binding defined in the shader
        // then adds that to a pipeline defintion
        this.pipeline = await this.createPipeline();
        // this actually sets the resources defined in the bindgroups
        this.bindingGroup = this.createBindGroup();
    }


    render(renderPass: GPURenderPassEncoder) {
        this.lights.writeToGpu(this.device);
        this.uniforms.writeToGpu(this.device);
        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindingGroup);
        renderPass.setVertexBuffer(0, this.instances[0].asset.vertexBuffer);
        renderPass.draw(this.instances[0].asset.vertexCount, this.instances.length, 0, 0);
    }

    private createSampler() {
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
        return this.device.createSampler(samplerDescriptor);
    }

    private createBindGroup(): GPUBindGroup {

        let desc = {
            label: "binding group",
            layout: this.pipeline.getBindGroupLayout(0),
            entries:
                [
                    {
                        binding: 0,
                        resource: { buffer: this.uniforms.gpuBuffer }
                    },
                    {
                        binding: 1,
                        resource: { buffer: this.lights.gpuBuffer }
                    },
                    {
                        binding: 2,
                        resource: { buffer: this.material.gpuBuffer }
                    },
                    {
                        binding: 3,
                        resource: this.sampler,
                    },
                    {
                        binding: 4,
                        resource: this.material.diffuseTexture.createView(),
                    }
                ]
        };

        return this.device.createBindGroup(desc);
    }

    private async createPipeline(): Promise<GPURenderPipeline> {

        let entries: GPUBindGroupLayoutEntry[] = [
            {
                binding: 0, // uniforms
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: "read-only-storage" }
            },
            {
                binding: 1, // light
                visibility: GPUShaderStage.FRAGMENT,
                buffer: { type: "read-only-storage" }
            },
            {
                binding: 2, // material
                visibility: GPUShaderStage.FRAGMENT,
                buffer: { type: "uniform" }
            },
            {
                binding: 3, // sampler
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {}
            },
            {
                binding: 4, // texture
                visibility: GPUShaderStage.FRAGMENT,
                texture: {}
            },
        ];

        let bindingGroupDef = this.device.createBindGroupLayout({ entries: entries });
        let pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindingGroupDef] });

        let pieplineDesc: GPURenderPipelineDescriptor = {
            label: "mesh pipeline",
            layout: pipelineLayout,
            vertex: {
                module: this.shaderModule,
                entryPoint: "vertexMain",
                buffers: [this.refEntity.asset.vertexBufferLayout]
            },
            fragment: {
                module: this.shaderModule,
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

        return await this.device.createRenderPipelineAsync(pieplineDesc);
    }
}
