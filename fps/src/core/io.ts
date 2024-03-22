import { createTextureFromImage } from "webgpu-utils";
import { Vec4 } from "wgpu-matrix";

export async function fetchImage(path: string): Promise<ImageBitmap> {
    let res = await fetch(path);
    return createImageBitmap(await res.blob());
}

export async function createTextureOnDevice(path: string, device: GPUDevice, mipmap: boolean = true): Promise<GPUTexture> {
    // only keeping/using createTextureOnDeviceWithoutMipMap for educationals purposes
    // the first method already supports no maps
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

export function createSolidColorTexture(device: GPUDevice, color: Vec4, width = 1, height = 1) {
    const numPixels = width * height;
    const data = new Uint8Array(4 * numPixels);
    const [r, g, b, a] = color;
    for (let i = 0; i < numPixels; ++i) {
        const offset = i * 4;
        data[offset] = r * 255;
        data[offset + 1] = g * 255;
        data[offset + 2] = b * 255;
        data[offset + 3] = a * 255;
    }
    const texture = device.createTexture({
        size: { width: width, height: height },
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    // the first argument takes a mipmap level parameter, this can be used to write multiple mip map layers to the texture
    device.queue.writeTexture({ texture }, data, { bytesPerRow: 4 * width, rowsPerImage: height }, { width: width, height: height });
    return texture;
}

export async function createTexture(device: GPUDevice, colorOrPath: Vec4 | string, useMipMaps: boolean = true): Promise<GPUTexture> {
    return typeof colorOrPath == 'string' ?
        await createTextureFromImage(device, colorOrPath, { mips: useMipMaps })
        : createSolidColorTexture(device, colorOrPath);
}