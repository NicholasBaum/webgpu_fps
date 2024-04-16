//#include ./pbr_functions.wgsl

//shader renders one part of the split sum approximation for the following roughness level
override roughness : f32 = 1.0;
//mode 1 expects mipmaps on the given cubemap and uses them to compensate for insufficient rays
override mode = 0;
override SAMPLE_COUNT = 1024u;
//resolution of source cubemap
override resolution : f32 = 1024.0;

@group(0) @binding(1) var sourceTexture : texture_cube < f32>;
@group(0) @binding(2) var textureSampler : sampler;

@fragment
fn fragmentMain(@location(0) WorldPos : vec4f) -> @location(0) vec4f
{
    let N = normalize(WorldPos.xyz);

    //make the simplifying assumption that V equals R equals the normal
    let R = N;
    let V = R;

    var prefilteredColor = vec3(0.0);
    var totalWeight = 0.0;

    for(var i = 0u; i < SAMPLE_COUNT; i++)
    {
        //generates a sample vector that's biased towards the preferred alignment direction (importance sampling).
        let Xi = Hammersley(i, SAMPLE_COUNT);
        let H = ImportanceSampleGGX(Xi, N, roughness);
        let L = normalize(2.0 * dot(V, H) * H - V);

        let NdotL = max(dot(N, L), 0.0);
        //dunno why i have to invert L but it looks correct in the renders
        let corr_L = L * vec3f(1, 1, -1);
        //only sample value if NdotL > 0 and choose method
        prefilteredColor += select(vec3(0.0), select(modeOne(corr_L), modeTwo(corr_L, N, H, V, roughness), mode==1) * NdotL, NdotL > 0.0);
        totalWeight += select(0.0, NdotL, NdotL > 0.0);
    }

    prefilteredColor = prefilteredColor / totalWeight;

    return vec4(prefilteredColor, 1.0);
}

fn modeOne(L : vec3f) -> vec3f
{
    return textureSample(sourceTexture, textureSampler, L).xyz;
}

//sampling from mip map
fn modeTwo(L : vec3f, N : vec3f, H : vec3f, V : vec3f, roughness : f32) -> vec3f
{
    //sample from the environment's mip level based on roughness/pdf
    let D = DistributionGGX(N, H, roughness);
    let NdotH = max(dot(N, H), 0.0);
    let HdotV = max(dot(H, V), 0.0);
    let pdf = D * NdotH / (4.0 * HdotV) + 0.0001;

    let saTexel = 4.0 * PI / (6.0 * resolution * resolution);
    let saSample = 1.0 / (f32(SAMPLE_COUNT) * pdf + 0.0001);

    let mipLevel = select(0.5 * log2(saSample / saTexel), 0.0, roughness == 0.0);

    return textureSampleLevel(sourceTexture, textureSampler, L, mipLevel).xyz;
}
