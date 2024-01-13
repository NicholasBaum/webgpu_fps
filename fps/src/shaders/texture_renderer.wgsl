@group(0) @binding(0) var textureSampler : sampler;
//@group(0) @binding(1) var textureMap : texture_2d<f32>;
@group(0) @binding(1) var textureMap : texture_depth_2d;


struct VertexOutput {
    @builtin(position) fragCoord : vec4f,
};

@vertex
fn vertexMain(@location(0) position : vec4f)
-> VertexOutput {
    return VertexOutput(position);
}

@fragment
fn fragmentMain(@builtin(position) fragCoord : vec4f)
-> @location(0) vec4f {
    let depthValue = textureLoad(textureMap, vec2 < i32 > (floor(fragCoord.xy)), 0);
    return vec4 < f32 > (depthValue, depthValue, depthValue, 1.0);
}
