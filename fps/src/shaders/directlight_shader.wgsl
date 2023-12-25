struct Model
{
    transform : mat4x4 < f32>,
    normal_mat : mat4x4 < f32>,
}

struct Light
{
    lightType : vec4f,
    positionOrDirection : vec4f,
    color : vec4f,
    ambientColor : vec4f,
    ambientDiffuseSpectralFactor : vec4f,
}

struct Material
{
    mode : vec4f,
    diffuseColor : vec4f,
}

struct Uniforms
{
    viewProjectionMatrix : mat4x4 < f32>,
    models : array<Model>,
}

@group(0) @binding(0) var<storage> uni : Uniforms;
@group(0) @binding(1) var<uniform> light : Light;
@group(0) @binding(2) var<uniform> material : Material;
@group(0) @binding(3) var mySampler : sampler;
@group(0) @binding(4) var myTexture : texture_2d<f32>;

struct VertexOut
{
    @builtin(position) position : vec4f,
    @location(0) color : vec4f,
    @location(1) uv : vec2f,
    @location(2) normal : vec4f,
    @location(3) worldPosition : vec3f,
}

@vertex
fn vertexMain
(
@builtin(instance_index) idx : u32,
@location(0) pos : vec4f,
@location(1) color : vec4f,
@location(2) uv : vec2f,
@location(3) normal : vec4f,
) -> VertexOut
{
    let worldPos = uni.models[idx].transform * pos;
    let worldNormal = (uni.models[idx].normal_mat * vec4f(normal.xyz, 0)).xyz;
    return VertexOut(uni.viewProjectionMatrix * worldPos, color, uv, worldPos, worldNormal);
}

@fragment
fn fragmentMain
(
@builtin(position) position : vec4f,
@location(0) color : vec4f,
@location(1) uv : vec2f,
@location(2) worldPosition : vec4f,
@location(3) normal : vec3f,
) -> @location(0) vec4f
{
    if(material.mode.x == 1)
    {
        return material.diffuseColor;
    }
    let dir = select(-light.positionOrDirection.xyz, light.positionOrDirection.xyz - worldPosition.xyz, light.lightType.x == 1);
    let lightColor = light.color.xyz;
    let intensity = dot(dir, normal) / (length(dir) * length(normal));
    return color * vec4f(lightColor * intensity * color.xyz, 1.0);

    return textureSample(myTexture, mySampler, uv);
}
