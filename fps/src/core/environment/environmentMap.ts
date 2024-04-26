import { createTextureFromImage } from "webgpu-utils";
import { createBrdfMap, createCubeMapFromImage, createCubeMapFromTexture, createIrradianceMap, createPrefilteredEnvironmentMap } from "./textureBuilder";
import { createTextureFromHdr } from "../../helper/io-rgbe";

export class EnvironmentMap {

    public flatTextureMap: GPUTexture | null = null;
    public get prefEnvMapMipLevelCount() { return this._prefilteredMap?.mipLevelCount ?? 0; }

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

    private _prefilteredMap: GPUTexture | null = null;
    get prefilteredMap(): GPUTexture {
        if (!this._prefilteredMap)
            throw new Error("prefilterede environment map texture wasn't loaded");
        return this._prefilteredMap;
    }

    private _brdfMap: GPUTexture | null = null;
    get brdfMap(): GPUTexture {
        if (!this._brdfMap)
            throw new Error("brdf map texture wasn't loaded");
        return this._brdfMap;
    }

    private urls: string[];
    public isHdr = false;

    constructor(urls: string | string[]) {
        this.urls = typeof urls == 'string' ? [urls] : urls;
        if (this.urls.length != 1 && this.urls.length != 6)
            throw new Error("input needs to be a single equirectangular map or six images");
        this.isHdr = this.urls[0].toLowerCase().endsWith('.hdr');
    }

    async loadAsync(device: GPUDevice) {
        this.flatTextureMap = this.isHdr ?
            await createTextureFromHdr(device, this.urls[0]) :
            await createTextureFromImage(device, this.urls[0]);

        let cubeMap = this.urls.length != 6 ?
            await createCubeMapFromTexture(device, this.flatTextureMap) :
            await createCubeMapFromImage(device, this.urls);
        this._cubeMap = cubeMap;

        this._irradianceMap = await createIrradianceMap(device, cubeMap);
        this._prefilteredMap = await createPrefilteredEnvironmentMap(device, cubeMap);
        this._brdfMap = await createBrdfMap(device);
    }
}
