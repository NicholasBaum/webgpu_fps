import { createTextureFromImage } from "webgpu-utils";
import { mat4 } from "wgpu-matrix";
import { cubePositionOffset, cubeUVOffset, cubeVertexArray, cubeVertexCount, cubeVertexSize } from "../../meshes/cube_mesh";
import prefiltered_frag from "../../shaders/prefiltered_builder_frag.wgsl";
import pbr_functions from "../../shaders/pbr_functions.wgsl"
import { createBrdfMapImp } from "./brdfBuilderImpl";
const PREFILTEREDMAP_FRAG = prefiltered_frag + pbr_functions;

type MapType = 'cube' | 'cube_mips' | 'irradiance' | 'pre-filter';

// render a equirectangular png image in rgbe format to a cubemap
export async function createCubeMap(device: GPUDevice, urlOrTexture: string | GPUTexture, size: number = 1024, withMips = false): Promise<GPUTexture> {
    if (urlOrTexture instanceof GPUTexture && (urlOrTexture.dimension != '2d' || urlOrTexture.depthOrArrayLayers != 1))
        throw new Error("texture has wrong dimension");

    let sourceTexture = urlOrTexture instanceof GPUTexture ? urlOrTexture :
        await createTextureFromImage(device, urlOrTexture, { usage: GPUTextureUsage.COPY_SRC, format: 'rgba8unorm' });

    return createMap(device, sourceTexture, size, withMips ? 'cube_mips' : 'cube');
}

export async function createIrradianceMap(device: GPUDevice, cubemap: GPUTexture, size: number = 1024): Promise<GPUTexture> {
    if (cubemap.dimension != '2d' || cubemap.depthOrArrayLayers != 6)
        throw new Error("texture isn't a cubemap aka 6 layered 2d texture array");
    return createMap(device, cubemap, size, 'irradiance');
}

export async function createPrefilteredMap(device: GPUDevice, cubemap: GPUTexture, size: number = 128): Promise<GPUTexture> {
    if (cubemap.dimension != '2d' || cubemap.depthOrArrayLayers != 6)
        throw new Error("texture isn't a cubemap aka 6 layered 2d texture array");
    return createMap(device, cubemap, size, 'pre-filter');
}

export async function createBrdfMap(device: GPUDevice, size: number = 512): Promise<GPUTexture> {
    return createBrdfMapImp(device, size);
}


// multi purpose function for creating cubemaps, irradiance maps, "prefiltered maps"
async function createMap(device: GPUDevice, sourceTexture: GPUTexture, size: number, targetMap: MapType, targetFormat: GPUTextureFormat = 'rgba8unorm'): Promise<GPUTexture> {

    const maxMipLevels = targetMap == 'pre-filter' || targetMap == 'cube_mips' ? 5 : 1;
    const sourceTextureView = targetMap == 'cube' || targetMap == 'cube_mips' ? sourceTexture.createView() : sourceTexture.createView({ dimension: 'cube' });
    const sourceViewDimension = targetMap == 'cube' ? '2d' : 'cube';
    let frag_shader =
        targetMap == 'cube' ? CUBEMAP_FRAG :
            targetMap == 'irradiance' ? IRRADIANCEMAP_FRAG
                : PREFILTEREDMAP_FRAG;

    // cube vertex data
    let cubeBuffer = device.createBuffer({
        size: cubeVertexArray.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(cubeBuffer, 0, cubeVertexArray);

    // views/uniforms
    // no idea why i have to change the Z+ with Z- to get the right result
    let perspMat = mat4.perspective(Math.PI / 2, 1, 0.1, 10);
    let views = [
        mat4.lookAt([0, 0, 0], [1, 0, 0], [0, 1, 0]),
        mat4.lookAt([0, 0, 0], [-1, 0, 0], [0, 1, 0]),
        mat4.lookAt([0, 0, 0], [0, 1, 0], [0, 0, 1]),
        mat4.lookAt([0, 0, 0], [0, -1, 0], [0, 0, -1]),
        mat4.lookAt([0, 0, 0], [0, 0, -1], [0, 1, 0]),
        mat4.lookAt([0, 0, 0], [0, 0, 1], [0, 1, 0]),
    ];

    let uniBuffer = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })

    const samplerDescriptor: GPUSamplerDescriptor = {
        addressModeU: 'repeat',
        addressModeV: 'repeat',
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        lodMinClamp: 0,
        lodMaxClamp: 4,
        maxAnisotropy: 16,
    };

    let sampler = device.createSampler(samplerDescriptor);

    // renderpass
    let target = device.createTexture({
        size: [size, size, 6],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING,
        format: targetFormat,
        mipLevelCount: maxMipLevels,
    });

    const createBindGroup = (pipeline: GPURenderPipeline) => device.createBindGroup({
        label: "texture builder binding group",
        layout: pipeline.getBindGroupLayout(0),
        entries:
            [
                {
                    binding: 0,
                    resource: { buffer: uniBuffer },
                },
                {
                    binding: 1,
                    resource: sourceTextureView,
                },
                {
                    binding: 2,
                    resource: sampler,
                }
            ]
    });

    for (let mipLevel = 0; mipLevel < maxMipLevels; mipLevel++) {
        for (let i = 0; i < 6; i++) {
            let passDisc: GPURenderPassDescriptor = {
                colorAttachments: [
                    {
                        view: target.createView({
                            dimension: '2d', baseArrayLayer: i, arrayLayerCount: 1,
                            mipLevelCount: 1, baseMipLevel: mipLevel
                        }),
                        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    }
                ],
            }
            device.queue.writeBuffer(uniBuffer, 0, mat4.multiply(perspMat, views[i]) as Float32Array);
            let enc = device.createCommandEncoder();
            let pass = enc.beginRenderPass(passDisc);
            pass.setVertexBuffer(0, cubeBuffer);
            // pipeline 
            const roughnessConst = targetMap == 'pre-filter' ? { roughness: mipLevel / (maxMipLevels - 1) } : {};
            let pipeline = await createPipeline(device, targetFormat, sourceViewDimension, frag_shader, roughnessConst);
            pass.setPipeline(pipeline)
            let bindGroup = createBindGroup(pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.draw(cubeVertexCount);
            pass.end();
            device.queue.submit([enc.finish()])
        }
    }
    return target;
}

async function createPipeline(
    device: GPUDevice,
    format: GPUTextureFormat,
    sourceViewDimension: GPUTextureViewDimension,
    frag_shader: string,
    constants?: {}
): Promise<GPURenderPipeline> {

    let entries: GPUBindGroupLayoutEntry[] = [
        {
            binding: 0, // uniforms
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "uniform" }
        },
        {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: sourceViewDimension }
        },
        {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: "filtering" }
        },
    ];

    let bindingGroupDef = device.createBindGroupLayout({ entries: entries });
    let pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindingGroupDef] });

    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: device.createShaderModule({ label: "texture builder", code: VERTEX_SHADER }),
            entryPoint: 'vertexMain',
            buffers: [
                {
                    arrayStride: cubeVertexSize,
                    attributes: [
                        {
                            // position
                            shaderLocation: 0,
                            offset: cubePositionOffset,
                            format: 'float32x4',
                        },
                        {
                            // uv
                            shaderLocation: 1,
                            offset: cubeUVOffset,
                            format: 'float32x2',
                        },
                    ],
                },
            ],
        },
        fragment: {
            module: device.createShaderModule({ label: "texture builder", code: frag_shader }),
            entryPoint: 'fragmentMain',
            targets: [{
                format: format,
            }],
            constants: constants ?? 1.0,
        },
        primitive: {
            topology: 'triangle-list',
        },
    });

    return pipeline;
}

