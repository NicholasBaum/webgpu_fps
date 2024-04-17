import pbr_functions from "../../shaders/pbr_functions.wgsl"

// this map actually only depends on the BRDF model your using e.g. GGX, Torence etc.
export async function createBrdfMapImp(device: GPUDevice, size: number = 128): Promise<GPUTexture> {
    const format = 'rgba8unorm';

    const quadVertexArray = new Float32Array([
        // positions // texture Coords
        -1.0, 1.0, 0.0, 0.0, 0.0,
        -1.0, -1.0, 0.0, 0.0, 1.0,
        1.0, 1.0, 0.0, 1.0, 0.0,
        1.0, -1.0, 0.0, 1.0, 1.0,
    ]);

    let quadBuffer = device.createBuffer({
        size: quadVertexArray.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(quadBuffer, 0, quadVertexArray);

    // renderpass
    let target = device.createTexture({
        size: [size, size, 1],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING,
        format: format,
    });

    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({ label: "brdf texture builder", code: SHADER }),
            entryPoint: 'vertexBrdf',
            buffers: [
                {
                    arrayStride: 20,
                    attributes: [
                        {
                            // position
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x3',
                        },
                        {
                            // uv
                            shaderLocation: 1,
                            offset: 12,
                            format: 'float32x2',
                        },
                    ],
                },
            ],
        },
        fragment: {
            module: device.createShaderModule({ label: "brdf texture builder", code: SHADER }),
            entryPoint: 'fragmentBrdf',
            targets: [{
                format: format,
            }],
        },
        primitive: {
            topology: 'triangle-strip',
        },
    });

    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({
        colorAttachments: [{
            view: target.createView({}),
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
        }],
    });
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, quadBuffer);
    pass.draw(4);
    pass.end();
    device.queue.submit([enc.finish(pass)]);
    return target;
}

const SHADER = `
struct VOut
{
    @builtin(position) pos : vec4f,
    @location(0) uv : vec2f,
}

@vertex
fn vertexBrdf(@location(0) pos : vec4f, @location(1) uv : vec2f) -> VOut
{
    return VOut(pos, uv);
}

@fragment
fn fragmentBrdf(@location(0) uv : vec2f) -> @location(0) vec4f
{
    return vec4f(IntegrateBRDF(uv.x, uv.y),0,1);
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