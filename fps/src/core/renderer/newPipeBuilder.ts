import { VertexBufferObject } from "../primitives/VertexBufferObject_fix";
import BindGroupBuilder from "./bindGroupBuilder";

// a pipeline is mainly defined by 
// vertex data, VertexBufferObject[],
// grouped bindings of type uniform, storage, textures, sampler...
// which refer to types Buffer, Texture, GPUSampler,...
// and the corresponding shader
export class NewPipeBuilder {

    get vbos(): ReadonlyArray<VertexBufferObject> { return this._vbos; };
    private _vbos: VertexBufferObject[] = [];

    get bindGroups(): ReadonlyArray<BindGroupBuilder> { return this._bindGroups; };
    private _bindGroups: BindGroupBuilder[] = [];

    private SHADER: string;

    get pipeline() { return this._pipeline; };
    private _pipeline: GPURenderPipeline | undefined;

    private options?: PipeOptions;

    constructor(shader: string, options?: PipeOptions) {
        this.SHADER = shader;
        this.options = options;
    }

    async buildAsync(device: GPUDevice): Promise<GPURenderPipeline> {
        this._pipeline = await createPipeline(device, this._vbos, this._bindGroups, this.SHADER, this.options);
        return this._pipeline;
    }

    addVertexBuffer(vbo: VertexBufferObject): NewPipeBuilder {
        this._vbos.push(vbo);
        return this;
    }

    addBindGroup(group: BindGroupBuilder): NewPipeBuilder {
        group.index = this._bindGroups.length;
        this._bindGroups.push(group);
        return this;
    }
}

type PipeOptions = {
    canvasFormat?: GPUTextureFormat,
    aaSampleCount?: number,
    fragmentEntry?: string,
    vertexEntry?: string,
    vertexConstants?: Record<string, number>,
    fragmentConstants?: Record<string, number>,
    label?: string | undefined,
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
    let shaderModule = device.createShaderModule({ code: shader, label: `${options?.label} Shader` });
    let topology = vbos[0].topology;

    let pieplineDesc: GPURenderPipelineDescriptor = {
        label: `${options?.label} Pipeline`,
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: options?.vertexEntry ?? "vertexMain",
            buffers: vbos.map(x => x.vertexBufferLayout),
            constants: options?.vertexConstants,
        },
        fragment: {
            module: shaderModule,
            entryPoint: options?.fragmentEntry ?? "fragmentMain",
            constants: options?.fragmentConstants,
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