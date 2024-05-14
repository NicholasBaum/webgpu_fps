export function createComputePipe(device: GPUDevice, shader: string, label?: string, constants?: Record<string, number>): Promise<GPUComputePipeline> {

    const module = device.createShaderModule({ code: shader });

    const pipeline = device.createComputePipelineAsync({
        label,
        layout: 'auto',
        compute: {
            module,
            entryPoint: 'main',
            constants
        },
    });

    return pipeline;
}

export function createStorageTexture(
    device: GPUDevice,
    size: number | [number, number] | [number, number, number] | [number, number, number, number],
    format: GPUTextureFormat = 'rgba8unorm'
): GPUTexture {
    size = typeof size == 'number' ? [size, size, 1, 1] : size;
    size = size.length == 2 ? [...size, 1, 1] : size;
    size = size.length == 3 ? [...size, 1] : size;

    let texture = device.createTexture({
        size: size.slice(0, 3),
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
        format: format,
        mipLevelCount: size[3]
    });
    return texture;
}

export function attachCopyGpuTexture(device: GPUDevice, encoder: GPUCommandEncoder, source: GPUTexture): GPUTexture {
    let size = [source.width, source.height, source.depthOrArrayLayers];
    let target = device.createTexture({ size, format: source.format, usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING });
    encoder.copyTextureToTexture({
        texture: source,
        mipLevel: 0,
        origin: [0, 0, 0],
        aspect: "all"
    }, {
        texture: target,
        mipLevel: 0,
        origin: [0, 0, 0],
        aspect: "all"
    }, size);
    return target;
}