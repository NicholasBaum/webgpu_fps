import { VertexBufferObject } from "../primitives/vertexBufferObject";
import BindGroupBuilder from "./bindGroupBuilder";

export class NextRenderer {

    private vbos: VertexBufferObject[] = [];
    private bindGroups: BindGroupBuilder[] = [];
    private pipeline: GPURenderPipeline | undefined;
    private SHADER: string;
    private instanceCount: number = 1;

    constructor(shader: string, instanceCount: number = 1, options?: PipeOptions) {
        this.SHADER = shader;
        this.instanceCount = instanceCount;
    }

    async buildAsync(device: GPUDevice) {
        this.pipeline = await createPipeline(device, this.vbos, this.bindGroups, this.SHADER);
    }

    addVertexBuffer(vbo: VertexBufferObject) {
        this.vbos.push(vbo);
    }

    addBindGroup(group: BindGroupBuilder) {
        group.index = this.bindGroups.length;
        this.bindGroups.push(group);
    }

    writeToGpu(device: GPUDevice) {
        this.bindGroups.forEach(x => x.writeToGpu(device));
    }

    render(device: GPUDevice, pass: GPURenderPassEncoder) {
        if (!this.pipeline)
            throw new Error(`Pipeline hasn't been built.`);
        this.writeToGpu(device);
        pass.setPipeline(this.pipeline);
        this.bindGroups.forEach((x, i) => { pass.setBindGroup(i, x.createBindGroup(device, this.pipeline!)) });
        this.vbos.forEach((x, i) => { pass.setVertexBuffer(i, x.buffer) });
        pass.draw(this.vbos[0].vertexCount, this.instanceCount);
    }
}

type PipeOptions = {
    canvasFormat?: GPUTextureFormat,
    aaSampleCount?: number,
    fragmentEntry?: string,
    vertexEntry?: string,
    constants?: Record<string, number>
}

async function createPipeline(
    device: GPUDevice,
    vbos: VertexBufferObject[],
    groups: BindGroupBuilder[],
    shader: string,
    options?: PipeOptions
): Promise<GPURenderPipeline> {

    let groupLayouts = groups.map(x => device.createBindGroupLayout(x.getBindGroupLayoutdescriptor()));
    let pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: groupLayouts })
    let shaderModule = device.createShaderModule({ code: shader });
    let topology = vbos[0].topology;

    let pieplineDesc: GPURenderPipelineDescriptor = {
        label: "NewRenderer pipeline",
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: options?.vertexEntry ?? "vertexMain",
            buffers: vbos.map(x => x.vertexBufferLayout),
            constants: options?.constants,
        },
        fragment: {
            module: shaderModule,
            entryPoint: options?.fragmentEntry ?? "fragmentMain",
            constants: options?.constants,
            targets: [{
                format: options?.canvasFormat ?? 'bgra8unorm',
                blend: {
                    color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                    alpha: {}
                }
            }],
        },
        primitive: {
            topology: topology,
            cullMode: 'back',
        },
        multisample: { count: options?.aaSampleCount ?? 4, },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        },
    };

    return await device.createRenderPipelineAsync(pieplineDesc);
}