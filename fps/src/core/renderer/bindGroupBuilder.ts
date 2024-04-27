import { BufferObject } from "../primitives/bufferObject";

export default class BindGroupBuilder {
    public index: number = 0;
    get bindings(): ReadonlyArray<IBinding> { return this._bindings; }
    private _bindings: IBinding[] = [];

    constructor(...bindings: IBinding[]) {
        this.addRange(...bindings);
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

    replace(newBinding: IBinding, oldBinding: IBinding): void
    replace(newBinding: IBinding, index: number): void
    replace(newBinding: IBinding, oldBindingOrIndex: IBinding | number): void {
        if (typeof oldBindingOrIndex == 'number') {
            this._bindings[oldBindingOrIndex] = newBinding;
        }
        else {
            let ind = this._bindings.indexOf(oldBindingOrIndex);
            if (ind == -1)
                throw new Error(`oldBinding doesn't exist in the BindGroup`);
            this._bindings[ind] = newBinding;
        }
    }

    writeToGpu(device: GPUDevice) {
        this._bindings.forEach(x => x.writeToGpu(device));
    }
}


// helper functions
export function createBinding(data: Float32Array | (() => Float32Array)): BufferBinding {
    let visibility = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    let type: GPUBufferBindingLayout = { type: 'uniform' };
    let buffer = new BufferObject(data);
    return new BufferBinding(visibility, type, buffer);
}

export function createArrayBinding(data: Float32Array[] | (() => Float32Array[])): BufferBinding {
    let visibility = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    let type: GPUBufferBindingLayout = { type: 'read-only-storage' };
    let buffer = new BufferObject(data);
    return new BufferBinding(visibility, type, buffer);
}

export function createTextureBinding(
    texture: GPUTextureView,
    dimension: GPUTextureViewDimension,
    sampleType: GPUTextureSampleType = 'float'
): TextureBinding {
    let visibility = GPUShaderStage.FRAGMENT;
    let type: GPUTextureBindingLayout = { sampleType: sampleType, viewDimension: dimension };
    return new TextureBinding(visibility, type, texture);
}

export function createSamplerBinding(
    sampler: GPUSampler | GPUSamplerDescriptor,
    type?: GPUSamplerBindingType
): SamplerBinding {
    let visibility = GPUShaderStage.FRAGMENT;
    return new SamplerBinding(visibility, sampler, type);
}

// IBinding
export interface IBinding {
    getLayout(index: number): GPUBindGroupLayoutEntry;
    getEntry(index: number): GPUBindGroupEntry;
    writeToGpu(device: GPUDevice): void;
}

// BufferBinding
export class BufferBinding implements IBinding {

    constructor(
        public readonly visibility: GPUShaderStageFlags,
        public readonly type: GPUBufferBindingLayout,
        public readonly buffer: BufferObject) {
    }

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

    writeToGpu(device: GPUDevice): void {
        this.buffer.writeToGpu(device);
    }
}

// TextureBinding
export class TextureBinding implements IBinding {

    constructor(
        public readonly visibility: GPUShaderStageFlags,
        public readonly type: GPUTextureBindingLayout,
        texture?: GPUTextureView,
        public label?: string | undefined
    ) {
        this._texture = texture;
    }

    get texture() { return this._texture; }
    private _texture: GPUTextureView | undefined = undefined;

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
            resource: this._texture
        }
    }

    setEntry(texture: GPUTextureView) {
        this._texture = texture;
    }

    writeToGpu(device: GPUDevice): void {
    }
}

// SamplerBinding
export class SamplerBinding implements IBinding {

    private _sampler: GPUSampler | undefined;

    constructor(
        public readonly visibility: GPUShaderStageFlags,
        readonly samplerOrDescriptor: GPUSampler | GPUSamplerDescriptor | undefined,
        public readonly type: GPUSamplerBindingType = 'filtering'
    ) {
        if (samplerOrDescriptor instanceof GPUSampler)
            this._sampler = samplerOrDescriptor;
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

    writeToGpu(device: GPUDevice): void {
        if (this._sampler)
            return;
        this._sampler = this.samplerOrDescriptor instanceof GPUSampler ?
            this.samplerOrDescriptor : device.createSampler(this.samplerOrDescriptor);
    }
}