import { IGpuRef } from "./VertexBufferObject";

export interface IBufferObject extends IGpuRef {
    buffer: GPUBuffer;
    writeToGpu(device: GPUDevice): void;
}

abstract class BufferObjectBase implements IBufferObject {

    private static getNewId() { return BufferObjectBase.ID++; }
    private static ID: number = 0;
    readonly id: number = 0;

    label: string | undefined;

    get device(): GPUDevice | null { return this._device; }
    protected _device: GPUDevice | null = null;

    get buffer(): GPUBuffer {
        if (this._buffer)
            return this._buffer;
        throw new Error(`Buffer wasn't initialized. ${this.label}`);
    }
    protected _buffer: GPUBuffer | undefined;


    protected _usage: GPUFlagsConstant = GPUBufferUsage.UNIFORM;
    protected _size: number = -1;

    constructor(label?: string) {
        this.id = BufferObjectBase.getNewId();
        this.label = label;
    }

    protected calcSize(data: Float32Array | Float32Array[]): number {
        if (Array.isArray(data)) {
            return Math.max(data.length * (data.length > 0 ? data[0].byteLength : 0), 256);
        }
        else {
            return data.byteLength;
        }
    }

    protected initBuffer(device: GPUDevice) {
        this._device = device;
        const desc = {
            label: `${this.label}`,
            size: this._size,
            usage: this._usage | GPUBufferUsage.COPY_DST
        };
        this._buffer = device.createBuffer(desc);
    }

    abstract writeToGpu(device: GPUDevice): void;
}

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
