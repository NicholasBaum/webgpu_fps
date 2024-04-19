
struct Instance
{
    transform : mat4x4 < f32>,
    normal_mat : mat4x4 < f32>,
}

struct Material
{
    mode : vec4f,
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
    settings : vec4f,
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

@group(2) @binding(0) var environmentMapSampler : sampler;
@group(2) @binding(1) var irradianceMap : texture_cube < f32>;
@group(2) @binding(2) var specularMap : texture_cube < f32>;
@group(2) @binding(3) var brdfMap : texture_2d<f32>;


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
    let albedo = textureSample(albedoTexture, textureSampler, uv).xyz;
    let metal = textureSample(metalTexture, textureSampler, uv).r;
    let roughness = textureSample(roughnessTexture, textureSampler, uv).r;

    let lightsCount = i32(arrayLength(&uni.lights));

    var finalColor = vec3f(0);

    for(var i = 0; i < lightsCount; i++)
    {
        finalColor += calcLight(worldPosition.xyz, worldNormal, uni.lights[i], albedo, metal, roughness);
    }

    if(uni.settings.x == 1)
    {
        let ao = textureSample(ambientOcclusionTexture, textureSampler, uv).r;
        finalColor += calcEnvironmentLight(worldPosition, worldNormal, ao, albedo, metal, roughness);
    }

    //gamma encode
    finalColor = pow(finalColor, vec3(1.0 / 2.2));

    return vec4f(finalColor, 1);
}

fn calcEnvironmentLight(worldPosition : vec4f, worldNormal : vec3f, ao : f32, albedo : vec3f, metal : f32, roughness : f32) -> vec3f
{
    //can be optimize as its calculated per light again i think
    let N = normalize(worldNormal);
    let V = normalize(uni.cameraPosition.xyz - worldPosition.xyz);
    var F0 = vec3(0.04);
    F0 = (1.0 - metal) * F0 + metal * albedo;
    let F = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);
    let kS = F;
    var kD = 1.0 - kS;
    kD *= 1.0 - metal;

    //not sure why the reflectance direction is N here
    //but i think because the irradiance map is built on the normal direction because the viewing direction isnt known when building it
    let irradiance = textureSample(irradianceMap, environmentMapSampler, N).xyz;
    let diffuse = irradiance * albedo;

    //specular
    let MaxRoughnessMipLevel = f32(textureNumLevels(specularMap)) - 1;
    let R = reflect(-V, N);
    let prefilteredColor = textureSampleLevel(specularMap, environmentMapSampler, R, roughness * MaxRoughnessMipLevel).xyz;
    let envBRDF = textureSample(brdfMap, environmentMapSampler, vec2(max(dot(N, V), 0.0), roughness)).xy;
    let specular = prefilteredColor * (F * envBRDF.x + envBRDF.y);

    //precalculated environment map light
    let ambient = (kD * diffuse + specular) * ao;
    return ambient;
}

fn calcLight(worldPos : vec3f, normal : vec3f, light : Light, albedo : vec3f, metal : f32, roughness : f32) -> vec3f
{
    let lightPos = light.position.xyz;
    let lightColor = light.diffuseColor.xyz;
    let fragToLight = select(lightPos - worldPos, -light.direction.xyz, light.mode.x==0);

    //mode.x: DirectLight=0; PointLight=1; TargetLight=2
    //mode.y: use falloff
    var falloffFactor = select(1.0, 1.0 / dot(fragToLight, fragToLight), light.mode.x!=0 && light.mode.y == 1);
    //spot light
    if(light.mode.x==2)
    {
        let cutoff = light.mode.w;
        let spot = dot(normalize(light.direction.xyz), normalize(-fragToLight));
        falloffFactor = select(0.0, 1.0, spot > cutoff);
    }
    let radiance : vec3f = lightColor * falloffFactor;

    //cook-torrance brdf
    var F0 = vec3(0.04);
    F0 = (1.0 - metal) * F0 + metal * albedo;

    let L = normalize(fragToLight);
    let N = normalize(normal);
    let V = normalize(uni.cameraPosition.xyz - worldPos);
    let H = normalize(V + L);
    let NDF = DistributionGGX(N, H, roughness);
    let G = GeometrySmith(N, V, L, roughness);
    let F : vec3f = fresnelSchlick(max(dot(H, V), 0.0), F0);

    //specular
    let numerator : vec3f = NDF * G * F;
    let denominator : f32 = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
    let specular : vec3f = numerator / denominator;

    //diffuse
    let kS = F;
    var kD : vec3f = vec3(1.0) - kS;
    kD *= 1.0 - metal;
    let diffuse = kD * albedo / PI;

    //shadow factor
    let visibility = getShadowFactor(light, worldPos, N);

    //add to outgoing radiance Lo
    let NdotL = max(dot(N, L), 0.0);
    return (diffuse + specular) * radiance * NdotL * visibility;
}

fn getShadowFactor(light : Light, worldPos : vec3f, unitNormal : vec3f) -> f32
{
    let compileDummy = shadowMapSize;
    const offset = 0.5;
    var shadowPos = light.shadow_mat * vec4f((offset * unitNormal + worldPos), 1);
    shadowPos /= shadowPos.w;
    let shadowPosUV = vec3(shadowPos.xy * vec2(0.5, -0.5) + vec2(0.5), shadowPos.z);

    return select(textureSampleCompareLevel(shadowMaps, shadowMapSampler, shadowPosUV.xy, u32(light.mode.z), shadowPosUV.z), 1.0, i32(light.mode.z)==-1);
}

////////////////////////////////
//No Normals Entrypoint Block //
/////////////////////////////////

struct VertexOut_alt
{
    @builtin(position) position : vec4f,
    @location(0) uv : vec2f,
    @location(1) worldPosition : vec4f,
    @location(2) worldNormal : vec3f,
}

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
