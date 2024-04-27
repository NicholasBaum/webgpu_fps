import { BufferObject } from "../primitives/bufferObject";
import { getLinearSampler, getNearestSampler } from "./newPipeBuilder";

export default class BindGroupBuilder {
    public index: number = 0;
    get bindings(): ReadonlyArray<IBinding> { return this._bindings; }
    private _bindings: IBinding[] = [];

    constructor(...bindings: IBinding[]) {
        this.addRange(...bindings);
    }

    async buildAsync(device: GPUDevice): Promise<void> {
        await Promise.all(this._bindings.map(x => x.buildAsync(device)));
    }

    createBindGroup(device: GPUDevice, pipeline: GPURenderPipeline): GPUBindGroup {
        return device.createBindGroup(this.buildDescriptor(pipeline))
    }

    getBindGroupLayoutdescriptor(): GPUBindGroupLayoutDescriptor {
        return { entries: this._bindings.map((x, i) => x.getLayout(i)) }
    }

    private buildDescriptor(pipeline: GPURenderPipeline): GPUBindGroupDescriptor {
        return {
            layout: pipeline.getBindGroupLayout(this.index),
            entries: this._bindings.map((x, i) => x.getEntry(i))
        };
    }

    add(bindings: IBinding) {
        this._bindings.push(bindings);
    }

    addRange(...bindings: IBinding[]) {
        this._bindings.push(...bindings);
    }
}


// helper functions
export function createUniformBinding(data: Float32Array | Float32Array[] | (() => Float32Array | Float32Array[])): BufferBinding {
    let type: GPUBufferBindingLayout = { type: 'uniform' };
    let buffer = new BufferObject(data);
    return new BufferBinding(type, buffer);
}

// mostly used for wgsl arrays with dynamic length
export function createStorageBinding(data: Float32Array | Float32Array[] | (() => Float32Array | Float32Array[])): BufferBinding {
    let type: GPUBufferBindingLayout = { type: 'read-only-storage' };
    let buffer = new BufferObject(data);
    return new BufferBinding(type, buffer);
}

// IBinding
export interface IBinding {
    getLayout(index: number): GPUBindGroupLayoutEntry;
    getEntry(index: number): GPUBindGroupEntry;
    buildAsync(device: GPUDevice): Promise<void>;
}

// BufferBinding
export class BufferBinding implements IBinding {

    constructor(
        public readonly type: GPUBufferBindingLayout,
        public readonly buffer: BufferObject,
        public readonly visibility: GPUShaderStageFlags = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT
    ) {
    }

    async buildAsync(device: GPUDevice) { }

    getLayout(index: number): GPUBindGroupLayoutEntry {
        return {
            binding: index,
            visibility: this.visibility,
            buffer: this.type,
        }
    }

    getEntry(index: number): GPUBindGroupEntry {
        return {
            binding: index,
            resource: { buffer: this.buffer.buffer }
        }
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

    async buildAsync(device: GPUDevice) { }

    getLayout(index: number): GPUBindGroupLayoutEntry {
        return {
            binding: index,
            visibility: this.visibility,
            texture: this.type,
        }
    }

    getEntry(index: number): GPUBindGroupEntry {
        if (!this._texture)
            throw new Error(`texture value wasn't set. (${this.label})`);
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
        public readonly visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT,
        public readonly type: GPUSamplerBindingType = 'filtering'
    ) {
        if (samplerOrDescriptor instanceof GPUSampler)
            this._sampler = samplerOrDescriptor;
    }

    async buildAsync(device: GPUDevice) {
        if (this._sampler)
            return;
        this._sampler = this.samplerOrDescriptor instanceof GPUSampler ?
            this.samplerOrDescriptor : device.createSampler(this.samplerOrDescriptor);
    }

    getLayout(index: number): GPUBindGroupLayoutEntry {
        return {
            binding: index,
            visibility: this.visibility,
            sampler: { type: this.type },
        }
    }

    getEntry(index: number): GPUBindGroupEntry {
        if (!this._sampler)
            throw new Error(`a sampler wasn't created yet`);
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
    constructor(visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT, type: GPUSamplerBindingType = 'filtering') {
        super(undefined, visibility, type)
    }
    async buildAsync(device: GPUDevice) {
        this._sampler = getLinearSampler(device);
    }
}

export class NearestSamplerBinding extends SamplerBinding {
    constructor(visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT, type: GPUSamplerBindingType = 'filtering') {
        super(undefined, visibility, type)
    }
    async buildAsync(device: GPUDevice) {
        this._sampler = getNearestSampler(device);
    }
}