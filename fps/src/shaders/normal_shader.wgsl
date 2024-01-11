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
@group(0) @binding(7) var normalTexture : texture_2d<f32>;

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
    let lightsCount = i32(arrayLength(&uni.lights));
    let t2w = mat3x3 < f32 > (normalize(worldTangent), normalize(worldBitangent), normalize(worldNormal));
    //transform normal from normal map from its tangent space into worldspace
    var normal = normalize(t2w * (textureSample(normalTexture, textureSampler, uv).xyz * 2-1));
    normal = select(normal, worldNormal, material.mode.y==1);
    var finalColor = vec4f(0, 0, 0, 1);
    for(var i = 0; i < lightsCount; i++)
    {
        finalColor += calcLight(uni.lights[i], uv, worldPosition, normal);
    }
    return finalColor;
}

fn calcLight(light : Light, uv : vec2f, worldPosition : vec4f, worldNormal : vec3f) -> vec4f
{
    let ambientColor = textureSample(ambientTexture, textureSampler, uv).xyz;
    let diffuseColor = textureSample(diffuseTexture, textureSampler, uv).xyz;
    let specularColor = textureSample(specularTexture, textureSampler, uv).xyz;
    let unitNormal = normalize(worldNormal);

    let ambient = light.ambientColor.xyz * ambientColor;

    let fragToLight = light.positionOrDirection.xyz - worldPosition.xyz;
    //DirectLight=0; PointLight=1
    let lightDir = normalize(select(-light.positionOrDirection.xyz, fragToLight, light.mode.x == 1));
    // use falloff
    let lightSqrDist = select(1, dot(fragToLight, fragToLight), light.mode.x == 1 && light.mode.y == 1);
    let intensity = max(dot(lightDir, unitNormal), 0);
    let diffuse = light.diffuseColor.xyz * diffuseColor * intensity / lightSqrDist;

    let viewDir = normalize(uni.cameraPosition.xyz - worldPosition.xyz);
    let H = normalize(lightDir + viewDir);
    let specular = light.specularColor.xyz * specularColor * pow(max(dot(unitNormal, H), 0), material.shininess.x) / lightSqrDist;

    var finalColor = ambient + diffuse + specular * intensity;
    finalColor = select(finalColor, diffuseColor, material.mode.x == 1);
    finalColor = select(finalColor, normalize(worldNormal.xyz) * 0.5 + 0.5, material.mode.x == 2);
    return vec4f(finalColor, 1);
}