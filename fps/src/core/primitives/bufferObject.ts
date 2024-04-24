import { BufferObjectBase } from "./bufferObjectBase";

export class StaticBufferObject extends BufferObjectBase {
    private _data: Float32Array[];

    constructor(data: Float32Array | Float32Array[], label?: string) {
        super(label);
        this.label = label;
        this._size = this.calcSize(data);
        this._usage = Array.isArray(data) ? GPUBufferUsage.STORAGE : GPUBufferUsage.UNIFORM;
        this._data = Array.isArray(data) ? data : [data];
    }

    override writeToGpu(device: GPUDevice) {

        if (!this._buffer || this._device != device)
            this.initBuffer(device);

        this._data.forEach((x, i) => {
            device.queue.writeBuffer(this._buffer!, i * x.byteLength, x);
        });
    }
}

export class DynamicBufferObject extends BufferObjectBase {

    private _dataFct: () => Float32Array | Float32Array[];
    private isArrayData: boolean = false;

    constructor(dataFct: () => Float32Array | Float32Array[], label?: string) {
        super(label);
        this._dataFct = dataFct;
    }

    override writeToGpu(device: GPUDevice) {
        let data = this._dataFct();

        if (!this._buffer || this._device != device) {
            this.isArrayData = Array.isArray(data);
            this._usage = this.isArrayData ? GPUBufferUsage.STORAGE : GPUBufferUsage.UNIFORM;
            this.initBuffer(device);
        }

        if (!this.isArrayData)
            data = [data as Float32Array];

        (data as Float32Array[]).forEach((x, i) => {
            device.queue.writeBuffer(this._buffer!, i * x.byteLength, x);
        });
    }
}

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

    writeToGpu(device: GPUDevice) {

        let data = this._dataFct ? this._dataFct() : this._data!;
        if (!this._buffer || this._device != device) {
            this._device = device;
            this.isArrayData = Array.isArray(data);
            this._usage = this.isArrayData ? GPUBufferUsage.STORAGE : GPUBufferUsage.UNIFORM;
            if (this._size <= 0)
                this._size = this.calcSize(data);
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
}
