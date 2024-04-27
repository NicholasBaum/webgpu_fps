export interface IGpuRef {
    get id(): number;
    get device(): GPUDevice | null
    get label(): string | undefined;
}

export interface IBufferObject extends IGpuRef {
    buffer: GPUBuffer;
    writeToGpu(device: GPUDevice): void;
}

export abstract class BufferObjectBase implements IBufferObject {

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

    protected static calcSize(data: Float32Array | Float32Array[]): number {
        if (Array.isArray(data)) {
            return Math.max(data.length * (data.length > 0 ? data[0].byteLength : 0), 256);
        }
        else {
            return data.byteLength;
        }
    }

    abstract writeToGpu(device: GPUDevice): void;
}