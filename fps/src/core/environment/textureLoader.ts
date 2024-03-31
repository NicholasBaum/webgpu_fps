import { createTextureFromImage } from "webgpu-utils";
import { mat4 } from "wgpu-matrix";
import { cubePositionOffset, cubeUVOffset, cubeVertexArray, cubeVertexCount, cubeVertexSize } from "../../meshes/cube_mesh";
import { createSampler } from "../pipeline/pipelineBuilder";

// loads a equirectangular rgbe image in png format
export async function createCubeMap(device: GPUDevice, url: string, size: number = 1024): Promise<GPUTexture> {

    const format = 'rgba8unorm';

    let sourceTexture = await createTextureFromImage(device, url, { usage: GPUTextureUsage.COPY_SRC });

    let cubeMap = device.createTexture({
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
    let pipeline = await createPipeline(device, format);

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
            label: "cubemap creator binding group",
            layout: pipeline.getBindGroupLayout(0),
            entries:
                [
                    {
                        binding: 0,
                        resource: { buffer: uniBuffer },
                    },
                    {
                        binding: 1,
                        resource: sourceTexture.createView(),
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
        enc.copyTextureToTexture({ texture: target, origin: [0, 0, 0] }, { texture: cubeMap, origin: [0, 0, i] }, { height: size, width: size });
        device.queue.submit([enc.finish()])
    }

    // copy texture    
    for (let i = 0; i < 6; i++) {
        //device.queue.copyExternalImageToTexture({ source: image }, { texture: cubeMap, origin: [0, 0, i] }, { height: size, width: size });
        //enc.copyTextureToTexture({ texture: sourceTexture, origin: [0, 0, 0] }, { texture: cubeMap, origin: [0, 0, i] }, { height: size, width: size });
    }


    return cubeMap;
}

async function createPipeline(device: GPUDevice, format: GPUTextureFormat): Promise<GPURenderPipeline> {
    let entries: GPUBindGroupLayoutEntry[] = [
        {
            binding: 0, // uniforms
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "uniform" }
        },
        {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {
                viewDimension: "2d",
            }
        },
        {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: "filtering" }
        },
    ];

    let bindingGroupDef = device.createBindGroupLayout({ entries: entries });
    let pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindingGroupDef] });

    const shaderModule = device.createShaderModule({ label: "Cubemap Creator", code: SHADER });
    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
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
            module: shaderModule,
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

const SHADER =
    `
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
@group(0) @binding(1) var sourceTexture : texture_2d<f32>;
@group(0) @binding(2) var textureSampler : sampler;

@vertex
fn vertexMain(@location(0) position : vec4f) -> VertexOut
{
    return VertexOut(uni.vp * position, position);
}

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
