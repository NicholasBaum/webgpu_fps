import { BoundingBox } from "./boundingBox";
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";
import { Material, PbrMaterial } from "./materials/pbrMaterial";

export class ModelAsset {

    vertexBuffer: GPUBuffer | null = null;
    normalBuffer: GPUBuffer | null = null;

    constructor(public readonly name: string,
        public readonly vertices: Float32Array,
        public readonly vertexCount: number,
        public readonly vertexBufferLayout: GPUVertexBufferLayout,
        public readonly topology: GPUPrimitiveTopology,
        public material: Material = new BlinnPhongMaterial(),
        public boundingBox: BoundingBox,
        public readonly normalData: Float32Array | null = null,
        public readonly normalBufferLayout: GPUVertexBufferLayout | null = null,
    ) { }

    writeMeshToGpu(device: GPUDevice) {
        if (this.vertexBuffer != null)
            return;
        const vdesc = {
            label: `${this.name} vertex buffer`,
            size: this.vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        };
        this.vertexBuffer = device.createBuffer(vdesc);
        device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices, 0);

        if (this.normalData == null)
            return;
        const ndesc = {
            label: `${this.name} normal buffer`,
            size: this.normalData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        };

        this.normalBuffer = device.createBuffer(ndesc);
        device.queue.writeBuffer(this.normalBuffer, 0, this.normalData, 0);
    }
}