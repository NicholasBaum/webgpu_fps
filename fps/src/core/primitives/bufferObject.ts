import { Mat4, Vec4 } from "wgpu-matrix";
import { IGpuRef } from "./VertexBufferObject";

export class BufferObject implements IGpuRef {

    private static getNewId() { return BufferObject.ID++; }
    protected static ID: number = 0;

    readonly id: number = 0;
    get device(): GPUDevice | null { return this._device; }
    label: string | undefined;
    get buffer(): GPUBuffer {
        if (this._buffer)
            return this._buffer;
        throw new Error(`Buffer wasn't initialized. ${this.label}`);
    }

    private _device: GPUDevice | null = null;
    private _usage: GPUFlagsConstant = GPUBufferUsage.UNIFORM;
    private _buffer: GPUBuffer | undefined;
    private _size: number;
    private _data?: Float32Array[];
    private dataProvider?: () => Mat4;

    constructor(data: Float32Array | Float32Array[] | (() => Float32Array), label?: string) {
        this.id = BufferObject.getNewId();
        this.label = label;

        if (typeof data == 'function') {
            this._size = 64;
            this.dataProvider = data;
            this._usage = GPUBufferUsage.UNIFORM;
        }
        else if (Array.isArray(data)) {
            this._data = data;
            this._usage = GPUBufferUsage.STORAGE;
            this._size = data.length < 1 ? 256 : data.length * (data[0] as Float32Array).byteLength;
            this._size = Math.max(this._size, 256)
        } else {
            this._data = [data];
            this._usage = GPUBufferUsage.UNIFORM;
            this._size = 64;
        }
    }

    writeToGpu(device: GPUDevice) {

        if (!this._buffer || this._device != device) {
            this._device = device;
            const vdesc = {
                label: `${this.label}`,
                size: this._size,
                usage: this._usage | GPUBufferUsage.COPY_DST
            };
            this._buffer = device.createBuffer(vdesc);
        }

        if (this.dataProvider) {
            device.queue.writeBuffer(this._buffer, 0, this.dataProvider() as Float32Array);
        }
        else {
            this._data!.forEach((x, i) => {
                device.queue.writeBuffer(this._buffer!, i * x.byteLength, x);
            });
        }
    }
}