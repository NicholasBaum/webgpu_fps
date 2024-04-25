import { BufferObject } from "../primitives/bufferObject";
import { Texture } from "../primitives/texture";

export default class BindGroupBuilder {
    public index: number = 0;
    private bindings: IBinding[] = [];

    constructor(...bindings: IBinding[]) {
        this.addRange(...bindings);
    }

    createBindGroup(device: GPUDevice, pipeline: GPURenderPipeline): GPUBindGroup {
        return device.createBindGroup(this.buildDescriptor(pipeline))
    }

    getBindGroupLayoutdescriptor(): GPUBindGroupLayoutDescriptor {
        return { entries: this.bindings.map((x, i) => x.getLayout(i)) }
    }

    private buildDescriptor(pipeline: GPURenderPipeline): GPUBindGroupDescriptor {
        return {
            layout: pipeline.getBindGroupLayout(this.index),
            entries: this.bindings.map((x, i) => x.getEntry(i))
        };
    }

    add(bindings: IBinding) {
        this.bindings.push(bindings);
    }

    addRange(...bindings: IBinding[]) {
        this.bindings.push(...bindings);
    }

    replace(newBinding: IBinding, oldBinding: IBinding) {
        let ind = this.bindings.indexOf(oldBinding);
        if (ind == -1)
            throw new Error(`oldBinding doesn't exist in the BindGroup`);
        this.bindings[ind] = newBinding;
    }

    writeToGpu(device: GPUDevice) {
        this.bindings.forEach(x => x.writeToGpu(device));
    }
}

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

export function createTexture(texture: Texture): TextureBinding {
    let visibility = GPUShaderStage.FRAGMENT;
    let type: GPUTextureBindingLayout = { sampleType: texture.sampleType, viewDimension: texture.viewDimension };
    return new TextureBinding(visibility, type, texture);
}

export function createSampler(sampler: GPUSampler | GPUSamplerDescriptor): SamplerBinding {
    let visibility = GPUShaderStage.FRAGMENT;
    let type: GPUSamplerBindingLayout = {};
    return new SamplerBinding(visibility, type, sampler);
}

export interface IBinding {
    getLayout(index: number): GPUBindGroupLayoutEntry;
    getEntry(index: number): GPUBindGroupEntry;
    writeToGpu(device: GPUDevice): void;
}

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

export class TextureBinding implements IBinding {

    constructor(
        public readonly visibility: GPUShaderStageFlags,
        public readonly type: GPUTextureBindingLayout,
        public readonly texture: Texture) {
    }

    getLayout(index: number): GPUBindGroupLayoutEntry {
        return {
            binding: index,
            visibility: this.visibility,
            texture: this.type,
        }
    }

    getEntry(index: number): GPUBindGroupEntry {
        return {
            binding: index,
            resource: this.texture.createView()
        }
    }

    writeToGpu(device: GPUDevice): void {
    }
}

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