const VERTEX_SHADER = `
struct Uniforms
{
    vp : mat4x4f,
}

struct VertexOut
{
    @builtin(position) position : vec4f,
    @location(0) viewDir: vec4f,
}

@group(0) @binding(0) var<uniform> uni : Uniforms;

@vertex
fn vertexMain(@location(0) position : vec4f) -> VertexOut
{
    return VertexOut(uni.vp * position, position);
}
`;

const CUBEMAP_FRAG = `
@group(0) @binding(1) var sourceTexture : texture_2d<f32>;
@group(0) @binding(2) var textureSampler : sampler;

@fragment
fn fragmentMain(@builtin(position) position : vec4f, @location(0) viewDir : vec4f) ->  @location(0) vec4f
{
    const PI = 3.14159265359; 
    const invPI = 1.0/vec2f(2*PI, PI);
    let v = normalize(viewDir.xyz);
    var uv = vec2(atan2(v.z, v.x), acos(v.y)) * invPI;    
    
    // flipping left and right otherwise the environment map renderer gets it wrong
    return textureSample(sourceTexture, textureSampler, vec2f(1,0) + vec2f(-1,1) * uv);
}
`;

const IRRADIANCEMAP_FRAG = `
@group(0) @binding(1) var sourceTexture : texture_cube<f32>;
@group(0) @binding(2) var textureSampler : sampler;

@fragment
fn fragmentMain(@location(0) worldPos : vec4f) ->  @location(0) vec4f
{
    const PI = 3.14159265359;
    let N = normalize(worldPos.xyz);
    var irradiance = vec3f(0.0);  

    var up    = vec3f(0.0, 1.0, 0.0);
    let right = normalize(cross(up, N));
    up        = normalize(cross(N, right));
    
    let sampleDelta = 0.025;
    var nrSamples = 0.0; 
    for(var phi = 0.0; phi < 2.0 * PI; phi += sampleDelta)
    {
        for(var theta = 0.0; theta < 0.5 * PI; theta += sampleDelta)
        {
            // spherical to cartesian (in tangent space)
            let tangentSample = vec3f(sin(theta) * cos(phi),  sin(theta) * sin(phi), cos(theta));
            // tangent space to world
            let sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * N;     
            // testing shows that sampleVec needs to be inversed
            irradiance += textureSample(sourceTexture, textureSampler, sampleVec * vec3f(1, 1, -1)).xyz * cos(theta) * sin(theta);
            nrSamples += 1;
        }
    }
    irradiance = PI * irradiance * (1.0 / nrSamples);

    return vec4f(irradiance,1);
}
`;


