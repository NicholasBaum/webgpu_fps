export class EnvironmentMap {

    private _texture: GPUTexture | null = null;
    get texture(): GPUTexture {
        if (!this._texture)
            throw new Error("environemnt map texture wasn't loaded");
        return this._texture;
    }

    constructor(private urls: string[]) {

    }

    async loadAsync(device: GPUDevice) {
        const tasks = this.urls.map(async x => createImageBitmap(await fetch(x).then(x => x.blob())));
        const images = await Promise.all(tasks);

        this._texture = device.createTexture({
            dimension: '2d',
            size: [images[0].width, images[0].height, 6],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });

        images.forEach((x, i) => {
            device.queue.copyExternalImageToTexture(
                { source: x },
                { texture: this.texture, origin: [0, 0, i] },
                [images[0].width, images[0].height]
            )
        });
    }

    writeToGpu(device: GPUDevice) {

    }
}