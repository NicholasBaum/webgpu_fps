export const simple_shader: GPUShaderModuleDescriptor = {
    label: "simple shader",
    code: `

    struct Uniforms
    {
        // model view transforms
        transforms : array<mat4x4<f32>>,
    }
    
    @group(0) @binding(0) var<storage> uni : Uniforms;
    @group(0) @binding(1) var mySampler : sampler;
    @group(0) @binding(2) var myTexture : texture_2d<f32>;

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
        return VertexOut(uni.transforms[idx]*pos, color, uv);
    }

    @fragment
    fn fragmentMain
    (
        @location(0) color : vec4f,
        @location(1) uv : vec2f
    )   -> @location(0) vec4f 
    {
        return textureSample(myTexture, mySampler, uv);
    }
    `
}