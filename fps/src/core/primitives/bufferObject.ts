import { BufferObjectBase } from "./bufferObjectBase";

export class BufferObject extends BufferObjectBase {

    private _data?: Float32Array | Float32Array[];
    private _dataFct?: () => Float32Array | Float32Array[];
    private isArrayData: boolean = false;

    constructor(data: Float32Array | Float32Array[] | (() => Float32Array | Float32Array[]), label?: string, size?: number) {
        super(label);
        this._size = size ?? this._size;
        if (typeof data == 'function')
            this._dataFct = data;
        else
            this._data = data;
    }

    override writeToGpu(device: GPUDevice) {

        let data = this._dataFct ? this._dataFct() : this._data!;
        if (!this._buffer || this._device != device) {
            this._device = device;
            this.isArrayData = Array.isArray(data);
            this._usage = this.isArrayData ? GPUBufferUsage.STORAGE : GPUBufferUsage.UNIFORM;
            if (this._size <= 0)
                this._size = BufferObjectBase.calcSize(data);
            const vdesc = {
                label: `${this.label}`,
                size: this._size,
                usage: this._usage | GPUBufferUsage.COPY_DST
            };
            this._buffer = device.createBuffer(vdesc);
        }

        if (!this.isArrayData)
            data = [data as Float32Array];

        (data as Float32Array[]).forEach((x, i) => {
            device.queue.writeBuffer(this._buffer!, i * x.byteLength, x);
        });
    }

    async buildAsync(device: GPUDevice) {
        if (this._device == device && this._buffer)
            return;
        this._device = device;
        this.writeToGpu(device);
    }
}
