import { Vec3, Vec4 } from "wgpu-matrix";

export class DirectLight {

    constructor(
        public type: number = 0,
        public positionOrDirection: Vec3 = [0, 30, 0],
        public color: Vec4 = [0.5, 0.5, 0.5],
        public ambientColor: Vec4 = [1, 1, 1, 0],
        public ambientFactor: number = 1,
        public diffuseFactor: number = 1,
        public spectralFactor: number = 1,
    ) { }

    private _gpuBuffer: GPUBuffer | null = null;
    get gpuBuffer(): GPUBuffer {
        if (!this._gpuBuffer)
            throw new Error("buffer is null");
        return this._gpuBuffer;
    }

    private getBytes(): Float32Array {
        return new Float32Array(
            [
                this.type, 0, 0, 0,
                ...this.positionOrDirection, 0,
                ...this.color,
                ...this.ambientColor,
                ...[this.ambientFactor, this.diffuseFactor, this.spectralFactor, 0],
            ]
        )
    };

    writeToGpu(device: GPUDevice) {
        const bytes = this.getBytes();
        this._gpuBuffer = device.createBuffer({ label: "lights uniform", size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
        device.queue.writeBuffer(this._gpuBuffer, 0, bytes)
    }
}