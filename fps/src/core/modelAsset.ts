import { BoundingBox } from "./primitives/boundingBox";
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";
import { Material } from "./materials/pbrMaterial";

export class ModelAsset {

    get vertexBuffer(): GPUBuffer | null { return this.gpuBufferReference ? this.gpuBufferReference.vertexBuffer : this._vertexBuffer };
    private _vertexBuffer: GPUBuffer | null = null;
    get normalBuffer(): GPUBuffer | null { return this.gpuBufferReference ? this.gpuBufferReference.normalBuffer : this._normalBuffer };
    private _normalBuffer: GPUBuffer | null = null;

    constructor(public readonly name: string,
        public readonly vertices: Float32Array,
        public readonly vertexCount: number,
        public readonly vertexBufferLayout: GPUVertexBufferLayout,
        public readonly topology: GPUPrimitiveTopology,
        public material: Material = new BlinnPhongMaterial(),
        public boundingBox: BoundingBox,
        public readonly normalData: Float32Array | null = null,
        public readonly normalBufferLayout: GPUVertexBufferLayout | null = null,
        public readonly gpuBufferReference?: ModelAsset
    ) { }

    writeMeshToGpu(device: GPUDevice) {
        if (this.gpuBufferReference || this.vertexBuffer != null)
            return;
        const vdesc = {
            label: `${this.name} vertex buffer`,
            size: this.vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        };
        this._vertexBuffer = device.createBuffer(vdesc);
        device.queue.writeBuffer(this._vertexBuffer, 0, this.vertices, 0);

        if (this.normalData == null)
            return;
        const ndesc = {
            label: `${this.name} normal buffer`,
            size: this.normalData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        };

        this._normalBuffer = device.createBuffer(ndesc);
        device.queue.writeBuffer(this._normalBuffer, 0, this.normalData, 0);
    }
}