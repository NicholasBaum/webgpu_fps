struct Instance
{
    transform : mat4x4 < f32>,
    normal_mat : mat4x4 < f32>,
}

@group(0) @binding(0) var<storage, read> instances : array<Instance>;
@group(0) @binding(1) var<uniform> lightView : mat4x4 < f32>;

@vertex
fn vertexMain(@builtin(instance_index) idx : u32, @location(0) position : vec3 < f32>) -> @builtin(position) vec4 < f32>
{
    return lightView * instances[idx].transform * vec4(position, 1);
}
