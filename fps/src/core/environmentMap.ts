export class EnvironmentMap {

    private _texture: GPUTexture | null = null;
    get texture(): GPUTexture {
        if (!this._texture)
            throw new Error("environemnt map texture wasn't loaded");
        return this._texture;
    }

    constructor(private urls: string[]) {

    }

    writeToGpu(device: GPUDevice) {

    }
}