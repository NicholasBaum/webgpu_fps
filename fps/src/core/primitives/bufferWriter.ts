import { BufferObjectBase, calculateSize } from "./bufferObjectBase";

export class BufferWriter extends BufferObjectBase {

    get device(): GPUDevice | undefined { return this._device; }
    private _device?: GPUDevice | undefined;

    get buffer(): GPUBuffer {
        if (this._buffer)
            return this._buffer;
        throw new Error(`Buffer wasn't initialized. ${this.label}`);
    }
    private _buffer: GPUBuffer | undefined;

    protected _data: Float32Array = new Float32Array();
    private _usage: GPUFlagsConstant = GPUBufferUsage.UNIFORM;
    private _size: number = -1;

    constructor(
        data?: Float32Array,
        usage: GPUFlagsConstant = GPUBufferUsage.UNIFORM,
        label?: string, size?: number
    ) {
        super(label);
        this._usage = usage;
        this._size = size ?? this._size;
        if (data)
            this._data = data;
    }

    override writeToGpu(device: GPUDevice): void
    override writeToGpu(device: GPUDevice, data: Float32Array): void
    override writeToGpu(device: GPUDevice, data?: Float32Array): void {
        if (data)
            this._data = data;

        let actualData = this._data;

        if (!this._buffer || this._device != device) {
            this._device = device;
            if (this._size <= 0)
                this._size = calculateSize(actualData);
            if (this._usage == GPUBufferUsage.STORAGE)
                this._size = Math.max(this._size, 256);
            const vdesc = {
                label: `${this.label}`,
                size: this._size,
                usage: this._usage | GPUBufferUsage.COPY_DST
            };
            this._buffer = device.createBuffer(vdesc);
        }

        device.queue.writeBuffer(this._buffer, 0, actualData);

    }
}
