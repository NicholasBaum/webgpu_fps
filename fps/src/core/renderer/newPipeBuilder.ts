import { VertexBufferObject } from "../primitives/vertexBufferObject";
import { BindGroupDefinition, ILayoutDefinition } from "./bindGroupBuilder";

// a pipeline is mainly defined by 
// the shader 
// vertex data aka VertexBufferObject[],
// and bindings e.g. uniform, storage, textures, sampler...
// aka BufferBinding, TextureBinding, SamplerBinding,...
// which hold a BufferObject, GPUTextureView or GPUSampler 
// a target (GPUTexture) and some additonal properties

// NewPipe
//     - VertexBuffer.buildAsync gets called by NewPipe.buildAsync what should initialize the buffer
//     - BufferObject.buildAsync (e.g. uniform, storrage, array etc.) gets called by NewPipe.buildAsync what should initialize the buffer
//     - SamplerBinding will also be initialized  when buildAsync is called
//     - TextureBinding could fail late when getEntry() is called if no texture was attached
//
//     - rewriting a buffer etc. doesn't happen automatically, this is normally done by the renderer class
export class NewPipeBuilder {

    get vbos(): ReadonlyArray<VertexBufferObject> { return this._vbos; };
    private _vbos: VertexBufferObject[] = [];

    get bindGroups(): ReadonlyArray<BindGroupDefinition> { return this._bindGroups; };
    private _bindGroups: BindGroupDefinition[] = [];

    private SHADER: string;

    get device() { return this._device }
    private _device: GPUDevice | undefined;
    get pipeline() { return this._pipeline; };
    private _pipeline: GPURenderPipeline | undefined;

    private options?: PipeOptions;
    private _vertexBufferLayouts: GPUVertexBufferLayout[] = [];
    private _topology: GPUPrimitiveTopology = 'triangle-list';

    constructor(shader: string, options?: PipeOptions) {
        this.SHADER = shader;
        this.options = options;
    }

    async buildAsync(device: GPUDevice): Promise<GPURenderPipeline> {
        this._device = device
        await Promise.all(this.vbos.map(x => x.buildAsync(device)));
        this._pipeline = await createPipeline(device, this._vertexBufferLayouts, this._bindGroups, this.SHADER, this.options, this._topology);
        return this._pipeline;
    }

    addVertexBuffer(...vbo: VertexBufferObject[]): NewPipeBuilder {
        this._vbos.push(...vbo);
        this._vertexBufferLayouts = this._vbos.map(x => x.vertexBufferLayout);
        this._topology = this._vbos[0].topology;
        return this;
    }

    setVertexBufferLayouts(layouts: GPUVertexBufferLayout | GPUVertexBufferLayout[], topology: GPUPrimitiveTopology) {
        this._vertexBufferLayouts = Array.isArray(layouts) ? layouts : [layouts];
        this._topology = topology;
        return this;
    }

    addBindGroup(group: BindGroupDefinition): NewPipeBuilder {
        group.index = this._bindGroups.length;
        this._bindGroups.push(group);
        return this;
    } 
}

export type PipeOptions = {
    canvasFormat?: GPUTextureFormat,
    aaSampleCount?: number,
    fragmentEntry?: string,
    vertexEntry?: string,
    vertexConstants?: Record<string, number>,
    fragmentConstants?: Record<string, number>,
    label?: string | undefined,
    cullMode?: GPUCullMode,
    depthStencilState?: GPUDepthStencilState,
}

async function createPipeline(
    device: GPUDevice,
    vertexBufferLayout: GPUVertexBufferLayout[] | VertexBufferObject[],
    groups: BindGroupDefinition[],
    shader: string,
    options?: PipeOptions,
    topology: GPUPrimitiveTopology = 'triangle-list'
): Promise<GPURenderPipeline> {

    if (vertexBufferLayout.length <= 0)
        throw new Error(`vertexBufferLayout argument can't be empty.`);
    if (vertexBufferLayout[0] instanceof VertexBufferObject)
        vertexBufferLayout = vertexBufferLayout.map(x => (x as VertexBufferObject).vertexBufferLayout);
    let groupLayouts = groups.map(x => device.createBindGroupLayout(x.getBindGroupLayoutdescriptor()));
    let pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: groupLayouts })
    let shaderModule = device.createShaderModule({ code: shader, label: `${options?.label} Shader` });

    let pieplineDesc: GPURenderPipelineDescriptor = {
        label: `${options?.label} Pipeline`,
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: options?.vertexEntry ?? "vertexMain",
            buffers: vertexBufferLayout as GPUVertexBufferLayout[],
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
            cullMode: options?.cullMode ?? 'back',
        },
        multisample: { count: options?.aaSampleCount ?? 4, },
        depthStencil: options?.depthStencilState ?? {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        },
    };

    return await device.createRenderPipelineAsync(pieplineDesc);
}

export const linear_sampler_descriptor: GPUSamplerDescriptor = {
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
    lodMinClamp: 0,
    lodMaxClamp: 4,
    maxAnisotropy: 16,
};

let linearSampler: [GPUDevice, GPUSampler] | undefined = undefined;
export function getLinearSampler(device: GPUDevice): GPUSampler {
    if (!linearSampler || device != linearSampler[0])
        linearSampler = [device, device.createSampler(linear_sampler_descriptor)];
    return linearSampler[1];
}

export const nearest_sampler_descriptor: GPUSamplerDescriptor = {
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    magFilter: 'nearest',
    minFilter: 'nearest',
};

let nearestSampler: [GPUDevice, GPUSampler] | undefined = undefined;
export function getNearestSampler(device: GPUDevice): GPUSampler {
    if (!nearestSampler || device != nearestSampler[0])
        nearestSampler = [device, device.createSampler(nearest_sampler_descriptor)];
    return nearestSampler[1];
}


export const depth_sampler_descriptor: GPUSamplerDescriptor = {
    compare: "less"
};

let depthSampler: [GPUDevice, GPUSampler] | undefined = undefined;
export function getDepthSampler(device: GPUDevice): GPUSampler {
    if (!depthSampler || device != depthSampler[0])
        depthSampler = [device, device.createSampler(depth_sampler_descriptor)];
    return depthSampler[1];
}