override canvasWidth : f32 = 1920.0;
override canvasHeight : f32 = 1080.0;

@group(0) @binding(0) var textureMap : texture_depth_2d;

@vertex
fn vertexMain(@location(0) position : vec4f) -> @builtin(position) vec4f {
    return position;
}

@fragment
fn fragmentMain(@builtin(position) fragCoord : vec4f)
-> @location(0) vec4f {
    //can't use sampler_comparison as they only return 0 or 1
    //other sampler don't seem to work
    //got to calculate pixel indices manually
    let dx = f32(textureDimensions(textureMap, 0).x);
    let textureScreenRatio = vec2f(dx / canvasWidth, dx / canvasHeight);
    let depthValue = textureLoad(textureMap, vec2 < i32 > (floor(fragCoord.xy * textureScreenRatio)), 0);
    return vec4 < f32 > (depthValue, depthValue, depthValue, 1.0);
}
