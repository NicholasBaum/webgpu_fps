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
        public readonly vertices: Float32Array,
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

// Texture, VertxBuffer, UniformBuffer, StorageBuffer

// question are these types alredy loaded types or loadable types ?
//     what problem do they solve ?

//         goal reusable VBOs and textures
// texture actually not necessary atm as too complicated
// but reusable Materials
// meaning Material VBO and Texture are tracked => the Material object is tracked

// practically meaning create a Material object and assign it as many times as you like
// a flag indicating it is already loaded prevents reload


// the remainder of ModelAsset seems to be VBO stuff only anyways

// todo: - move Material from Asset to Instance
//     - change Renderers InstanceGroup sorting algorithm
//         - more or less rename ModelAsset remainder to VBO
//             - refactor asset creation to output ModelInstances
//                 - let it reuse some static primitive VBOs

// what about the other two buffers ?
//     make a 10k instances scene


