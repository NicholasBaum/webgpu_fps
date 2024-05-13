export function createCompPipe(device: GPUDevice, shader: string, label?: string): Promise<GPUComputePipeline> {

    const module = device.createShaderModule({ code: shader });

    const pipeline = device.createComputePipelineAsync({
        label,
        layout: 'auto',
        compute: {
            module,
            entryPoint: 'main',
        },
    });

    return pipeline;
}

export function create2dSourceTexture(device: GPUDevice, size: number, format?: GPUTextureFormat): GPUTexture {
    format = format ?? 'rgba8unorm';
    let texture = device.createTexture({
        size: [size, size, 1],
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
        format: format,
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