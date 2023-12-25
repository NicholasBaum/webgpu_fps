import { Vec4 } from "wgpu-matrix";

export class BlinnPhongMaterial {

    mode: number = 0;
    diffuseColor: Vec4 = [0.5, 0, 0, 0];

    private _gpuBuffer: GPUBuffer | null = null;
    get gpuBuffer(): GPUBuffer {
        if (!this._gpuBuffer)
            throw new Error("buffer wasn't initialized yet");
        return this._gpuBuffer;
    }

    constructor(options?: { mode?: number, diffuseColor?: Vec4 }) {
        if (options) {
            this.mode = options.mode ?? this.mode;
            this.diffuseColor = options.diffuseColor ?? this.diffuseColor;
        }
    }

    static default() {
        return new BlinnPhongMaterial();
    }

    static flatColor(diffuseColor: Vec4) {
        return new BlinnPhongMaterial({ mode: 1, diffuseColor: diffuseColor });
    }

    private getBytes(): Float32Array {
        return new Float32Array([
            this.mode, 0, 0, 0,
            ...this.diffuseColor,
        ]);
    }

    writeToGpu(device: GPUDevice) {
        const bytes = this.getBytes();
        this._gpuBuffer = device.createBuffer({
            label: "material",
            size: Math.max(bytes.byteLength, 80),
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this._gpuBuffer, 0, bytes);
    }
}