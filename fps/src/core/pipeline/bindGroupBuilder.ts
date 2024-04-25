import { BufferObject } from "../primitives/bufferObject";
import { Texture } from "../primitives/texture";

export default class BindGroupBuilder {
    public index: number = 0;
    private elements: IBindGroupElement[] = [];

    constructor(...elements: IBindGroupElement[]) {
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

    add(el: IBindGroupElement) {
        this.elements.push(el);
    }

    addRange(...elements: IBindGroupElement[]) {
        this.elements.push(...elements);
    }

    writeToGpu(device: GPUDevice) {
        this.elements.forEach(x => x.writeToGpu(device));
    }
}

export function createElement(o: Float32Array | (() => Float32Array)): IBindGroupElement {
    let visibility = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    let type: GPUBufferBindingLayout = { type: 'uniform' };
    let buffer = new BufferObject(o);
    return new BufferBindGroupElement(visibility, type, buffer);
}

export function createArrayElement(o: Float32Array[] | (() => Float32Array[])): IBindGroupElement {
    let visibility = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    let type: GPUBufferBindingLayout = { type: 'read-only-storage' };
    let buffer = new BufferObject(o);
    return new BufferBindGroupElement(visibility, type, buffer);
}

export function createTexture(texture: Texture): IBindGroupElement {
    let visibility = GPUShaderStage.FRAGMENT;
    let type: GPUTextureBindingLayout = { sampleType: texture.sampleType, viewDimension: texture.viewDimension };
    return new TextureBindGroupElement(visibility, type, texture);
}

export function createSampler(sampler: GPUSampler): IBindGroupElement {
    let visibility = GPUShaderStage.FRAGMENT;
    let type: GPUSamplerBindingLayout = {};
    return new SamplerBindGroupElement(visibility, type, sampler);
}

interface IBindGroupElement {
    getLayout(index: number): GPUBindGroupLayoutEntry;
    getEntry(index: number): GPUBindGroupEntry;
    writeToGpu(device: GPUDevice): void;
}

class BufferBindGroupElement implements IBindGroupElement {

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

class TextureBindGroupElement implements IBindGroupElement {

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

class SamplerBindGroupElement implements IBindGroupElement {

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