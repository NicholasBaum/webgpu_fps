import { createTextureFromImage } from "webgpu-utils";
import { createBrdfMap, createCubeMapFromImage, createCubeMapFromTexture, createIrradianceMap, createPrefilteredEnvironmentMap } from "./textureBuilder";
import { createTextureFromHdr } from "../../helper/io-rgbe";
import { Texture } from "../primitives/texture";

export class EnvironmentMap {

    public flatTextureMap: Texture | null = null;
    public get prefEnvMapMipLevelCount() { return this._prefilteredMap?.mipLevelCount ?? 0; }

    private _cubeMap: Texture | null = null;
    get cubeMap(): Texture {
        if (!this._cubeMap)
            throw new Error("cubeMap map texture wasn't loaded");
        return this._cubeMap;
    }

    private _irradianceMap: Texture | null = null;
    get irradianceMap(): Texture {
        if (!this._irradianceMap)
            throw new Error("irradianceMap map texture wasn't loaded");
        return this._irradianceMap;
    }

    private _prefilteredMap: Texture | null = null;
    get prefilteredMap(): Texture {
        if (!this._prefilteredMap)
            throw new Error("prefilterede environment map texture wasn't loaded");
        return this._prefilteredMap;
    }

    private _brdfMap: Texture | null = null;
    get brdfMap(): Texture {
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
        this.flatTextureMap = new Texture(this.isHdr ?
            await createTextureFromHdr(device, this.urls[0]) :
            await createTextureFromImage(device, this.urls[0])
        );

        let cubeMap = this.urls.length != 6 ?
            await createCubeMapFromTexture(device, this.flatTextureMap.gpuTexture) :
            await createCubeMapFromImage(device, this.urls);
        this._cubeMap = new Texture(cubeMap);

        this._irradianceMap = new Texture(await createIrradianceMap(device, cubeMap));
        this._prefilteredMap = new Texture(await createPrefilteredEnvironmentMap(device, cubeMap));
        this._brdfMap = new Texture(await createBrdfMap(device));
    }
}
