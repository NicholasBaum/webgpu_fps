//#include ./pbr_functions.wgsl
override roughness : f32 = 1.0;

//TODO
//the alternative mode needs a environment cubemap with mimaps
//the per face resolution variable needs to be forwarded from the ts side i think
const mode = 1;

@group(0) @binding(1) var sourceTexture : texture_cube < f32>;
@group(0) @binding(2) var textureSampler : sampler;

@fragment
fn fragmentMain(@location(0) WorldPos : vec4f) -> @location(0) vec4f
{
    let N = normalize(WorldPos.xyz);

    //make the simplifying assumption that V equals R equals the normal
    let R = N;
    let V = R;

    const SAMPLE_COUNT = 1024u;
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
        prefilteredColor += select(vec3(0.0), textureSample(sourceTexture, textureSampler, L * vec3f(1, 1, -1)).xyz * NdotL, NdotL > 0.0);
        totalWeight += select(0.0, NdotL, NdotL > 0.0);

        //TODO see above
        //if(NdotL > 0.0)
        //{
            //sample from the environment's mip level based on roughness/pdf
            //let D = DistributionGGX(N, H, roughness);
            //let NdotH = max(dot(N, H), 0.0);
            //let HdotV = max(dot(H, V), 0.0);
            //let pdf = D * NdotH / (4.0 * HdotV) + 0.0001;
            //resolution of source cubemap (per face)
            //let resolution = 512.0;
            //let saTexel = 4.0 * PI / (6.0 * resolution * resolution);
            //let saSample = 1.0 / (f32(SAMPLE_COUNT) * pdf + 0.0001);

            //let mipLevel = select(0.5 * log2(saSample / saTexel), 0.0, roughness == 0.0);

            //prefilteredColor += textureSampleLevel(sourceTexture, textureSampler, L, mipLevel).xyz * NdotL;
            //totalWeight += NdotL;
        //}
    }
    prefilteredColor = prefilteredColor / totalWeight;

    return vec4(prefilteredColor, 1.0);
}