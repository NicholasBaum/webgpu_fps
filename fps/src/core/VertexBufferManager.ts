import { ModelAsset } from "./ModelAsset";

export class VertexBufferManager {

    buffers: GPUBuffer[] = [];
    
    constructor(private device: GPUDevice) {
    }

    loadModel(name: string, vertices: Float32Array): ModelAsset {
        if (this.buffers.length == 0)
            this.buffers.push(this.device.createBuffer(this.getVertexBufferDesc(vertices.byteLength)));
        this.device.queue.writeBuffer(this.buffers[0], 0, vertices, 0);
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