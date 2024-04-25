export class Texture {

    constructor(
        readonly gpuTexture: GPUTexture,
        readonly sampleType: GPUTextureSampleType = 'float'
    ) { }

    get viewDimension() { return this.gpuTexture.dimension; }
    
    is16bit() {
        return this.gpuTexture.format == 'rgba16float';
    }

    createView() {
        return this.gpuTexture.createView();
    }

    createCubeView() {
        return this.gpuTexture.createView({ dimension: 'cube' });
    }
}