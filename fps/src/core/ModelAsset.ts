import { createTextureFromImage } from "webgpu-utils";
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";

export class ModelAsset {

    vertexBuffer: GPUBuffer | null = null;
    vertexBufferOffset: number = 0;
    texture: GPUTexture | null = null;

    constructor(public readonly name: string,
        public readonly vertices: Float32Array,
        public readonly vertexCount: number,
        public readonly shader: GPUShaderModuleDescriptor,
        public readonly vertexBufferLayout: GPUVertexBufferLayout,
        public readonly topology: GPUPrimitiveTopology,
        public readonly texturePath: string | null = null,
        public readonly material: BlinnPhongMaterial = new BlinnPhongMaterial(),
    ) { }

    async load(device: GPUDevice, useMipMaps: boolean) {
        this.loadMesh(device);
        await this.loadTexture(device, useMipMaps);
    }

    loadMesh(device: GPUDevice) {
        const des = {
            label: `${this.name} vertex buffer`,
            size: this.vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        };
        this.vertexBuffer = device.createBuffer(des);
        device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices, 0);
    }

    async loadTexture(device: GPUDevice, useMipMaps: boolean) {
        if (!this.texturePath)
            return;
        this.texture = await createTextureFromImage(device, this.texturePath, { mips: useMipMaps });
    }
}