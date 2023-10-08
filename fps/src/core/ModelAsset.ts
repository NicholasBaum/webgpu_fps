import { simple_shader } from "../shaders/simple_shader";

export class ModelAsset {
    offset: number = 0;
    bufferId: number = 0;

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

    constructor(public name: string) { }
}