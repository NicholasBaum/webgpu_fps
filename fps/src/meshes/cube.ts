import { Mat4, mat4 } from "wgpu-matrix";
import { cubeVertexArray } from "./cube_assett";
import { simple_shader } from "../shaders/simple_shader";

export class Cube {

  static readonly cubePositionOffset = 0;
  static readonly cubeColorOffset = 16;
  static readonly cubeUVOffset = 32;
  static readonly cubeVertexCount = 36;
  get vertices(): Float32Array { return cubeVertexArray; }

  transform: Mat4 = mat4.create();
  static readonly shader: GPUShaderModuleDescriptor = simple_shader;
  static readonly topology: GPUPrimitiveTopology = "triangle-list";
  static readonly vertexBufferLayout: GPUVertexBufferLayout =
    {
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
    };
}
