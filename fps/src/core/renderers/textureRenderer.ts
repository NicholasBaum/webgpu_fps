import { createSampler } from '../pipelineBuilder';

export class TextureRenderer {

    protected fullScreenQuadVertexBuffer: GPUBuffer;
    protected pipeline: GPURenderPipeline;
    protected sampler: GPUSampler;

    constructor(
        protected device: GPUDevice,
        protected canvasFormat: GPUTextureFormat,
        protected aaSampleCount: number,
        protected canvasWidth: number,
        protected canvasHeight: number
    ) {
        const vertices = new Float32Array([
            -1.0, -1.0, 0.0, 1.0,
            1.0, -1.0, 0.0, 1.0,
            -1.0, 1.0, 0.0, 1.0,
            -1.0, 1.0, 0.0, 1.0,
            1.0, -1.0, 0.0, 1.0,
            1.0, 1.0, 0.0, 1.0,
        ]);

        this.fullScreenQuadVertexBuffer = device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.fullScreenQuadVertexBuffer, 0, vertices as Float32Array)
        this.pipeline = this.createPipeline(device);
        this.sampler = createSampler(device);
    }

    render(textureView: GPUTextureView, pass: GPURenderPassEncoder) {
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.createBindGroup(textureView));
        pass.setVertexBuffer(0, this.fullScreenQuadVertexBuffer);
        pass.draw(6, 1);
    }

    protected createBindGroup(textureView: GPUTextureView) {
        let desc: { label: string, layout: GPUBindGroupLayout, entries: GPUBindGroupEntry[] } = {
            label: "texture renderer binding group",
            layout: this.pipeline.getBindGroupLayout(0),
            entries:
                [
                    {
                        binding: 0,
                        resource: textureView,
                    },
                    {
                        binding: 1,
                        resource: this.sampler,
                    }
                ]
        };

        return this.device.createBindGroup(desc);
    }

    protected getBindGroupLayoutEntries(): GPUBindGroupLayoutEntry[] {
        return [
            {
                binding: 0, // texture
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'float',
                    //viewDimension: '2d',
                    //multisampled: false,
                }
            },
            {
                binding: 1, // sampler
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {}
            },
        ];
    }

    private createPipeline(device: GPUDevice): GPURenderPipeline {
        let entries = this.getBindGroupLayoutEntries();
        let bindingGroupDef = device.createBindGroupLayout({ entries: entries });
        let pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindingGroupDef] });

        const shaderModule = device.createShaderModule({ label: "Texture Renderer", code: this.getShader() });
        const pipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain',
                buffers: [this.VERTEX_BUFFER_LAYOUT],
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragmentMain',
                targets: [{
                    format: this.canvasFormat,
                }],
                constants: {
                    canvasWidth: this.canvasWidth,
                    canvasHeight: this.canvasHeight,
                }
            },
            primitive: {
                topology: 'triangle-list',
            },
            multisample: { count: this.aaSampleCount },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: false,
                depthCompare: 'always',
            },
        });

        return pipeline;
    }

    private VERTEX_BUFFER_LAYOUT: GPUVertexBufferLayout = {
        arrayStride: 16,
        attributes: [
            {
                format: "float32x4",
                offset: 0,
                shaderLocation: 0,
            },
        ]
    };

    protected getShader() {
        return SHADER;
    }
}

const SHADER = `
override canvasWidth : f32 = 1920.0;
override canvasHeight : f32 = 1080.0;

@group(0) @binding(0) var texture : texture_2d<f32>;
@group(0) @binding(1) var textureSampler : sampler;

@vertex
fn vertexMain(@location(0) position : vec4f) -> @builtin(position) vec4f {
    return position;
}

@fragment
fn fragmentMain(@builtin(position) fragCoord : vec4f)
-> @location(0) vec4f {
    let dummy  = canvasWidth*canvasHeight;    
    return textureSample(texture, textureSampler, fragCoord.xy  / vec2<f32>(canvasWidth, canvasHeight));
}
`;