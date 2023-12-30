struct Model
{
    transform : mat4x4 < f32>,
    normal_mat : mat4x4 < f32>,
}

struct Light
{
    lightType : vec4f,
    positionOrDirection : vec4f,
    ambientColor : vec4f,
    diffuseColor : vec4f,
    specularColor : vec4f,
}

struct Material
{
    mode : vec4f,
    ambientColor : vec4f,
    diffuseColor : vec4f,
    specularColor : vec4f,
    shininess : vec4f,
}

struct Uniforms
{
    viewProjectionMatrix : mat4x4 < f32>,
    eyePosition : vec4f,
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
    @location(0) vColor : vec4f,
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
@location(0) vColor : vec4f,
@location(1) uv : vec2f,
@location(2) worldPosition : vec4f,
@location(3) worldNormal : vec3f,
) -> @location(0) vec4f
{
    if(material.mode.x == 1)
    {
        return material.diffuseColor;
    }

    let unitNormal = normalize(worldNormal);

    let ambient = light.ambientColor.xyz * material.ambientColor.xyz;

    let lightDir = normalize(select(-light.positionOrDirection.xyz, light.positionOrDirection.xyz - worldPosition.xyz, light.lightType.x == 1));
    let intensity = max(dot(lightDir, unitNormal), 0);
    let diffuse = light.diffuseColor.xyz * material.diffuseColor.xyz * intensity;

    let viewDir = normalize(uni.eyePosition.xyz - worldPosition.xyz);
    let H = normalize(lightDir + viewDir);
    var specular = light.specularColor.xyz * material.specularColor.xyz * pow(max(dot(unitNormal, H), 0), material.shininess.x);

    //Blinn-Phong seems to have some artefacts
    //first of specular should only be rendered on surfaces that are hit by the light aka diffuse intensity>0
    //by doing this you get some strange cutoffs
    //that why an alternative ist to multiply the specular with the difusse intensity but this lead to specular highlights with weak intensity
    //var finalColor = select(ambient + diffuse, ambient + diffuse + specular, intensity > 0);
    var finalColor = ambient + diffuse + specular * intensity;
    return vec4f(finalColor, 1);

    return textureSample(myTexture, mySampler, uv);
}
