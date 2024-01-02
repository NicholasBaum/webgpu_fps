// cube where every triangle is defined separatly
// as normals are defined per vertex defining it with 8 vertices only would lead to unuseable interpolated normals

export const CUBE_TOPOLOGY  : GPUPrimitiveTopology = "triangle-list";
export const CUBE_VERTEX_COUNT: number = 36;

export const CUBE_VERTEX_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 56,
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
      },
      {
          format: "float32x4",
          offset: 40,
          shaderLocation: 3,
      }
  ]
};

// prettier-ignore
export const CUBE_VERTEX_ARRAY = new Float32Array([
  // float4 position, float4 color, float2 uv, float4 normal

  // bottom
  1, -1, 1, 1,   1, 0, 1, 1,  0, 1,  0, -1, 0, 1,
  -1, -1, 1, 1,  0, 0, 1, 1,  1, 1,  0, -1, 0, 1,
  -1, -1, -1, 1, 0, 0, 0, 1,  1, 0,  0, -1, 0, 1,
  1, -1, -1, 1,  1, 0, 0, 1,  0, 0,  0, -1, 0, 1,
  1, -1, 1, 1,   1, 0, 1, 1,  0, 1,  0, -1, 0, 1,
  -1, -1, -1, 1, 0, 0, 0, 1,  1, 0,  0, -1, 0, 1,

  // right
  1, 1, 1, 1,    1, 1, 1, 1,  0, 1,  1, 0, 0, 1,
  1, -1, 1, 1,   1, 0, 1, 1,  1, 1,  1, 0, 0, 1,
  1, -1, -1, 1,  1, 0, 0, 1,  1, 0,  1, 0, 0, 1,
  1, 1, -1, 1,   1, 1, 0, 1,  0, 0,  1, 0, 0, 1,
  1, 1, 1, 1,    1, 1, 1, 1,  0, 1,  1, 0, 0, 1,
  1, -1, -1, 1,  1, 0, 0, 1,  1, 0,  1, 0, 0, 1,

  // top
  -1, 1, 1, 1,   0, 1, 1, 1,  0, 1,  0, 1, 0, 1,
  1, 1, 1, 1,    1, 1, 1, 1,  1, 1,  0, 1, 0, 1,
  1, 1, -1, 1,   1, 1, 0, 1,  1, 0,  0, 1, 0, 1,
  -1, 1, -1, 1,  0, 1, 0, 1,  0, 0,  0, 1, 0, 1,
  -1, 1, 1, 1,   0, 1, 1, 1,  0, 1,  0, 1, 0, 1,
  1, 1, -1, 1,   1, 1, 0, 1,  1, 0,  0, 1, 0, 1,

  // left
  -1, -1, 1, 1,  0, 0, 1, 1,  0, 1,  -1, 0, 0, 1,
  -1, 1, 1, 1,   0, 1, 1, 1,  1, 1,  -1, 0, 0, 1,
  -1, 1, -1, 1,  0, 1, 0, 1,  1, 0,  -1, 0, 0, 1,
  -1, -1, -1, 1, 0, 0, 0, 1,  0, 0,  -1, 0, 0, 1,
  -1, -1, 1, 1,  0, 0, 1, 1,  0, 1,  -1, 0, 0, 1,
  -1, 1, -1, 1,  0, 1, 0, 1,  1, 0,  -1, 0, 0, 1,

  // front
  1, 1, 1, 1,    1, 1, 1, 1,  0, 1,  0, 0, 1, 1,
  -1, 1, 1, 1,   0, 1, 1, 1,  1, 1,  0, 0, 1, 1,
  -1, -1, 1, 1,  0, 0, 1, 1,  1, 0,  0, 0, 1, 1,
  -1, -1, 1, 1,  0, 0, 1, 1,  1, 0,  0, 0, 1, 1,
  1, -1, 1, 1,   1, 0, 1, 1,  0, 0,  0, 0, 1, 1,
  1, 1, 1, 1,    1, 1, 1, 1,  0, 1,  0, 0, 1, 1,

  // back
  1, -1, -1, 1,  1, 0, 0, 1,  0, 1,  0, 0, -1, 1,
  -1, -1, -1, 1, 0, 0, 0, 1,  1, 1,  0, 0, -1, 1,
  -1, 1, -1, 1,  0, 1, 0, 1,  1, 0,  0, 0, -1, 1,
  1, 1, -1, 1,   1, 1, 0, 1,  0, 0,  0, 0, -1, 1,
  1, -1, -1, 1,  1, 0, 0, 1,  0, 1,  0, 0, -1, 1,
  -1, 1, -1, 1,  0, 1, 0, 1,  1, 0,  0, 0, -1, 1,
]);