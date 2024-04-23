interface IGpuRef {
    get id(): number;
    get device(): GPUDevice | null
    get label(): string | undefined;
}

export class VertexBufferObject implements IGpuRef {

    private static getNewId() { return VertexBufferObject.ID++; }
    private static ID: number = 0;

    get id(): number {
        return this._id;
    }
    private _id: number = 0;

    get device(): GPUDevice | null {
        return this._device;
    }
    private _device: GPUDevice | null = null;

    get label(): string | undefined {
        return this._label;
    }
    private _label?: string;

    get buffer(): GPUBuffer {
        if (!this._buffer)
            throw new Error(`The buffer of ${this.label} wasn't intialized.`);
        return this._buffer;
    }
    private _buffer?: GPUBuffer;

    constructor(
        private vertices: Float32Array,
        public readonly vertexCount: number,
        public readonly vertexBufferLayout: GPUVertexBufferLayout,
        public readonly topology: GPUPrimitiveTopology,
        label?: string,
    ) {
        this._label = label;
    }

    writeToGpu(device: GPUDevice) {
        this._device = device;
        this._id = VertexBufferObject.getNewId();
        const vdesc = {
            label: `${this.label}`,
            size: this.vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        };
        this._buffer = device.createBuffer(vdesc);
        device.queue.writeBuffer(this._buffer, 0, this.vertices, 0);
    }
}