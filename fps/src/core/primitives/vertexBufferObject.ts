import { BufferObjectBase } from "./bufferObjectBase";

export class VertexBufferObject extends BufferObjectBase {

    get device(): GPUDevice | undefined { return this._device; }
    private _device: GPUDevice | undefined;

    get buffer(): GPUBuffer {
        if (this._buffer)
            return this._buffer;
        throw new Error(`Buffer wasn't initialized. ${this.label}`);
    }
    private _buffer: GPUBuffer | undefined;

    constructor(
        private vertices: Float32Array,
        public readonly vertexCount: number,
        public readonly layout: GPUVertexBufferLayout,
        public readonly topology: GPUPrimitiveTopology,
        label?: string,
    ) {
        super(label);
    }

    writeToGpu(device: GPUDevice) {
        this._device = device;
        const vdesc = {
            label: `${this.label}`,
            size: this.vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        };
        this._buffer = device.createBuffer(vdesc);
        device.queue.writeBuffer(this._buffer, 0, this.vertices, 0);
    }

    async buildAsync(device: GPUDevice) {
        if (this._device == device && this._buffer)
            return;
        this._device = device;
        this.writeToGpu(device);
    }
}