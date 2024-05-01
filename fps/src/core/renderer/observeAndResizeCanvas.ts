export function observeAndResizeCanvas(canvas: HTMLCanvasElement) {
    // i think the spec says that observer will be kept alive
    // as long as canvas is alive
    const observer = new ResizeObserver((entries) => {
        requestAnimationFrame(() => {
            const devicePixelRatio = window.devicePixelRatio;
            canvas.width = canvas.clientWidth * devicePixelRatio;
            canvas.height = canvas.clientHeight * devicePixelRatio;
        })
    })
    observer.observe(canvas)
    return observer;
}

export function observeAndResizeCanvasHDDPI(canvas: HTMLCanvasElement, device: GPUDevice): ResizeObserver
export function observeAndResizeCanvasHDDPI(canvas: HTMLCanvasElement, maxTextureDimension2D: number): ResizeObserver
export function observeAndResizeCanvasHDDPI(canvas: HTMLCanvasElement, arg2: number | GPUDevice): ResizeObserver {

    let maxTextureDimension2D = arg2 instanceof GPUDevice ? arg2.limits.maxTextureDimension2D : arg2;

    const observer = new ResizeObserver(([entry]) => {
        requestAnimationFrame(() => {
            const { width, height } = getDevicePixelContentBoxSize(entry);
            canvas.width = Math.max(1, Math.min(width, maxTextureDimension2D));
            canvas.height = Math.max(1, Math.min(height, maxTextureDimension2D));
        })
    });
    observer.observe(canvas);
    return observer;
}

function getDevicePixelContentBoxSize(entry: ResizeObserverEntry) {
    // Safari does not support devicePixelContentBoxSize
    if (entry.devicePixelContentBoxSize) {
        return {
            width: entry.devicePixelContentBoxSize[0].inlineSize,
            height: entry.devicePixelContentBoxSize[0].blockSize,
        };
    } else {
        // These values not correct but they're as close as you can get in Safari
        return {
            width: entry.contentBoxSize[0].inlineSize * devicePixelRatio,
            height: entry.contentBoxSize[0].blockSize * devicePixelRatio,
        };
    }
}