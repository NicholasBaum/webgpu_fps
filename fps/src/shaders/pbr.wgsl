
struct Instance
{
    transform : mat4x4 < f32>,
    normal_mat : mat4x4 < f32>,
}

struct Material
{
    mode : vec4f,
    ambientColor : vec4f,
    specularColor : vec4f,
    shininess : vec4f,
}

struct Light
{
    mode : vec4f,
    position : vec4f,
    direction : vec4f,
    ambientColor : vec4f,
    diffuseColor : vec4f,
    specularColor : vec4f,
    shadow_mat : mat4x4 < f32>,
}

struct CameraAndLights
{
    viewProjectionMatrix : mat4x4 < f32>,
    cameraPosition : vec4f,
    lights : array<Light>,
}

@group(0) @binding(0) var<storage, read> models : array<Instance>;
@group(0) @binding(1) var<storage, read> uni : CameraAndLights;
@group(0) @binding(2) var<uniform> material : Material;
@group(0) @binding(3) var textureSampler : sampler;
@group(0) @binding(4) var ambientOcclusionTexture : texture_2d<f32>;
@group(0) @binding(5) var albedoTexture : texture_2d<f32>;
@group(0) @binding(6) var metalTexture : texture_2d<f32>;
@group(0) @binding(7) var roughnessTexture : texture_2d<f32>;
@group(0) @binding(8) var normalTexture : texture_2d<f32>;

override shadowMapSize : f32 = 1024.0;
@group(1) @binding(0) var shadowMaps : texture_depth_2d_array;
@group(1) @binding(1) var shadowMapSampler : sampler_comparison;

@group(2) @binding(0) var environmentMap : texture_cube < f32>;
@group(2) @binding(1) var environmentMapSampler : sampler;

struct VertexOut
{
    //clip space position
    @builtin(position) position : vec4f,
    @location(0) uv : vec2f,
    @location(1) worldPosition : vec4f,
    @location(2) worldNormal : vec3f,
    @location(3) worldTangent : vec3f,
    @location(4) worldBitangent : vec3f,
}

@vertex
fn vertexMain
(
//all in object space
@builtin(instance_index) idx : u32,
@location(0) pos : vec4f,
@location(1) color : vec4f,
@location(2) uv : vec2f,
@location(3) normal : vec4f,
@location(4) tangent : vec3f,
@location(5) bitangent : vec3f,
) -> VertexOut
{
    let worldPos = models[idx].transform * pos;
    let clipSpacePosition = uni.viewProjectionMatrix * worldPos;
    //tangent space base in world space coordinates
    let worldNormal = (models[idx].normal_mat * vec4f(normal.xyz, 0)).xyz;
    let worldTangent = (models[idx].normal_mat * vec4f(tangent.xyz, 0)).xyz;
    let worldBitangent = (models[idx].normal_mat * vec4f(bitangent.xyz, 0)).xyz;

    return VertexOut(clipSpacePosition, uv, worldPos, worldNormal, worldTangent, worldBitangent);
}

@fragment
fn fragmentMain
(
@builtin(position) position : vec4f,
@location(0) uv : vec2f,
@location(1) worldPosition : vec4f,
@location(2) worldNormal : vec3f,
@location(3) worldTangent : vec3f,
@location(4) worldBitangent : vec3f,
) -> @location(0) vec4f
{
    let uv_tiled = vec2f(material.mode.z * uv.x, material.mode.w * uv.y);
    //transform normal from normal map from its tangent space into worldspace
    let t2w = mat3x3 < f32 > (normalize(worldTangent), normalize(worldBitangent), normalize(worldNormal));
    var worldNormalFromMap = normalize(t2w * (textureSample(normalTexture, textureSampler, uv_tiled).xyz * 2-1));
    //turn off normal map normals
    worldNormalFromMap = select(worldNormalFromMap, worldNormal, material.mode.y==1);

    return calcAllLights(uv_tiled, worldPosition, worldNormalFromMap);
}

fn calcAllLights(uv : vec2f, worldPosition : vec4f, worldNormal : vec3f) -> vec4f
{
    let compileDummy = shadowMapSize;
    //let ambientColor = textureSample(ambientTexture, textureSampler, uv).xyz;
    //let diffuseColor = textureSample(diffuseTexture, textureSampler, uv).xyz;
    //let specularColor = textureSample(specularTexture, textureSampler, uv).xyz;

    let lightsCount = i32(arrayLength(&uni.lights));

    var finalColor = vec4f(0, 0, 0, 1);

    for(var i = 0; i < lightsCount; i++)
    {
        //finalColor += calcLight(uni.lights[i], worldPosition, worldNormal, ambientColor, diffuseColor, specularColor);
    }

    //finalColor =
    return finalColor;
}

//no normal data/map entrypoint
struct VertexOut_alt
{
    @builtin(position) position : vec4f,
    @location(0) uv : vec2f,
    @location(1) worldPosition : vec4f,
    @location(2) worldNormal : vec3f,
}



////////////////////////////////
//No Normals Entrypoint Block //
/////////////////////////////////
@vertex
fn vertexMain_alt
(
@builtin(instance_index) idx : u32,
@location(0) pos : vec4f,
@location(1) color : vec4f,
@location(2) uv : vec2f,
@location(3) normal : vec4f,
) -> VertexOut_alt
{
    let worldPos = models[idx].transform * pos;
    let worldNormal = (models[idx].normal_mat * vec4f(normal.xyz, 0)).xyz;

    return VertexOut_alt(uni.viewProjectionMatrix * worldPos, uv, worldPos, worldNormal);
}

@fragment
fn fragmentMain_alt
(
@builtin(position) position : vec4f,
@location(0) uv : vec2f,
@location(1) worldPosition : vec4f,
@location(2) worldNormal : vec3f,
) -> @location(0) vec4f
{
    let uv_tiled = vec2f(material.mode.z * uv.x, material.mode.w * uv.y);
    return calcAllLights(uv_tiled, worldPosition, worldNormal);
}
