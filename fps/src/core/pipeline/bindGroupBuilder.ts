import { BufferObject } from "../primitives/bufferObject";

export function createElement(o: Float32Array | (() => Float32Array)) {
    let visibility = GPUShaderStage.VERTEX | GPUShaderStage.VERTEX;
    let type: GPUBufferBindingLayout = { type: 'uniform' };
    let buffer = new BufferObject(o);
    return new BindGroupElement(visibility, type, buffer);
}

export function createArrayElement(o: Float32Array[] | (() => Float32Array[])) {
    let visibility = GPUShaderStage.VERTEX | GPUShaderStage.VERTEX;
    let type: GPUBufferBindingLayout = { type: 'read-only-storage' };
    let buffer = new BufferObject(o);
    return new BindGroupElement(visibility, type, buffer);
}

export class BindGroupElement {
    constructor(
        public readonly visibility: GPUShaderStageFlags,
        public readonly type: GPUBufferBindingLayout,
        public readonly buffer: BufferObject) {
    }
}

export default class BindGroupBuilder {
    public index: number = 0;
    private elements: BindGroupElement[] = [];
    // the actual binded data
    private get buffers() { return this.elements.map(x => x.buffer) }

    constructor() {

    }

    createBindGroup(device: GPUDevice, pipeline: GPURenderPipeline): GPUBindGroup {
        return device.createBindGroup(this.buildDescriptor(pipeline))
    }

    getBindGroupLayoutdescriptor(): GPUBindGroupLayoutDescriptor {
        return {
            entries: this.elements.map((x, i) => {
                return {
                    binding: i,
                    visibility: x.visibility,
                    buffer: x.type,
                }
            })
        }
    }

    private buildDescriptor(pipeline: GPURenderPipeline): GPUBindGroupDescriptor {
        return {
            layout: pipeline.getBindGroupLayout(this.index),
            entries: this.buffers.map((x, i) => {
                return {
                    binding: i,
                    resource: { buffer: x.buffer }
                }
            })
        };
    }

    add(el: BindGroupElement) {
        this.elements.push(el);
    }

    writeToGpu(device: GPUDevice) {
        this.buffers.forEach(x => x.writeToGpu(device));
    }
}