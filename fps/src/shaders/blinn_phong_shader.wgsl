struct Instance
{
    transform : mat4x4 < f32>,
    normal_mat : mat4x4 < f32>,
}

struct Light
{
    mode : vec4f,
    positionOrDirection : vec4f,
    ambientColor : vec4f,
    diffuseColor : vec4f,
    specularColor : vec4f,
    shadow_mat : mat4x4 < f32>,
}

struct Material
{
    mode : vec4f,
    ambientColor : vec4f,
    specularColor : vec4f,
    shininess : vec4f,
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
@group(0) @binding(4) var ambientTexture : texture_2d<f32>;
@group(0) @binding(5) var diffuseTexture : texture_2d<f32>;
@group(0) @binding(6) var specularTexture : texture_2d<f32>;
@group(0) @binding(8) var shadowMap : texture_depth_2d;
@group(0) @binding(9) var shadowMapSampler : sampler_comparison;

override shadowMapSize : f32 = 1024.0;

struct VertexOut
{
    @builtin(position) position : vec4f,
    @location(0) vColor : vec4f,
    @location(1) uv : vec2f,
    @location(2) worldPosition : vec4f,
    @location(3) worldNormal : vec3f,
    @location(4) shadowPos : vec3f,
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
    let worldPos = models[idx].transform * pos;
    let worldNormal = (models[idx].normal_mat * vec4f(normal.xyz, 0)).xyz;

    let shadowPos = uni.lights[0].shadow_mat * worldPos;//potentially 0 if no shadowmap exists
    let shadowPosUV = vec3(shadowPos.xy * vec2(0.5, -0.5) + vec2(0.5), shadowPos.z);
    return VertexOut(uni.viewProjectionMatrix * worldPos, color, uv, worldPos, worldNormal, shadowPosUV);
}

@fragment
fn fragmentMain
(
@builtin(position) position : vec4f,
@location(0) vColor : vec4f,
@location(1) uv : vec2f,
@location(2) worldPosition : vec4f,
@location(3) worldNormal : vec3f,
@location(4) shadowPos : vec3f,
) -> @location(0) vec4f
{
    let uv_tiled = vec2f(material.mode.z * uv.x, material.mode.w * uv.y);
    return calcAllLights(uv_tiled, worldPosition, worldNormal, shadowPos);
}

fn calcAllLights(uv : vec2f, worldPosition : vec4f, normal : vec3f, shadowPos : vec3f) -> vec4f
{
    let ambientColor = textureSample(ambientTexture, textureSampler, uv).xyz;
    let diffuseColor = textureSample(diffuseTexture, textureSampler, uv).xyz;
    let specularColor = textureSample(specularTexture, textureSampler, uv).xyz;

    let lightsCount = i32(arrayLength(&uni.lights));

    var finalColor = vec4f(0, 0, 0, 1);

    for(var i = 0; i < lightsCount; i++)
    {
        finalColor += calcLight(uni.lights[i], worldPosition, normal, ambientColor, diffuseColor, specularColor, shadowPos);
    }
    return finalColor;
}

fn calcLight(light : Light, worldPosition : vec4f, worldNormal : vec3f, ambientColor : vec3f, diffuseColor : vec3f, specularColor : vec3f, shadowPos : vec3f) -> vec4f
{
    let unitNormal = normalize(worldNormal);

    let ambient = light.ambientColor.xyz * ambientColor;

    let fragToLight = light.positionOrDirection.xyz - worldPosition.xyz;
    //DirectLight=0; PointLight=1
    let lightDir = normalize(select(-light.positionOrDirection.xyz, fragToLight, light.mode.x == 1));
    //use falloff
    let lightSqrDist = select(1, dot(fragToLight, fragToLight), light.mode.x == 1 && light.mode.y == 1);
    let intensity = max(dot(lightDir, unitNormal), 0);
    let diffuse = light.diffuseColor.xyz * diffuseColor * intensity / lightSqrDist;

    let viewDir = normalize(uni.cameraPosition.xyz - worldPosition.xyz);
    let H = normalize(lightDir + viewDir);
    let specular = light.specularColor.xyz * specularColor * pow(max(dot(unitNormal, H), 0), material.shininess.x) / lightSqrDist;

    //shadow map
    var visibility = 1.0;
    if(light.mode.z>-1.0)
    {
        const limit = 0.0005;
        let bias = max(limit * 10 * (1.0 - dot(unitNormal, lightDir)), limit);
        visibility = textureSampleCompare(shadowMap, shadowMapSampler, shadowPos.xy, shadowPos.z - limit);
    }

    //Blinn-Phong seems to have some artefacts
    //first of specular should only be rendered on surfaces that are hit by the light aka diffuse intensity>0
    //by doing this you get some strange cutoffs
    //that why an alternative ist to multiply the specular with the difusse intensity but this lead to specular highlights with weak intensity
    //var finalColor = select(ambient + diffuse, ambient + diffuse + specular, intensity > 0);
    var finalColor = ambient + (diffuse + specular * intensity) * visibility;
    finalColor = select(finalColor, diffuseColor, material.mode.x == 1);
    finalColor = select(finalColor, normalize(worldNormal.xyz) * 0.5 + 0.5, material.mode.x == 2);
    return vec4f(finalColor, 1);
}
