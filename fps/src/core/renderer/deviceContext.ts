type DeviceContext = { device: GPUDevice, context: GPUCanvasContext, canvasFormat: GPUTextureFormat }

export async function createDeviceContext(canvas: HTMLCanvasElement, requestTimestampQuery = true): Promise<DeviceContext> {
    // get gpu device
    if (!navigator.gpu)
        throw new Error("WebGPU not supported on this browser.");
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter)
        throw new Error("No appropriate GPUAdapter found.");

    let useTimestamp = requestTimestampQuery ? adapter.features.has('timestamp-query') : false;
    if (requestTimestampQuery && !useTimestamp) {
        console.warn(`gpu timestamp-query requested but not available.`);
    }
    let device = await adapter.requestDevice({
        requiredFeatures: [
            ...(useTimestamp ? ['timestamp-query'] : []),
        ]
    } as GPUDeviceDescriptor);

    // init canvas context
    let context = <unknown>canvas.getContext("webgpu") as GPUCanvasContext;
    let canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: canvasFormat,
        alphaMode: 'premultiplied',
    });

    return { device, context, canvasFormat }
}
