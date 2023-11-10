import { createTextureFromImage } from "webgpu-utils";
import { floor } from "wgpu-matrix/dist/2.x/vec2-impl";

export async function fetchImage(path: string): Promise<ImageBitmap> {
    let res = await fetch(path);
    return createImageBitmap(await res.blob());
}

export async function createTextureOnDevice(path: string, device: GPUDevice, mipmap: boolean = true): Promise<GPUTexture> {
    // only keeping/using createTextureOnDeviceWithoutMipMap for educationals purposes
    return mipmap ? createTextureFromImage(device, path, { mips: true }) : createTextureOnDeviceWithoutMipMap(path, device);
}

async function createTextureOnDeviceWithoutMipMap(path: string, device: GPUDevice): Promise<GPUTexture> {
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

export async function createDebugMipMapTextureOnDevice(device: GPUDevice): Promise<GPUTexture> {
    // allocate texture
    const texture = device.createTexture({
        format: 'rgba8unorm',
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
        size: [1024, 1024],
        mipLevelCount: 4,
    });

    const kColorForLevel = [
        [50, 50, 50, 255],
        [30, 136, 229, 255], // blue
        [255, 193, 7, 255], // yellow
        [216, 27, 96, 255], // pink
    ];

    for (let i = 0; i < 4; i++) {
        const size = 2 ** (10 - i);
        const data = createRawColorImage(size, size, kColorForLevel[i]);
        device.queue.writeTexture(
            { texture: texture, mipLevel: i },
            data,
            { bytesPerRow: size * 4 },
            [size, size]
        );
    }
    return texture;
}

export function createRawColorImage(width: number, height: number, color: number[]): Uint8Array {
    if (color.length != 4)
        throw new Error("Wrong color format");
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        data.set(color, i * 4);
    }
    return data;
}