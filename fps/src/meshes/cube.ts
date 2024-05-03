// cube where every triangle is defined separatly
// as normals are defined per vertex defining it with 8 vertices only would lead to unuseable interpolated normals

export const CUBE_TOPOLOGY  : GPUPrimitiveTopology = "triangle-list";
export const CUBE_VERTEX_COUNT: number = 36;
export const CUBE_VERTEX_SIZE: number = 4*10;
export const CUBE_VERTEX_BUFFER_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: 40,
  attributes: [
      {
          // position
          format: "float32x4",
          offset: 0,
          shaderLocation: 0,
      },
      {
          // uv
          format: "float32x2",
          offset: 16,
          shaderLocation: 1,
      },
      {
          // normal
          format: "float32x4",
          offset: 24,
          shaderLocation: 2,
      }
  ]
};

// prettier-ignore
export const CUBE_VERTEX_ARRAY = new Float32Array([
  // float4       float2 float4
  // position     uv     normal
  // bottom
  1, -1, 1, 1,    0, 1,  0, -1, 0, 1,
  -1, -1, 1, 1,   1, 1,  0, -1, 0, 1,
  -1, -1, -1, 1,  1, 0,  0, -1, 0, 1,
  1, -1, -1, 1,   0, 0,  0, -1, 0, 1,
  1, -1, 1, 1,    0, 1,  0, -1, 0, 1,
  -1, -1, -1, 1,  1, 0,  0, -1, 0, 1,

  // right
  1, 1, 1, 1,     0, 1,  1, 0, 0, 1,
  1, -1, 1, 1,    1, 1,  1, 0, 0, 1,
  1, -1, -1, 1,   1, 0,  1, 0, 0, 1,
  1, 1, -1, 1,    0, 0,  1, 0, 0, 1,
  1, 1, 1, 1,     0, 1,  1, 0, 0, 1,
  1, -1, -1, 1,   1, 0,  1, 0, 0, 1,

  // top
  -1, 1, 1, 1,    0, 1,  0, 1, 0, 1,
  1, 1, 1, 1,     1, 1,  0, 1, 0, 1,
  1, 1, -1, 1,    1, 0,  0, 1, 0, 1,
  -1, 1, -1, 1,   0, 0,  0, 1, 0, 1,
  -1, 1, 1, 1,    0, 1,  0, 1, 0, 1,
  1, 1, -1, 1,    1, 0,  0, 1, 0, 1,

  // left
  -1, -1, 1, 1,   0, 1,  -1, 0, 0, 1,
  -1, 1, 1, 1,    1, 1,  -1, 0, 0, 1,
  -1, 1, -1, 1,   1, 0,  -1, 0, 0, 1,
  -1, -1, -1, 1,  0, 0,  -1, 0, 0, 1,
  -1, -1, 1, 1,   0, 1,  -1, 0, 0, 1,
  -1, 1, -1, 1,   1, 0,  -1, 0, 0, 1,

  // front
  1, 1, 1, 1,     0, 1,  0, 0, 1, 1,
  -1, 1, 1, 1,    1, 1,  0, 0, 1, 1,
  -1, -1, 1, 1,   1, 0,  0, 0, 1, 1,
  -1, -1, 1, 1,   1, 0,  0, 0, 1, 1,
  1, -1, 1, 1,    0, 0,  0, 0, 1, 1,
  1, 1, 1, 1,     0, 1,  0, 0, 1, 1,

  // back
  1, -1, -1, 1,   0, 1,  0, 0, -1, 1,
  -1, -1, -1, 1,  1, 1,  0, 0, -1, 1,
  -1, 1, -1, 1,   1, 0,  0, 0, -1, 1,
  1, 1, -1, 1,    0, 0,  0, 0, -1, 1,
  1, -1, -1, 1,   0, 1,  0, 0, -1, 1,
  -1, 1, -1, 1,   1, 0,  0, 0, -1, 1,
]);