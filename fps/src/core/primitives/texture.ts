export class Texture {

    constructor(readonly gpuTexture: GPUTexture) {

    }

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