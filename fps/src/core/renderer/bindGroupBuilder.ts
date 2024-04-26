import { BufferObject } from "../primitives/bufferObject";
import { Texture, TextureView } from "../primitives/texture";

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
export function createElement(o: Float32Array | (() => Float32Array)): BufferBinding {
    let visibility = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    let type: GPUBufferBindingLayout = { type: 'uniform' };
    let buffer = new BufferObject(o);
    return new BufferBinding(visibility, type, buffer);
}

export function createArrayElement(o: Float32Array[] | (() => Float32Array[])): BufferBinding {
    let visibility = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    let type: GPUBufferBindingLayout = { type: 'read-only-storage' };
    let buffer = new BufferObject(o);
    return new BufferBinding(visibility, type, buffer);
}

export function createTexture(texture: Texture | TextureView): TextureBinding {
    let visibility = GPUShaderStage.FRAGMENT;
    let type: GPUTextureBindingLayout = { sampleType: texture.sampleType, viewDimension: texture.viewDimension };
    return new TextureBinding(visibility, type, texture);
}

export function createSampler(sampler: GPUSampler | GPUSamplerDescriptor): SamplerBinding {
    let visibility = GPUShaderStage.FRAGMENT;
    let type: GPUSamplerBindingLayout = {};
    return new SamplerBinding(visibility, type, sampler);
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

// Binding
export class Binding implements IBinding {
    constructor(
        readonly layout: GPUBindGroupLayoutEntry,
        readonly entry: GPUBindGroupEntry
    ) { }
    getLayout(index: number): GPUBindGroupLayoutEntry {
        this.layout.binding = index;
        return this.layout;
    }
    getEntry(index: number): GPUBindGroupEntry {
        this.entry.binding = index;
        return this.entry;
    }
    writeToGpu(device: GPUDevice): void { }
}

// TextureBinding
export class TextureBinding implements IBinding {

    constructor(
        public readonly visibility: GPUShaderStageFlags,
        public readonly type: GPUTextureBindingLayout,
        texture?: Texture | TextureView,
        public label?: string | undefined
    ) {
        this._texture = texture;
    }

    get texture() { return this._texture; }
    private _texture: Texture | TextureView | undefined = undefined;

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
            resource: this._texture instanceof Texture ? this._texture.createGpuView() : this._texture.view
        }
    }

    setEntry(texture: Texture | TextureView) {
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
        public readonly type: GPUSamplerBindingLayout,
        public readonly sampler: GPUSampler | GPUSamplerDescriptor) {
    }

    getLayout(index: number): GPUBindGroupLayoutEntry {
        return {
            binding: index,
            visibility: this.visibility,
            sampler: this.type,
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

    writeToGpu(device: GPUDevice): void {
        if (this._sampler)
            return;
        this._sampler = this.sampler instanceof GPUSampler ? this.sampler : device.createSampler(this.sampler);
    }
}