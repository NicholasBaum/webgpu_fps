export class PbrMaterial {
    
    disableNormalMap: boolean = false;
    normalMapPath: string | null = null;

    private _gpuBuffer: GPUBuffer | null = null;
    get gpuBuffer(): GPUBuffer {
        if (!this._gpuBuffer)
            throw new Error("buffer wasn't initialized");
        return this._gpuBuffer;
    }

    private _albedoTexture: GPUTexture | null = null;
    get albedoTexture(): GPUTexture {
        if (!this._albedoTexture)
            throw new Error("albedo texture wasn't loaded");
        return this._albedoTexture;
    }

    private _ambientOcclussionTexture: GPUTexture | null = null;
    get ambientOcclussionTexture(): GPUTexture {
        if (!this._ambientOcclussionTexture)
            throw new Error("ambient occlussion texture wasn't loaded");
        return this._ambientOcclussionTexture;
    }

    private _metalTexture: GPUTexture | null = null;
    get metalTexture(): GPUTexture {
        if (!this._metalTexture)
            throw new Error("specular texture wasn't loaded");
        return this._metalTexture;
    }

    private _roughnessTexture: GPUTexture | null = null;
    get roughnessTexture(): GPUTexture {
        if (!this._roughnessTexture)
            throw new Error("normal texture wasn't loaded");
        return this._roughnessTexture;
    }

    private _normalTexture: GPUTexture | null = null;
    get normalTexture(): GPUTexture {
        if (!this._normalTexture)
            throw new Error("normal texture wasn't loaded");
        return this._normalTexture;
    }

    writeToGpu(device: GPUDevice) {

    }

    async writeTexturesToGpuAsync(device: GPUDevice, useMipMaps: boolean) { }
}