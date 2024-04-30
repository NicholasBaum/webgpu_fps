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