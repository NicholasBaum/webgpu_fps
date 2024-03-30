import { createTextureFromImage } from "webgpu-utils";

// loads a equirectangular rgbe image in png format
export async function createCubeMap(device: GPUDevice, url: string, size: number = 256): Promise<GPUTexture> {
    //let image = await createImageBitmap(await fetch(url).then(x => x.blob()))
    let sourceTexture = await createTextureFromImage(device, url, { usage: GPUTextureUsage.COPY_SRC });

    let cubeMap = device.createTexture({
        dimension: '2d',
        size: [size, size, 6],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });

    // copy texture
    let enc = device.createCommandEncoder();
    for (let i = 0; i < 6; i++) {
        //device.queue.copyExternalImageToTexture({ source: image }, { texture: cubeMap, origin: [0, 0, i] }, { height: size, width: size });
        enc.copyTextureToTexture({ texture: sourceTexture, origin: [0, 0, 0] }, { texture: cubeMap, origin: [0, 0, i] }, { height: size, width: size });
    }
    device.queue.submit([enc.finish()])
    return cubeMap;
}

