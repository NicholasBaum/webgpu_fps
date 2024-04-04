override roughness : f32 = 1.0;
const PI = 3.14159265359;

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
        prefilteredColor += select(vec3(0.0), textureSample(sourceTexture, textureSampler, L*vec3f(1,1,-1)).xyz * NdotL, NdotL > 0.0);
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

fn DistributionGGX(N : vec3f, H : vec3f, roughness : f32) -> f32
{
    let a = roughness * roughness;
    let a2 = a * a;
    let NdotH = max(dot(N, H), 0.0);
    let NdotH2 = NdotH * NdotH;

    let nom = a2;
    var denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return nom / denom;
}

//http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
//efficient VanDerCorpus calculation.
fn RadicalInverse_VdC(bits_in : u32) -> f32
{
    var bits = (bits_in << 16u) | (bits_in >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    return f32(bits) / 0x100000000;
}

fn Hammersley(i : u32, N : u32) -> vec2f
{
    return vec2(f32(i) / f32(N), RadicalInverse_VdC(i));
}

fn ImportanceSampleGGX(Xi : vec2f, N : vec3f, roughness : f32) -> vec3f
{
    let a = roughness * roughness;

    let phi = 2.0 * PI * Xi.x;
    let cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a * a - 1.0) * Xi.y));
    let sinTheta = sqrt(1.0 - cosTheta * cosTheta);

    //from spherical coordinates to cartesian coordinates - halfway vector
    var H : vec3f = vec3f();
    H.x = cos(phi) * sinTheta;
    H.y = sin(phi) * sinTheta;
    H.z = cosTheta;

    //from tangent-space H vector to world-space sample vector
    let up = select(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), abs(N.z) < 0.999);
    let tangent = normalize(cross(up, N));
    let bitangent = cross(N, tangent);

    let sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
    return normalize(sampleVec);
}
