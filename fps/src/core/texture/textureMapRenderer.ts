export function renderTextureMap(device: GPUDevice, texture: GPUTextureView, renderPass: GPURenderPassEncoder,
    settings: { width: number, height: number, format: GPUTextureFormat, aaSampleCount: number }) {

    const renderer = new TextureMapRenderer(device, settings.width, settings.height, settings.format, settings.aaSampleCount)
    renderer.render(texture, renderPass);
}

export class TextureMapRenderer {

    protected vertexBuffer!: GPUBuffer;
    protected vertexBufferLayout!: GPUVertexBufferLayout
    protected pipeline: GPURenderPipeline;
    protected sampler: GPUSampler;
    protected label: string = 'TextureMapRenderer';
    protected sampleType: GPUTextureSampleType = 'float';
    protected viewDimension: GPUTextureViewDimension = '2d';
    protected shader: string = SHADER;

    constructor(
        protected device: GPUDevice,
        protected canvasWidth: number,
        protected canvasHeight: number,
        protected canvasFormat: GPUTextureFormat,
        protected aaSampleCount: number,
        mapSettings?: { label?: string, sampleType?: GPUTextureSampleType, viewDimension?: GPUTextureViewDimension, shader?: string }
    ) {
        this.label = mapSettings?.label ?? this.label;
        this.sampleType = mapSettings?.sampleType ?? this.sampleType;
        this.viewDimension = mapSettings?.viewDimension ?? this.viewDimension;
        this.shader = mapSettings?.shader ?? this.shader;
        this.writeVertexData();
        this.pipeline = this.createPipeline(device);
        this.sampler = device.createSampler({
            addressModeU: 'repeat',
            addressModeV: 'repeat',
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
            lodMinClamp: 0,
            lodMaxClamp: 4,
            maxAnisotropy: 16,
        });
    }

    render(texture: GPUTextureView, pass: GPURenderPassEncoder) {
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.createBindGroup(texture));
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.draw(6, 1);
    }

    protected writeVertexData() {

        const vertices = new Float32Array([
            -1.0, -1.0, 0.0, 1.0,
            1.0, -1.0, 0.0, 1.0,
            -1.0, 1.0, 0.0, 1.0,
            -1.0, 1.0, 0.0, 1.0,
            1.0, -1.0, 0.0, 1.0,
            1.0, 1.0, 0.0, 1.0,
        ]);

        this.vertexBufferLayout = {
            arrayStride: 16,
            attributes: [
                {
                    format: "float32x4",
                    offset: 0,
                    shaderLocation: 0,
                },
            ]
        };

        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices as Float32Array)
    }

    protected getBindGroupLayoutDesc(): GPUBindGroupLayoutDescriptor {
        return {
            entries:
                [
                    {
                        binding: 0, // texture
                        visibility: GPUShaderStage.FRAGMENT,
                        texture: { sampleType: this.sampleType, viewDimension: this.viewDimension }
                    },
                    {
                        binding: 1, // sampler
                        visibility: GPUShaderStage.FRAGMENT,
                        sampler: {}
                    },
                ]
        }
    }

    private createPipeline(device: GPUDevice): GPURenderPipeline {
        let bindGroupLayout = device.createBindGroupLayout(this.getBindGroupLayoutDesc());
        let pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

        const shaderModule = device.createShaderModule({ label: this.label, code: this.shader });
        const pipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain',
                buffers: [this.vertexBufferLayout],
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

    protected createBindGroup(textureView: GPUTextureView) {
        let desc: { label: string, layout: GPUBindGroupLayout, entries: GPUBindGroupEntry[] } = {
            label: `${this.label} binding group`,
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
    return textureSample(texture, textureSampler, fragCoord.xy  / vec2<f32>(canvasWidth, canvasHeight));
}
`;