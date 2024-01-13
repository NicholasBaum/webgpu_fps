struct Instance
{
    transform : mat4x4 < f32>,
    normal_mat : mat4x4 < f32>,
}

@group(0) @binding(0) var<uniform> model : Instance;
@group(0) @binding(1) var<uniform> lightView : mat4x4 < f32>;

@vertex
fn vertexMain(@location(0) position : vec3 < f32>) -> @builtin(position) vec4 < f32>
{
    return lightView * model.transform * vec4(position, 1);
}
