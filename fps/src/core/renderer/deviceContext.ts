type DeviceContext = { device: GPUDevice, context: GPUCanvasContext, canvasFormat: GPUTextureFormat }

export async function createDeviceContext(canvas: HTMLCanvasElement): Promise<DeviceContext> {
    // get gpu device
    if (!navigator.gpu)
        throw new Error("WebGPU not supported on this browser.");
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter)
        throw new Error("No appropriate GPUAdapter found.");

    let device = await adapter.requestDevice();

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
