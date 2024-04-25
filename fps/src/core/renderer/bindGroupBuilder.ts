import { BufferObject } from "../primitives/bufferObject";
import { Texture } from "../primitives/texture";

export default class BindGroupBuilder {
    public index: number = 0;
    private elements: IBinding[] = [];

    constructor(...elements: IBinding[]) {
        this.addRange(...elements);
    }

    createBindGroup(device: GPUDevice, pipeline: GPURenderPipeline): GPUBindGroup {
        return device.createBindGroup(this.buildDescriptor(pipeline))
    }

    getBindGroupLayoutdescriptor(): GPUBindGroupLayoutDescriptor {
        return { entries: this.elements.map((x, i) => x.getLayout(i)) }
    }

    private buildDescriptor(pipeline: GPURenderPipeline): GPUBindGroupDescriptor {
        return {
            layout: pipeline.getBindGroupLayout(this.index),
            entries: this.elements.map((x, i) => x.getEntry(i))
        };
    }

    add(el: IBinding) {
        this.elements.push(el);
    }

    addRange(...elements: IBinding[]) {
        this.elements.push(...elements);
    }

    replace(newBinding: IBinding, oldBinding: IBinding) {
        let ind = this.elements.indexOf(oldBinding);
        if (ind == -1)
            throw new Error(`oldBinding doesn't exist in the BindGroup`);
        this.elements[ind] = newBinding;
    }

    writeToGpu(device: GPUDevice) {
        this.elements.forEach(x => x.writeToGpu(device));
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

export function createSampler(sampler: GPUSampler): SamplerBinding {
    let visibility = GPUShaderStage.FRAGMENT;
    let type: GPUSamplerBindingLayout = {};
    return new SamplerBinding(visibility, type, sampler);
}

interface IBinding {
    getLayout(index: number): GPUBindGroupLayoutEntry;
    getEntry(index: number): GPUBindGroupEntry;
    writeToGpu(device: GPUDevice): void;
}

class BufferBinding implements IBinding {

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

class TextureBinding implements IBinding {

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

class SamplerBinding implements IBinding {

    constructor(
        public readonly visibility: GPUShaderStageFlags,
        public readonly type: GPUSamplerBindingLayout,
        public readonly sampler: GPUSampler) {
    }

    getLayout(index: number): GPUBindGroupLayoutEntry {
        return {
            binding: index,
            visibility: this.visibility,
            sampler: this.type,
        }
    }

    getEntry(index: number): GPUBindGroupEntry {
        return {
            binding: index,
            resource: this.sampler
        }
    }

    writeToGpu(device: GPUDevice): void {
    }
}