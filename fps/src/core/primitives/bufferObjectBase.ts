export interface IGpuRef {
    get id(): number;
    get device(): GPUDevice | undefined
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
    abstract get device(): GPUDevice | undefined;
    label: string | undefined;

    abstract get buffer(): GPUBuffer;

    constructor(label?: string) {
        this.id = BufferObjectBase.getNewId();
        this.label = label;
    }

    abstract writeToGpu(device: GPUDevice): void;

    protected static calcSize(data: Float32Array | Float32Array[]): number {
        if (Array.isArray(data))
            return data.length <= 0 ? 0 : data.reduce((acc, x) => { return acc + x.byteLength }, 0);
        else
            return data.byteLength;
    }
}