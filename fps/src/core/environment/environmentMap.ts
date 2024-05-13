import { createTextureFromImage } from "webgpu-utils";
import { createBrdfMap, createCubeMapFromImage, createCubeMapFromTexture, createIrradianceMap, createSpecularEnvironmentMap } from "./textureBuilder";
import { createTextureFromHdr } from "../../helper/io-rgbe";

export class EnvironmentMap {

    public flatTextureMap: GPUTexture | null = null;
    public get specularMipsCount() { return this._specularMap?.mipLevelCount ?? 0; }

    private _cubeMap: GPUTexture | null = null;
    get cubeMap(): GPUTexture {
        if (!this._cubeMap)
            throw new Error("cubeMap map texture wasn't loaded");
        return this._cubeMap;
    }

    private _irradianceMap: GPUTexture | null = null;
    get irradianceMap(): GPUTexture {
        if (!this._irradianceMap)
            throw new Error("irradianceMap map texture wasn't loaded");
        return this._irradianceMap;
    }

    private _specularMap: GPUTexture | null = null;
    // a precalculated map for specular reflections with multiple roughness levels 
    // stored in the mip levels
    get specularMap(): GPUTexture {
        if (!this._specularMap)
            throw new Error("specular map texture wasn't loaded");
        return this._specularMap;
    }

    private _brdfMap: GPUTexture | null = null;
    get brdfMap(): GPUTexture {
        if (!this._brdfMap)
            throw new Error("brdf map texture wasn't loaded");
        return this._brdfMap;
    }

    private urls: string[];
    private _isHdr = false;

    constructor(urls: string | string[]) {
        this.urls = typeof urls == 'string' ? [urls] : urls;
        if (this.urls.length != 1 && this.urls.length != 6)
            throw new Error("input needs to be a single equirectangular map or six images");
        this._isHdr = this.urls[0].toLowerCase().endsWith('.hdr');
    }

    async buildAsync(device: GPUDevice) {
        this.flatTextureMap = this._isHdr ?
            await createTextureFromHdr(device, this.urls[0]) :
            await createTextureFromImage(device, this.urls[0]);

        let cubeMap = this.urls.length != 6 ?
            await createCubeMapFromTexture(device, this.flatTextureMap, undefined, true) :
            await createCubeMapFromImage(device, this.urls);
        this._cubeMap = cubeMap;

        this._irradianceMap = await createIrradianceMap(device, cubeMap);
        this._specularMap = await createSpecularEnvironmentMap(device, cubeMap);
        this._brdfMap = await createBrdfMap(device);
    }
}
