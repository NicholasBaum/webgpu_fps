import { createTextureFromImage } from "webgpu-utils";
import { mat4 } from "wgpu-matrix";
import { cubePositionOffset, cubeUVOffset, cubeVertexArray, cubeVertexCount, cubeVertexSize } from "../../meshes/cube_mesh";
import { createSampler } from "../pipeline/pipelineBuilder";

// loads a equirectangular rgbe image in png format
export async function createCubeMap(device: GPUDevice, urlOrTexture: string | GPUTexture, size: number = 1024): Promise<GPUTexture> {
    if (urlOrTexture instanceof GPUTexture && (urlOrTexture.dimension != '2d' || urlOrTexture.depthOrArrayLayers != 1))
        throw new Error("texture has wrong dimension");
    return createMap(device, urlOrTexture, size, 'cube');
}

export async function createIrradianceMap(device: GPUDevice, cubemap: GPUTexture, size: number = 1024): Promise<GPUTexture> {
    if (cubemap.dimension != '2d' || cubemap.depthOrArrayLayers != 6)
        throw new Error("texture isn't a cubemap aka 6 layered 2d texture array");
    return createMap(device, cubemap, size, 'irradiance');
}

// creates a cubemap when giben a equirectangular map and creates a irradiance map when given a cube map 
// need to set the mode flag
async function createMap(device: GPUDevice, urlOrTexture: string | GPUTexture, size: number = 1024, mode: 'cube' | 'irradiance'): Promise<GPUTexture> {

    const format = 'rgba8unorm';

    if (mode == 'irradiance' && !(urlOrTexture instanceof GPUTexture))
        throw new Error("illegal paramter combination");

    let sourceTexture = urlOrTexture instanceof GPUTexture ? urlOrTexture :
        await createTextureFromImage(device, urlOrTexture, { usage: GPUTextureUsage.COPY_SRC });

    let cubeMapTarget = device.createTexture({
        dimension: '2d',
        size: [size, size, 6],
        format: format,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });

    // cube vertex data
    let cubeBuffer = device.createBuffer({
        size: cubeVertexArray.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(cubeBuffer, 0, cubeVertexArray);

    // views/uniforms
    let perspMat = mat4.perspective(Math.PI / 2, 1, 0.1, 10);
    let views = [
        mat4.lookAt([0, 0, 0], [1, 0, 0], [0, -1, 0]),
        mat4.lookAt([0, 0, 0], [-1, 0, 0], [0, -1, 0]),
        mat4.lookAt([0, 0, 0], [0, -1, 0], [0, 0, -1]),
        mat4.lookAt([0, 0, 0], [0, 1, 0], [0, 0, 1]),
        mat4.lookAt([0, 0, 0], [0, 0, 1], [0, -1, 0]),
        mat4.lookAt([0, 0, 0], [0, 0, -1], [0, -1, 0]),
    ];
    let uniBuffer = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })

    let sampler = createSampler(device);

    // pipeline 
    let pipeline = await createPipeline(device, format, mode);

    // renderpass
    let target = device.createTexture({
        size: [size, size],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        format: format
    });

    let passDisc: GPURenderPassDescriptor = {
        colorAttachments: [
            {
                view: target.createView(),
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }
        ],
    }

    for (let i = 0; i < 6; i++) {
        device.queue.writeBuffer(uniBuffer, 0, mat4.multiply(perspMat, views[i]) as Float32Array);
        let enc = device.createCommandEncoder();
        let pass = enc.beginRenderPass(passDisc);
        pass.setVertexBuffer(0, cubeBuffer);
        let bindGroup = device.createBindGroup({
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
                        resource: mode == 'cube' ? sourceTexture.createView() : sourceTexture.createView({ dimension: 'cube' }),
                    },
                    {
                        binding: 2,
                        resource: sampler,
                    }
                ]
        });
        pass.setPipeline(pipeline)
        pass.setBindGroup(0, bindGroup);
        pass.draw(cubeVertexCount);
        pass.end();
        enc.copyTextureToTexture({ texture: target, origin: [0, 0, 0] }, { texture: cubeMapTarget, origin: [0, 0, i] }, { height: size, width: size });
        device.queue.submit([enc.finish()])
    }

    return cubeMapTarget;
}

async function createPipeline(device: GPUDevice, format: GPUTextureFormat, mode: 'cube' | 'irradiance'): Promise<GPURenderPipeline> {
    let entries: GPUBindGroupLayoutEntry[] = [
        {
            binding: 0, // uniforms
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "uniform" }
        },
        {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: mode == 'cube' ? '2d' : 'cube', }
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
            module: device.createShaderModule({ label: "texture builder", code: mode == 'cube' ? CUBEMAP_FRAG : IRRADIANCEMAP_FRAG }),
            entryPoint: 'fragmentMain',
            targets: [{
                format: format,
            }],
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

// values for 1/(2*Pi) and 1/Pi
const InvPI = vec2f(0.1591, 0.3183);
fn sampleSphericalMap(v : vec3f) -> vec2f
{
    var uv = vec2(atan2(v.z, v.x), asin(v.y));
    uv *= InvPI;
    uv += 0.5;
    return uv;
}

@fragment
fn fragmentMain(@builtin(position) position : vec4f, @location(0) viewDir : vec4f) ->  @location(0) vec4f
{
    let uv = sampleSphericalMap(normalize(viewDir.xyz));
    let t = textureSample(sourceTexture, textureSampler, uv);
    return t;
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
    
            irradiance += textureSample(sourceTexture, textureSampler, sampleVec).xyz * cos(theta) * sin(theta);
            nrSamples += 1;
        }
    }
    irradiance = PI * irradiance * (1.0 / nrSamples);

    return vec4f(irradiance,1);
}
`;


