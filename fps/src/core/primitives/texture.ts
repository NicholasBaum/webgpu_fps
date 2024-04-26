export class Texture {

    constructor(
        readonly gpuTexture: GPUTexture,
        public readonly sampleType: GPUTextureSampleType = 'float',
        public label?: string
    ) { }

    get format() { return this.gpuTexture.format; }
    is16bit() { return this.gpuTexture.format == 'rgba16float'; }
    isDepth() { return this.sampleType == 'depth' }

    // a GPUTexture actually doesn't have have a definite viewDimension as e.g. a 6 layered array could be a 2d-array or a cube
    // these are just helpful to predict what a default TextureView creation should return
    get viewDimension() { return this.getViewDimension(); }
    is2d() { return this.gpuTexture.depthOrArrayLayers == 1 && this.gpuTexture.dimension == '2d' }
    is2dArray() { return this.gpuTexture.depthOrArrayLayers > 1 && this.gpuTexture.dimension == '2d' }

    createView() {
        return this.gpuTexture.createView();
    }

    createCubeView() {
        return this.gpuTexture.createView({ dimension: 'cube' });
    }

    createMipView(level: number) {
        return new TextureView(
            this.gpuTexture.createView({ mipLevelCount: 1, baseMipLevel: level }),
            this.sampleType,
            this.getViewDimension(),
            this.gpuTexture.depthOrArrayLayers,
            this.format
        );
    }

    createTextureView(): TextureView {
        let dim = this.getViewDimension(); 
        return new TextureView(
            this.gpuTexture.createView({ dimension: dim }),
            this.sampleType,
            dim,
            this.gpuTexture.depthOrArrayLayers,
            this.format
        );
    }

    private getViewDimension(): GPUTextureViewDimension {
        // Todo: supplying createView with an GPUTextureViewDiscriptor is optional
        // if not supllied a default will be derived based on the GPUTexture's properties
        // either have to implement my own default logics or have to reimplement official logics 
        // as I can't get hold of the created default GPUTextureViewDiscriptor
        // and GPUTextureView doesn't expose the necessary properties
        // e.g. it isn't even trivial to figure out what the resulting viewDimension of a GPUTextureView is

        if (this.is2d())
            return '2d';
        else if (this.is2dArray())
            return '2d-array'; 

        throw new Error(`Can't determine resulting ViewDimension for GpuTexture.`);
    }
}

export class TextureView {
    constructor(
        public readonly view: GPUTextureView,
        public readonly sampleType: GPUTextureSampleType,
        public readonly viewDimension: GPUTextureViewDimension,
        public readonly layerCount: number,
        public readonly format: GPUTextureFormat,
        public label?: string
    ) { }

    is16bit() { return this.format == 'rgba16float'; }
    isDepth() { return this.sampleType == 'depth' }
    is2d() { return this.viewDimension == '2d' }
    is2dArray() { return this.viewDimension == '2d-array' }
    isCube() { return this.viewDimension == 'cube' }
}