import { ModelAsset } from "./ModelAsset";

export class GpuManager {

    vertexBuffer: GPUBuffer | null = null;
    constructor(private device: GPUDevice) {
    }

    loadModel(name: string, vertices: Float32Array): ModelAsset {
        if (!this.vertexBuffer)
            this.vertexBuffer = this.device.createBuffer(this.getVertexBufferDesc(vertices.byteLength));
        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices, 0);
        return new ModelAsset(name);
    }

    private getVertexBufferDesc(byteLength: number): GPUBufferDescriptor {
        return {
            label: "vertex buffer",
            size: byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        };
    }
}