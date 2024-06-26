// cube where every triangle is defined separatly
// as normals are defined per vertex defining it with 8 vertices only would lead to unuseable interpolated normals

export const CUBE_VERTEX_COUNT: number = 36;

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