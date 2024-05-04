import { BufferObjectBase, calculateSize } from "./bufferObjectBase";

export class BufferObject extends BufferObjectBase {

    get device(): GPUDevice | undefined { return this._device; }
    private _device?: GPUDevice | undefined;

    get buffer(): GPUBuffer {
        if (this._buffer)
            return this._buffer;
        throw new Error(`Buffer wasn't initialized. ${this.label}`);
    }
    private _buffer: GPUBuffer | undefined;

    protected _data?: Float32Array | Float32Array[];
    protected _dataFct?: () => Float32Array | Float32Array[];
    private isArrayData: boolean = false;
    private _usage: GPUFlagsConstant = GPUBufferUsage.UNIFORM;
    private _size: number = -1;

    constructor(
        data: Float32Array | Float32Array[] | (() => Float32Array | Float32Array[]),
        usage: GPUFlagsConstant,
        label?: string,
        size?: number
    ) {
        super(label);
        this._usage = usage;
        this._size = size ?? this._size;
        if (typeof data == 'function')
            this._dataFct = data;
        else
            this._data = data;
    }

    override writeToGpu(device: GPUDevice) {

        let actualData = this._dataFct ? this._dataFct() : this._data!;

        if (!this._buffer || this._device != device) {
            this._device = device;
            this.isArrayData = Array.isArray(actualData);
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

        if (!this.isArrayData)
            actualData = [actualData as Float32Array];

        let currentOffset = 0;
        (actualData as Float32Array[]).forEach(x => {
            device.queue.writeBuffer(this._buffer!, currentOffset, x);
            currentOffset += x.byteLength;
        });
    }
}
