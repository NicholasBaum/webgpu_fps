import { simple_shader } from "../shaders/simple_shader";

export class ModelAsset {

    vertexBuffer: GPUBuffer | null = null;
    vertexBufferOffset: number = 0;

    readonly positionOffset = 0;
    readonly colorOffset = 16;
    readonly uVOffset = 32;
    readonly vertexCount = 36;
    readonly shader: GPUShaderModuleDescriptor = simple_shader;
    readonly topology: GPUPrimitiveTopology = "triangle-list";

    readonly vertexBufferLayout: GPUVertexBufferLayout = {
        arrayStride: 40,
        attributes: [
            {
                format: "float32x4",
                offset: 0,
                shaderLocation: 0,
            },
            {
                format: "float32x4",
                offset: 16,
                shaderLocation: 1,
            },
            {
                format: "float32x2",
                offset: 32,
                shaderLocation: 2,
            }
        ]
    };;

    constructor(public readonly name: string, public readonly vertices: Float32Array) { }

    load(device: GPUDevice) {
        this.loadMesh(device);
        this.loadTexture(device);
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

    loadTexture(device: GPUDevice) {

    }
}