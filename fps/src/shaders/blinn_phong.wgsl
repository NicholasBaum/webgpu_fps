struct Instance
{
    transform : mat4x4 < f32>,
    normal_mat : mat4x4 < f32>,
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

struct BlinnMaterial
{
    mode : vec4f,
    ambientColor : vec4f,
    specularColor : vec4f,
    shininess : vec4f,
}

struct SceneSettings
{
    viewProjectionMatrix : mat4x4 < f32>,
    cameraPosition : vec4f,
    settings : vec4f,
    lights : array<Light>,
}

@group(0) @binding(0) var<storage, read> models : array<Instance>;
@group(0) @binding(1) var<storage, read> uni : SceneSettings;

@group(1) @binding(0) var<uniform> material : BlinnMaterial;
@group(1) @binding(1) var textureSampler : sampler;
@group(1) @binding(2) var ambientTexture : texture_2d<f32>;
@group(1) @binding(3) var diffuseTexture : texture_2d<f32>;
@group(1) @binding(4) var specularTexture : texture_2d<f32>;
@group(1) @binding(5) var normalTexture : texture_2d<f32>;

@group(2) @binding(0) var shadowMaps : texture_depth_2d_array;
@group(2) @binding(1) var shadowMapSampler : sampler_comparison;

@group(3) @binding(0) var environmentMap : texture_cube < f32>;
@group(3) @binding(1) var environmentMapSampler : sampler;

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
@location(1) uv : vec2f,
@location(2) normal : vec4f,
@location(3) tangent : vec3f,
@location(4) bitangent : vec3f,
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

//remark 1
//wgsl doesn't support forwarding matrices or arrays to the FS as function argument
//for matrices this can be solved by forwarding the columns separatly
//for arrays i actually don't have any solution
//a fixed amount of array entries could be forwarded as separate arguments

//remark 2
//literature says the vertex shader isn't called as often as the fragment shader
//reasoning is probably that the VS runs for every vertex and 3 vertices usually belong to more than 2 fragments/pixels
//but i'm not sure if this is actually still true when using zbuffer or even when just using a high poly model

//so it might be advantageous to push calculations into the VS
//the tbn can be built in the VS and inverted by only taking the transpose because it's an orthonormal matrix
//now instead of calculating everything in world space we can take the light position/direction and the camera position
//into tangent space in the VS! and foward them to the FS

//in case of multiple lights one has to forward every light pos/dir what is problematic because arrays can't be forwarded
//this problem vanishes when using deferred shading as every light is calculated in a separate run


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
    let ambientColor = textureSample(ambientTexture, textureSampler, uv).xyz;
    let diffuseColor = textureSample(diffuseTexture, textureSampler, uv).xyz;
    let specularColor = textureSample(specularTexture, textureSampler, uv).xyz;

    let lightsCount = i32(arrayLength(&uni.lights));

    var finalColor = vec4f(0, 0, 0, 1);

    for(var i = 0; i < lightsCount; i++)
    {
        finalColor += calcLight(uni.lights[i], worldPosition, worldNormal, ambientColor, diffuseColor, specularColor);
    }
    return finalColor;
}

