export const DEF_TOPOLOGY: GPUPrimitiveTopology = "triangle-list";
export const DEF_VERTEX_SIZE: number = 4 * 10;
export const DEF_VERTEX_BUFFER_LAYOUT: GPUVertexBufferLayout = {
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


export const DEF_LAYOUT_SIZE_FLOAT = 10;
export const DEF_POSITION_INDEX_FLOAT = 0;
export const DEF_UV_INDEX_FLOAT = 4;