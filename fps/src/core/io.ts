export async function fetchImage(path: string): Promise<ImageBitmap> {
    let res = await fetch(path);
    return createImageBitmap(await res.blob());
}

export async function createTextureOnDevice(path: string, device: GPUDevice): Promise<GPUTexture> {
    // fetch image
    let image = await fetchImage(path);

    // allocate texture
    let texture = device.createTexture({
        size: [image.width, image.height, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT
    });

    // copy
    device.queue.copyExternalImageToTexture(
        { source: image },
        { texture: texture },
        [image.width, image.height]);

    return texture;
}