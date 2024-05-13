import pbr_functions from "../../shaders/pbr_functions.wgsl"

// this map actually only depends on the BRDF model your using e.g. GGX, Torence etc.
export async function createBrdfMapImp_compute(device: GPUDevice, size: number = 128): Promise<GPUTexture> {
    const format = 'rgba8unorm';

    // renderpass
    let target = device.createTexture({
        size: [size, size, 1],
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
        format: format,
    });

    const module = device.createShaderModule({ code: SHADER(format) });

    const pipeline = device.createComputePipeline({
        label: 'brdf compute pipeline',
        layout: 'auto',
        compute: {
            module,
            entryPoint: 'main',
        },
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: target.createView() },
        ],
    });

    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(size / 16), Math.ceil(size / 16))
    pass.end();

    // Todo: check if this is really necessary, the only reason im doing this is 
    let finalTarget = attachCopyGpuTexture(device, enc, target);
    device.queue.submit([enc.finish(pass)]);
    target.destroy();
    return finalTarget;
}

function attachCopyGpuTexture(device: GPUDevice, encoder: GPUCommandEncoder, source: GPUTexture): GPUTexture {
    let size = [source.width, source.height, source.depthOrArrayLayers];
    let target = device.createTexture({ size, format: source.format, usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING });
    encoder.copyTextureToTexture({
        texture: source,
        mipLevel: 0,
        origin: [0, 0, 0],
        aspect: "all"
    }, {
        texture: target,
        mipLevel: 0,
        origin: [0, 0, 0],
        aspect: "all"
    }, size);
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