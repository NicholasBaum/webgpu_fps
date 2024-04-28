import { BufferObject } from "../primitives/bufferObject";
import { IBufferObject } from "../primitives/bufferObjectBase";
import { getDepthSampler, getLinearSampler, getNearestSampler } from "./newPipeBuilder";

export class BindGroupBuilder {
    public index: number = 0;
    get bindings(): ReadonlyArray<IBinding> { return this._bindings; }
    private _bindings: IBinding[] = [];

    constructor(...bindings: IBinding[]) {
        this.add(...bindings);
    }

    createBindGroup(device: GPUDevice, pipeline: GPURenderPipeline): GPUBindGroup {
        return device.createBindGroup(this.buildDescriptor(pipeline, device))
    }

    private buildDescriptor(pipeline: GPURenderPipeline, device: GPUDevice): GPUBindGroupDescriptor {
        return {
            layout: pipeline.getBindGroupLayout(this.index),
            entries: this._bindings.map((x, i) => x.getEntry(i, device))
        };
    }

    getBindGroupLayoutdescriptor(): GPUBindGroupLayoutDescriptor {
        return { entries: this._bindings.map((x, i) => x.getLayout(i)) }
    }

    add(...bindings: IBinding[]) {
        this._bindings.push(...bindings);
        return this;
    }

    get<T extends IBinding>(index: number) {
        return this.bindings[index] as T;
    }
}


// helper functions
export function createUniformBinding(data: Float32Array | Float32Array[] | (() => Float32Array | Float32Array[])): BufferBinding {
    let type: GPUBufferBindingLayout = { type: 'uniform' };
    let buffer = new BufferObject(data, GPUBufferUsage.UNIFORM);
    return new BufferBinding(type, buffer);
}

// mostly used for wgsl arrays with dynamic length
export function createStorageBinding(data: Float32Array | Float32Array[] | (() => Float32Array | Float32Array[])): BufferBinding {
    let type: GPUBufferBindingLayout = { type: 'read-only-storage' };
    let buffer = new BufferObject(data, GPUBufferUsage.STORAGE);
    return new BufferBinding(type, buffer);
}

// IBinding
export interface IBinding {
    getLayout(index: number): GPUBindGroupLayoutEntry;
    getEntry(index: number, device: GPUDevice): GPUBindGroupEntry;
}

// BufferBinding
export class BufferBinding implements IBinding {

    get buffer() { return this._buffer; }
    private _buffer: IBufferObject | undefined;

    constructor(
        public readonly type: GPUBufferBindingLayout,
        buffer?: IBufferObject,
        public readonly visibility: GPUShaderStageFlags = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT
    ) {
        this._buffer = buffer;
    }

    getLayout(index: number): GPUBindGroupLayoutEntry {
        return {
            binding: index,
            visibility: this.visibility,
            buffer: this.type,
        }
    }

    getEntry(index: number, device: GPUDevice): GPUBindGroupEntry {
        if (!this._buffer)
            throw new Error(`buffer wasn't set`);
        return {
            binding: index,
            resource: { buffer: this._buffer.buffer }
        }
    }

    setEntry(buffer: IBufferObject) {
        this._buffer = buffer;
    }
}

// TextureBinding
export class TextureBinding implements IBinding {

    get texture() { return this._texture; }
    private _texture: GPUTextureView | undefined = undefined;
    public label: string | undefined;
    public readonly visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT;

    constructor(type: GPUTextureBindingLayout, label?: string)
    constructor(type: GPUTextureBindingLayout, visibility: GPUShaderStageFlags, label?: string)
    constructor(type: GPUTextureBindingLayout, texture: GPUTextureView, label?: string)
    constructor(type: GPUTextureBindingLayout, texture: GPUTextureView, visibility: GPUShaderStageFlags, label?: string)
    constructor(
        public readonly type: GPUTextureBindingLayout,
        arg2?: GPUTextureView | GPUShaderStageFlags | string | undefined,
        arg3?: GPUShaderStageFlags | string | undefined,
        arg4?: string | undefined
    ) {
        // first contstructor
        if (arg2 == undefined || typeof arg2 == 'string') {
            this.label = arg2;
            return;
        }

        // second contstructor
        if (typeof arg2 == 'number') {
            this.visibility = arg2;
            if (arg3 == undefined || typeof arg3 == 'string') {
                this.label = arg3;
                return;
            }
        }

        // third and fourth contstructor
        if (arg2 instanceof GPUTextureView) {
            this._texture = arg2;
            if (arg3 == undefined || typeof arg3 == 'string') {
                this.label = arg3;
                return;
            }
            else if (typeof arg3 == 'number') {
                this.visibility = arg3;
                if (arg4 == undefined || typeof arg4 == 'string') {
                    this.label = arg4;
                    return;
                }
            }
        }

        throw new Error(`TextureBinding constructor argumetns were invalid.`);
    }

    getLayout(index: number): GPUBindGroupLayoutEntry {
        return {
            binding: index,
            visibility: this.visibility,
            texture: this.type,
        }
    }

    getEntry(index: number, device: GPUDevice): GPUBindGroupEntry {
        if (!this._texture)
            throw new Error(`texture value wasn't set. (label: ${this.label})`);
        return {
            binding: index,
            resource: this._texture,
        }
    }

    setEntry(texture: GPUTextureView) {
        this._texture = texture;
    }
}

// SamplerBinding
export class SamplerBinding implements IBinding {

    protected _sampler: GPUSampler | undefined;

    constructor(
        readonly samplerOrDescriptor?: GPUSampler | GPUSamplerDescriptor,
        public label?: string,
        public readonly visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT,
        public readonly type: GPUSamplerBindingType = 'filtering'
    ) {
        if (samplerOrDescriptor instanceof GPUSampler)
            this._sampler = samplerOrDescriptor;
    }

    protected buildDefault(device: GPUDevice): GPUSampler {
        if (!this.samplerOrDescriptor)
            throw new Error(`Sampler couldn't be retrieved. (label: ${this.label}`);
        return this.samplerOrDescriptor instanceof GPUSampler ?
            this.samplerOrDescriptor : device.createSampler(this.samplerOrDescriptor);
    }

    getLayout(index: number): GPUBindGroupLayoutEntry {
        return {
            binding: index,
            visibility: this.visibility,
            sampler: { type: this.type },
        }
    }

    getEntry(index: number, device: GPUDevice): GPUBindGroupEntry {
        if (!this._sampler)
            this._sampler = this.buildDefault(device);

        return {
            binding: index,
            resource: this._sampler
        }
    }

    setEntry(sampler: GPUSampler) {
        this._sampler = sampler;
    }
}

export class LinearSamplerBinding extends SamplerBinding {
    constructor(label?: string, visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT, type: GPUSamplerBindingType = 'filtering') {
        super(undefined, label, visibility, type)
    }
    protected override buildDefault(device: GPUDevice) {
        return getLinearSampler(device);
    }
}

export class NearestSamplerBinding extends SamplerBinding {
    constructor(label?: string, visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT, type: GPUSamplerBindingType = 'filtering') {
        super(undefined, label, visibility, type)
    }
    protected override buildDefault(device: GPUDevice) {
        return getNearestSampler(device);
    }
}

export class DepthSamplerBinding extends SamplerBinding {
    constructor(label?: string, visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT, type: GPUSamplerBindingType = 'comparison') {
        super(undefined, label, visibility, type)
    }
    protected override buildDefault(device: GPUDevice) {
        return getDepthSampler(device);
    }
}