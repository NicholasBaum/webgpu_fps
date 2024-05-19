//#include ./pbr_functions.wgsl
//replace format
//shader renders one part of the split sum approximation for the following roughness level
override roughness : f32 = 0.0;

override SAMPLE_COUNT = 1024u;


@group(0) @binding(0) var sourceTexture : texture_2d_array<f32>;
@group(0) @binding(1) var targetTexture : texture_storage_2d_array<{{format}}, write>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) id : vec3u)
{
    let cubeSide = id.z;
    let size = textureDimensions(targetTexture);
    let sourceTextureSize = textureDimensions(sourceTexture);
    if(any(id.xy >= size.xy))
    {
        return;
    }
    //offset by 0.5 to sample at fragment center not border
    let uv = (vec2f(id.xy) + 0.5) / vec2f(size.xy);
    let dir = getDir(cubeSide, uv);
    let N = normalize(dir);

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
        let sample = cubemapSampler(sourceTexture, sourceTextureSize.xy, L).xyz;
        //only sample value if NdotL > 0
        prefilteredColor += select(vec3(0.0), sample * NdotL, NdotL > 0.0);
        totalWeight += select(0.0, NdotL, NdotL > 0.0);
    }

    prefilteredColor = prefilteredColor / totalWeight;

    textureStore(targetTexture, id.xy, cubeSide, vec4f(prefilteredColor, 1));
}

fn getDir(cubeSide : u32, uv_in : vec2f) -> vec3f
{
    let uv = uv_in - 0.5;

    switch(cubeSide)
    {
        case 0 :
        {
            return vec3f(0.5, uv.y, -uv.x);
        }
        case 1 :
        {
            return vec3f(-0.5, uv.y, uv.x);
        }
        case 2 :
        {
            return vec3f(uv.x, -0.5, uv.y);
        }
        case 3 :
        {
            return vec3f(uv.x, 0.5, -uv.y);
        }
        case 4 :
        {
            return vec3f(uv.x, uv.y, 0.5);
        }
        case 5 :
        {
            return vec3f(-uv.x, uv.y, -0.5);
        }
        default :
        {
            return vec3f(0);
        }
    }
}

fn cubemapSampler(tex : texture_2d_array<f32>, textureDim : vec2u, dir : vec3f) -> vec4f{
    //Normalize the direction vector
    let direction = normalize(dir);

    //Calculate the major axis
    let absDir = abs(direction);
    var majorAxis = select(1, 0, absDir.x > absDir.y);
    majorAxis = select(majorAxis, 2, absDir.z > absDir[majorAxis]);

    //Select the appropriate face and remap the direction
    var uvCoords = vec2f(0, 0);
    var layer = 0;
    var scale = 0.0;
    if (majorAxis == 0)
    {
        //dividing by absDir.x lets the direction vector intersect/touch the corresponding face
        //0.5 is just for the typical [-1,1] to [0,1] transformation
        scale = 0.5 / absDir.x;
        if (direction.x > 0.0)
        {
            uvCoords = vec2(-direction.z, direction.y);
        }
        else
        {
            layer = 1;
            uvCoords = vec2(direction.z, direction.y);
        }
    }
    else if (majorAxis == 1)
    {
        scale = 0.5 / absDir.y;
        if (direction.y > 0.0)
        {
            layer = 3;
            uvCoords = vec2(direction.x, -direction.z);
        }
        else
        {
            layer = 2;
            uvCoords = vec2(direction.x, direction.z);
        }
    }
    else {
        scale = 0.5 / absDir.z;
        if (direction.z > 0.0)
        {
            layer = 4;
            uvCoords = vec2(direction.x, direction.y);
        }
        else
        {
            layer = 5;
            uvCoords = vec2(-direction.x, direction.y);
        }
    }

    uvCoords = uvCoords * scale + 0.5;
    return textureLoad(tex, vec2u(uvCoords * vec2f(textureDim)), layer, 0);
}
