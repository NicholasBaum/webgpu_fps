import { BufferObject } from "../primitives/bufferObject";
import { IBufferObject } from "../primitives/bufferObjectBase";
import { getDepthSampler, getLinearSampler, getNearestSampler, linear_sampler_descriptor } from "./newPipeBuilder";

export class BindGroupBuilder {
    public index: number = 0;
    get bindings(): ReadonlyArray<ILayoutDefinition> { return this._bindings; }
    private _bindings: ILayoutDefinition[] = [];

    constructor(...bindings: ILayoutDefinition[]) {
        this.add(...bindings);
    }

    getBindGroupLayoutdescriptor(): GPUBindGroupLayoutDescriptor {
        return { entries: this._bindings.map((x, i) => x.getLayout(i)) }
    }

    add(...bindings: ILayoutDefinition[]) {
        this._bindings.push(...bindings);
        return this;
    }

    get<T extends ILayoutDefinition>(index: number) {
        return this.bindings[index] as T;
    }
}

// IBinding
export interface ILayoutDefinition {
    getLayout(index: number): GPUBindGroupLayoutEntry;
}

// BufferBinding
export class BufferDefinition implements ILayoutDefinition {

    constructor(
        public readonly type: GPUBufferBindingLayout,
        public readonly visibility: GPUShaderStageFlags = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT
    ) { }

    getLayout(index: number): GPUBindGroupLayoutEntry {
        return {
            binding: index,
            visibility: this.visibility,
            buffer: this.type,
        }
    }
}

// TextureBinding
export class TextureDefinition implements ILayoutDefinition {

    public label: string | undefined;
    public readonly visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT;

    constructor(type: GPUTextureBindingLayout, label?: string)
    constructor(type: GPUTextureBindingLayout, visibility: GPUShaderStageFlags, label?: string)
    constructor(
        public readonly type: GPUTextureBindingLayout,
        arg2?: GPUShaderStageFlags | string | undefined,
        arg3?: string | undefined,
    ) {
        if (typeof arg2 == 'number') {
            this.visibility = arg2;
            this.label = arg3;
            return;
        }
        else {
            this.label = this.label;
            return;
        }
    }

    getLayout(index: number): GPUBindGroupLayoutEntry {
        return {
            binding: index,
            visibility: this.visibility,
            texture: this.type,
        }
    }
}

// SamplerBinding
export class SamplerDefinition implements ILayoutDefinition {
    constructor(
        public readonly type: GPUSamplerBindingType,
        public label?: string,
        public readonly visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT,
    ) { }

    getLayout(index: number): GPUBindGroupLayoutEntry {
        return {
            binding: index,
            visibility: this.visibility,
            sampler: { type: this.type },
        }
    }
}

export class LinearSamplerDefinition extends SamplerDefinition {
    constructor(label?: string, visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT) {
        super('filtering', label, visibility)
    }
}

export class NearestSamplerDefinition extends SamplerDefinition {
    constructor(label?: string, visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT) {
        super('filtering', label, visibility)
    }
}

export class DepthSamplerDefinition extends SamplerDefinition {
    constructor(label?: string, visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT) {
        super('comparison', label, visibility)
    }
}
