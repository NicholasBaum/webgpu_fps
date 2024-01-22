override shadowMapSize : f32 = 1024.0;
override screenWidth : f32 = 1920.0;
override screenHeight : f32 = 1080.0;

@group(0) @binding(0) var textureMap : texture_depth_2d;

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
    //can't use sampler_comparison as they only return 0 or 1
    //other sampler don't seem to work
    //got to calculate pixel indices manually
    let textureScreenRatio = vec2f(shadowMapSize / screenWidth, shadowMapSize / screenHeight);
    let depthValue = textureLoad(textureMap, vec2 < i32 > (floor(fragCoord.xy * textureScreenRatio)), 0);
    return vec4 < f32 > (depthValue, depthValue, depthValue, 1.0);
}
