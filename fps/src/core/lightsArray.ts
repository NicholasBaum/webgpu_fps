import { Light } from "./light";


export class LightsArray {

    constructor(public items: Light[]) { }

    private _gpuBuffer: GPUBuffer | null = null;
    get gpuBuffer(): GPUBuffer {
        if (!this._gpuBuffer)
            throw new Error("buffer wasn't initialized yet");
        return this._gpuBuffer;
    }

    writeToGpu(device: GPUDevice) {
        let size = this.items[0].size;
        if (!this._gpuBuffer) {
            this._gpuBuffer = device.createBuffer({
                label: "lights",
                size: Math.max(this.items.length * size, 80),
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });
        }
        for (let [i, l] of this.items.entries()) {
            device.queue.writeBuffer(this._gpuBuffer, i * size, l.getBytes());
        }
    }
}