fn calcLight(light : Light, worldPos : vec4f, worldNormal : vec3f, ambientColor : vec3f, diffuseColor : vec3f, specularColor : vec3f) -> vec4f
{
    let unitNormal = normalize(worldNormal);

    let ambient = light.ambientColor.xyz * ambientColor;

    let fragToLight = light.position.xyz - worldPos.xyz;
    //set falloff to 1 or to frag to light distance squared
    let lightSqrDist = select(1, dot(fragToLight, fragToLight), light.mode.y == 1);
    //DirectLight=0; PointLight=1; TargetLight=2
    let lightDirInverse = normalize(select(fragToLight, -light.direction.xyz, light.mode.x == 0));

    //calc intensity, 0 if not facing light
    var intensity = max(dot(lightDirInverse, unitNormal), 0);
    //target light
    if(light.mode.x==2 && intensity!=0)
    {
        let cutoff = light.mode.w;
        let spot = dot(normalize(light.direction.xyz), normalize(-fragToLight));
        //const sharpness = 10;
        //intensity = select(0, 1 - pow((1 - spot) / (1 - cutoff), sharpness), spot > cutoff);
        intensity = select(0.0, 1.0, spot > cutoff);
    }

    //calc diffuse
    let diffuse = light.diffuseColor.xyz * diffuseColor * intensity / lightSqrDist;

    //calc specular
    let viewDir = normalize(uni.cameraPosition.xyz - worldPos.xyz);
    let H = normalize(lightDirInverse + viewDir);
    let specular = light.specularColor.xyz * specularColor * pow(max(dot(unitNormal, H), 0), material.shininess.x) / lightSqrDist;

    //shadow map

    const constOffset = 0.5;
    //let slopeFactor = 1.1 - clamp(dot(lightDirInverse, unitNormal), 0,1);
    //correct with an z adjusted texelsize value
    //let tmp = light.shadow_mat * worldPos;
    //let texelSize = (2 / shadowMapSize) * tan(coneAngle/90*3.14) * abs(tmp.z/tmp.w) * 100000.0;
    let offset = constOffset;
    var shadowPos = light.shadow_mat * (offset * vec4f(unitNormal, 0) + worldPos);
    //var shadowPos = light.shadow_mat * worldPos;//potentially 0 if no shadowmap exists
    //perspective transformations alter the w coordinate and it has to be scaled back
    //the vertex shader actually does this automatically on its output position afterwards
    shadowPos = shadowPos / shadowPos.w;
    let shadowPosUV = vec3(shadowPos.xy * vec2(0.5, -0.5) + vec2(0.5), shadowPos.z);

    let visibility = select(calcShadowVisibility(u32(light.mode.z), shadowMaps, shadowMapSampler, shadowPosUV, 0.0), 1.0, i32(light.mode.z)==-1);

    //Problem: specular higlights (artefacts) on faces that aren't even hit by light
    //Solution 1: only render specular when intensity>0 -> problem: specular highlight is cutoff
    //Solution 2: multiply specular with difuse intensity -> problem: weak specular highlights
    var finalColor = ambient + (diffuse + specular * intensity) * visibility;

    //environment reflection
    let reflV = reflect(-viewDir, unitNormal.xyz);
    // correct for left handed cubesampler
    let env = textureSample(environmentMap, environmentMapSampler, reflV*vec3f(-1,1,1));
    let reflectivness = clamp(material.shininess.y, 0, 1);

    finalColor = reflectivness * env.xyz + (1 - reflectivness) * finalColor;


    //respect other rendermodes
    finalColor = select(finalColor, diffuseColor, material.mode.x == 1);
    finalColor = select(finalColor, unitNormal.xyz * 0.5 + 0.5, material.mode.x == 2);

    return vec4f(finalColor, 1);
}

fn calcShadowVisibilitySmoothed(shadowMapIndex : u32, textureSize : f32, texture : texture_depth_2d_array,
depthSampler : sampler_comparison, shadowPosUV : vec3f, bias : f32) -> f32
{
    var visibility = 0.0;
    let pixelRatio = 1.0 / textureSize;
    for (var y = -1; y <= 1; y++)
    {
        for (var x = -1; x <= 1; x++)
        {
            let offset = vec2 < f32 > (vec2(x, y)) * pixelRatio;
            visibility += textureSampleCompareLevel(texture, depthSampler, shadowPosUV.xy + offset, shadowMapIndex, shadowPosUV.z - bias);
        }
    }
    visibility /= 9;
    //depending on the bounding box the shadow map used some fragments might be out of the shadow maps scope
    visibility = select(visibility, 1.0, shadowPosUV.x < 0 || shadowPosUV.x > 1 || shadowPosUV.y < 0 || shadowPosUV.y > 1);
    return visibility;
}

fn calcShadowVisibility(shadowMapIndex: u32, texture: texture_depth_2d_array,
depthSampler : sampler_comparison, shadowPosUV : vec3f, bias : f32) -> f32
{
    return textureSampleCompareLevel(texture, depthSampler, shadowPosUV.xy, shadowMapIndex, shadowPosUV.z - bias);
}



//no normal data/map entrypoint
struct VertexOut_alt
{
    @builtin(position) position : vec4f,
    @location(0) uv : vec2f,
    @location(1) worldPosition : vec4f,
    @location(2) worldNormal : vec3f,
}

//no normal data/map entrypoint
@vertex
fn vertexMain_alt
(
@builtin(instance_index) idx : u32,
@location(0) pos : vec4f,
@location(1) uv : vec2f,
@location(2) normal : vec4f,
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
