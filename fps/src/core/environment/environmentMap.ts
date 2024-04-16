import { createTextureFromImage } from "webgpu-utils";
import { createBrdfMap, createCubeMap, createIrradianceMap, createPrefilteredEnvironmentMap } from "./textureBuilder";

export class EnvironmentMap {

    public flatTextureMap: GPUTexture | null = null;

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

    constructor(urls: string | string[]) {
        this.urls = typeof urls == 'string' ? [urls] : urls;
        if (this.urls.length != 1 && this.urls.length != 6)
            throw new Error("input needs to be a single equirectangular map or six images");
    }

    async loadAsync(device: GPUDevice) {
        this.flatTextureMap = await createTextureFromImage(device, this.urls[0]);

        if (this.urls.length == 1) {
            this._cubeMap = await createCubeMap(device, this.urls[0], 1024, false);
        }
        else {
            const tasks = this.urls.map(async x => createImageBitmap(await fetch(x).then(x => x.blob())));
            const images = await Promise.all(tasks);

            this._cubeMap = device.createTexture({
                dimension: '2d',
                size: [images[0].width, images[0].height, 6],
                format: 'rgba8unorm',
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
            });

            images.forEach((x, i) => {
                device.queue.copyExternalImageToTexture(
                    { source: x },
                    { texture: this.cubeMap, origin: [0, 0, i] },
                    [images[0].width, images[0].height]
                )
            });
        }

        this._irradianceMap = await createIrradianceMap(device, this._cubeMap);
        this._prefilteredMap = await createPrefilteredEnvironmentMap(device, this._cubeMap);
        this._brdfMap = await createBrdfMap(device);
    }
}
