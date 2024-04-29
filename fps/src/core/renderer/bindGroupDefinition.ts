export class BindGroupDefinition {
    public index: number = 0;
    get bindings(): ReadonlyArray<ILayoutDefinition> { return this._bindings; }
    private _bindings: ILayoutDefinition[] = [];

    constructor(bindings?: ILayoutDefinition | ILayoutDefinition[], public label?: string) {
        if (bindings)
            this.add(...(Array.isArray(bindings) ? bindings : [bindings]));
    }

    getBindGroupLayoutDescriptor(): GPUBindGroupLayoutDescriptor {
        return { entries: this._bindings.map((x, i) => x.getLayout(i)), label: this.label }
    }

    add(...bindings: ILayoutDefinition[]) {
        this._bindings.push(...bindings);
        return this;
    }

    addBuffer(type: GPUBufferBindingType, visibility: GPUShaderStageFlags = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT) {
        this._bindings.push(new BufferDefinition({ type }, visibility));
        return this;
    }

    addTexture(viewDimension?: GPUTextureViewDimension, sampleType?: GPUTextureSampleType, multisampled?: boolean, visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT) {
        this._bindings.push(new TextureDefinition({ sampleType, viewDimension, multisampled }, visibility));
        return this;
    }

    addSampler(type: GPUSamplerBindingType, visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT) {
        this._bindings.push(new SamplerDefinition(type, visibility));
        return this;
    }

    addLinearSampler() {
        this._bindings.push(new LinearSamplerDefinition());
        return this;
    }

    addNearestSampler() {
        this._bindings.push(new NearestSamplerDefinition());
        return this;
    }

    addDepthSampler() {
        this._bindings.push(new DepthSamplerDefinition());
        return this;
    }

    when(predicate: boolean, fct: (builder: BindGroupDefinition) => BindGroupDefinition) {
        return predicate ? fct(this) : this;
    }
}

// ILayoutDefinition
export interface ILayoutDefinition {
    getLayout(index: number): GPUBindGroupLayoutEntry;
}

// BufferDefinition
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

// TextureDefinition
export class TextureDefinition implements ILayoutDefinition {

    constructor(
        public readonly type: GPUTextureBindingLayout = {},
        public readonly visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT,
    ) { }

    getLayout(index: number): GPUBindGroupLayoutEntry {
        return {
            binding: index,
            visibility: this.visibility,
            texture: this.type,
        }
    }
}

// SamplerDefinition
export class SamplerDefinition implements ILayoutDefinition {
    constructor(
        public readonly type: GPUSamplerBindingType,
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
    constructor(visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT) {
        super('filtering', visibility)
    }
}

export class NearestSamplerDefinition extends SamplerDefinition {
    constructor(visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT) {
        super('filtering', visibility)
    }
}

export class DepthSamplerDefinition extends SamplerDefinition {
    constructor(visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT) {
        super('comparison', visibility)
    }
}
