import shader from '../../shaders/texture_renderer.wgsl'

export class TextureRenderer {

    private fullScreenQuadVertexBuffer: GPUBuffer;
    private pipeline: GPURenderPipeline;

    constructor(
        private device: GPUDevice,
        private canvasFormat: GPUTextureFormat,
        private aaSampleCount: number,
        private shadowMapSize: number,
        private screenWidth: number,
        private screenHeight: number
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
    }

    render(textureView: GPUTextureView, pass: GPURenderPassEncoder) {
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.createBindGroup(textureView));
        pass.setVertexBuffer(0, this.fullScreenQuadVertexBuffer);
        pass.draw(6, 1);
    }

    private createBindGroup(textureView: GPUTextureView) {
        let desc: { label: string, layout: GPUBindGroupLayout, entries: GPUBindGroupEntry[] } = {
            label: "texture renderer binding group",
            layout: this.pipeline.getBindGroupLayout(0),
            entries:
                [
                    {
                        binding: 0,
                        resource: textureView,
                    },
                ]
        };

        return this.device.createBindGroup(desc);
    }

    private createPipeline(device: GPUDevice): GPURenderPipeline {
        let entries: GPUBindGroupLayoutEntry[] = [
            {
                binding: 0, // texture
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'depth',
                    //viewDimension: '2d',
                    //multisampled: false,
                }
            },
        ];

        let bindingGroupDef = device.createBindGroupLayout({ entries: entries });
        let pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindingGroupDef] });

        const shaderModule = device.createShaderModule({ label: "texture renderer", code: shader });
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
                    shadowMapSize: this.shadowMapSize,
                    screenWidth: this.screenWidth,
                    screenHeight: this.screenHeight,
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
}