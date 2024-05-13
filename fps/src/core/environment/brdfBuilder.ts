import pbr_functions from "../../shaders/pbr_functions.wgsl"
import { createCompPipe, create2dSourceTexture } from "../compute/computeBuilder";
import { BindGroupBuilder } from "../renderer/bindGroupBuilder";

// this map actually only depends on the BRDF model your using e.g. GGX, Torence etc.
export async function createBrdf(device: GPUDevice, size: number = 128): Promise<GPUTexture> {
    const format = 'rgba8unorm';
    const target = create2dSourceTexture(device, size, format);
    const pipe = await createCompPipe(device, SHADER(format), 'brdf compute pipeline');

    const bg = new BindGroupBuilder(device, pipe)
        .addTexture(target.createView())
        .createBindGroup();

    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pipe);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(size / 16), Math.ceil(size / 16))
    pass.end();
    device.queue.submit([enc.finish(pass)]);

    return target;
}


const SHADER = (format: string) => `

@group(0) @binding(0) var brdf: texture_storage_2d<${format}, write>;

@compute @workgroup_size(16, 16) 
fn main(@builtin(global_invocation_id) id: vec3u) 
{
    let size = textureDimensions(brdf);
    if(any(id.xy >= size))
    {
        return;
    }
    // offset by half a pixel, to prevent a division by 0 in IntegrateBrdf
    let u = (f32(id.x) + 0.5) / f32(size.x);
    let v = (f32(id.y) + 0.5) / f32(size.y);
   
    textureStore(brdf, id.xy, vec4f(IntegrateBRDF(u, v), 0, 1));
}

fn IntegrateBRDF(NdotV : f32, roughness : f32) -> vec2f
{
    var V = vec3f();
    V.x = sqrt(1.0 - NdotV * NdotV);
    V.y = 0.0;
    V.z = NdotV;

    var A = 0.0;
    var B = 0.0;

    let N = vec3(0.0, 0.0, 1.0);

    const SAMPLE_COUNT = 1024u;
    for(var i = 0u; i < SAMPLE_COUNT; i++)
    {
        //generates a sample vector that's biased towards the
        //preferred alignment direction (importance sampling).
        let Xi = Hammersley(i, SAMPLE_COUNT);
        let H = ImportanceSampleGGX(Xi, N, roughness);
        let L = normalize(2.0 * dot(V, H) * H - V);

        let NdotL = max(L.z, 0.0);
        let NdotH = max(H.z, 0.0);
        let VdotH = max(dot(V, H), 0.0);

        if(NdotL > 0.0)
        {
            let G = GeometrySmith(N, V, L, roughness);
            let G_Vis = (G * VdotH) / (NdotH * NdotV);
            let Fc = pow(1.0 - VdotH, 5.0);

            A += (1.0 - Fc) * G_Vis;
            B += Fc * G_Vis;
        }
    }
    A /= f32(SAMPLE_COUNT);
    B /= f32(SAMPLE_COUNT);
    return vec2(A, B);
}
`+ pbr_functions;