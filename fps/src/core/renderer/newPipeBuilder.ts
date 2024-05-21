import { VertexBufferObject } from "../primitives/vertexBufferObject";
import { BindGroupDefinition } from "./bindGroupDefinition";

// a pipeline is mainly defined by 
// the shader 
// vertex data aka VertexBufferObject[],
// and bindings e.g. uniform, storage, textures, sampler...
// aka BufferBinding, TextureBinding, SamplerBinding,...
// which hold a BufferObject, GPUTextureView or GPUSampler 
// a target (GPUTexture) and some additonal properties

// NewPipe
// is just a convenient way to build a GPUPipeline
// pass in all information that needs 
// use BindGroupDefinition builder to create the necessary definitions for the bindgroups
//
// at some later point use a BindGroupProvider builder to create the actual bound data
// and attach everything to the GPURenderPassEndoder
//
// VertexBuffer, BufferObjects aren't initialized NewPipeBuilder, BindGroupProvider or BindGroupDefinition

interface NewPipe {
    device: GPUDevice;
    actualPipeline: GPURenderPipeline;
    groupDefinitions: ReadonlyArray<BindGroupDefinition>;
}

export async function createNewPipe(
    device: GPUDevice,
    shader: string | { vertex: string, fragment?: string },
    options?: PipeOptions,
    vertexLayouts?: GPUVertexBufferLayout | GPUVertexBufferLayout[],
    topology?: GPUPrimitiveTopology
): Promise<NewPipe> {
    const builder = new NewPipeBuilder(shader, vertexLayouts, topology ?? 'triangle-list', options);
    await builder.buildAsync(device);
    // as build call assigns a device, we can expose it as NewPipe
    return builder as NewPipe;
}


export class NewPipeBuilder {

    get groupDefinitions(): ReadonlyArray<BindGroupDefinition> { return this._groupDefinitions; };
    private _groupDefinitions: BindGroupDefinition[] = [];

    private SHADER: string | { vertex: string, fragment?: string };

    get device() { return this._device }
    private _device: GPUDevice | undefined;
    get actualPipeline() { return this._pipeline; };
    private _pipeline: GPURenderPipeline | undefined;

    private options?: PipeOptions;
    private _vertexBufferLayouts: GPUVertexBufferLayout[] | undefined;
    private _topology: GPUPrimitiveTopology = 'triangle-list';

    constructor(shader: string, options?: PipeOptions)
    constructor(shader: string | { vertex: string, fragment?: string }, vertexLayouts: GPUVertexBufferLayout | GPUVertexBufferLayout[] | undefined, topology: GPUPrimitiveTopology, options?: PipeOptions)
    constructor(shader: string | { vertex: string, fragment?: string }, arg2?: GPUVertexBufferLayout | GPUVertexBufferLayout[] | PipeOptions, arg3?: GPUPrimitiveTopology, arg4?: PipeOptions) {
        this.SHADER = shader;
        // second constructor
        if (arg3) {
            this._topology = arg3;
            if (arg2)
                this._vertexBufferLayouts = Array.isArray(arg2) ? arg2 : [arg2 as GPUVertexBufferLayout];
            this.options = arg4;
        }
        // first constructor
        else {
            this.options = arg2 as PipeOptions;
        }
    }

    async buildAsync(device: GPUDevice): Promise<GPURenderPipeline> {
        this._device = device
        this._pipeline = await createPipeline(device, this._vertexBufferLayouts, this._groupDefinitions, this.SHADER, this.options, this._topology);
        return this._pipeline;
    }

    setVertexBufferLayouts(layouts: GPUVertexBufferLayout | GPUVertexBufferLayout[], topology: GPUPrimitiveTopology) {
        this._vertexBufferLayouts = Array.isArray(layouts) ? layouts : [layouts];
        this._topology = topology;
        return this;
    }

    addBindGroup(group: BindGroupDefinition | ((builder: BindGroupDefinition) => BindGroupDefinition)): NewPipeBuilder {
        let g = typeof group == 'function' ? group(new BindGroupDefinition()) : group;
        g.index = this._groupDefinitions.length;
        this._groupDefinitions.push(g);
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
    depthStencilState?: GPUDepthStencilState | 'default' | 'none',
    targets?: (GPUColorTargetState | null)[]
}

async function createPipeline(
    device: GPUDevice,
    vertexBufferLayout: GPUVertexBufferLayout[] | undefined,
    bindGroupDefinitions: BindGroupDefinition[] | undefined,
    shader: string | { vertex: string, fragment?: string },
    options?: PipeOptions,
    topology: GPUPrimitiveTopology = 'triangle-list'
): Promise<GPURenderPipeline> {

    if (vertexBufferLayout && vertexBufferLayout.length < 1)
        vertexBufferLayout = undefined;

    let pipelineLayout: GPUPipelineLayout | GPUAutoLayoutMode = 'auto';
    if (bindGroupDefinitions && bindGroupDefinitions.length > 0) {
        let groupLayouts = bindGroupDefinitions.map(x => device.createBindGroupLayout(x.getBindGroupLayoutDescriptor()));
        pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: groupLayouts })
    }

    let vertexShaderModule: GPUShaderModule;
    let fragmentShaderModule: GPUShaderModule | undefined;
    if (typeof shader == 'string') {
        vertexShaderModule = device.createShaderModule({ code: shader, label: `${options?.label} Shader` });
        fragmentShaderModule = vertexShaderModule;
    }
    else {
        vertexShaderModule = device.createShaderModule({ code: shader.vertex, label: `${options?.label} Vertex Shader` });
        if (shader.fragment)
            fragmentShaderModule = device.createShaderModule({ code: shader.fragment, label: `${options?.label} Fragment Shader` });
    }

    let pieplineDesc: GPURenderPipelineDescriptor = {
        label: `${options?.label} Pipeline`,
        layout: pipelineLayout,
        vertex: {
            module: vertexShaderModule,
            entryPoint: options?.vertexEntry ?? "vertexMain",
            buffers: vertexBufferLayout,
            constants: options?.vertexConstants,
        },
        primitive: {
            topology: topology,
            cullMode: options?.cullMode ?? 'back',
        },
        multisample: { count: options?.aaSampleCount ?? 1, },
    };

    if (fragmentShaderModule) {
        pieplineDesc.fragment = {
            module: fragmentShaderModule,
            entryPoint: options?.fragmentEntry ?? "fragmentMain",
            constants: options?.fragmentConstants,
            targets: options?.targets ?? [{
                format: options?.canvasFormat ?? 'bgra8unorm',
                blend: {
                    color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                    alpha: {}
                }
            }],
        };
    }

    const depthValue = options?.depthStencilState;
    if (depthValue == undefined || depthValue == 'default') {
        pieplineDesc.depthStencil = {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        };
    }
    else if (depthValue != 'none') {
        pieplineDesc.depthStencil = depthValue as GPUDepthStencilState;
    }

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