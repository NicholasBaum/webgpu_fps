export const simple_shader: GPUShaderModuleDescriptor = {
    label: "simple shader",
    code: `

    struct Uniforms
    {
        // model view transform
        transform : mat4x4<f32>,
    }
    
    @group(0) @binding(0) var<uniform> uni: Uniforms;

    struct VertexOut
    {
        @builtin(position) position : vec4f,
        @location(0) color : vec4f,
        @location(1) uv : vec2f,
    }

    @vertex
    fn vertexMain
    (
        @builtin(instance_index) idx : u32,
        @location(0) pos : vec4f,
        @location(1) color : vec4f,
        @location(2) uv : vec2f
    )   -> VertexOut 
    {
        if(idx == 0)
        {
            return VertexOut(uni.transform * pos+ vec4f(0.7, 0, 0, 0),  color, uv);
        }
        else
        {
            return VertexOut(uni.transform * pos,  color, uv);
        }
    }

    @fragment
    fn fragmentMain
    (
        @location(0) color : vec4f,
        @location(1) uv : vec2f
    )   -> @location(0) vec4f 
    {
        return color;
    }
    `
}