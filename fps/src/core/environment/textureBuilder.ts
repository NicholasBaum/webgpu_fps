import { createTextureFromImage, createTextureFromImages, generateMipmap } from "webgpu-utils";
import { mat4 } from "wgpu-matrix";
import { CUBE_VERTEX_ARRAY, CUBE_VERTEX_COUNT } from "../../meshes/cube";
import { DEF_TOPOLOGY, DEF_VERTEX_SIZE } from "../../meshes/defaultLayout";
import specmap_frag from "../../shaders/specmap_builder_frag.wgsl";
import pbr_functions from "../../shaders/pbr_functions.wgsl"
import { createBrdfMapImp } from "./brdfBuilderImpl";
import { createTextureFromHdr } from "../../helper/io-rgbe";
import { NewPipeBuilder, PipeOptions } from "../renderer/newPipeBuilder";
import { BindGroupBuilder } from "../renderer/bindGroupBuilder";
const SPECULARMAP_FRAG = specmap_frag + pbr_functions;

type MapType = 'cube' | 'cube_mips' | 'irradiance' | 'specular';

type Options = { size?: number, withMips?: boolean, format?: GPUTextureFormat, offset?: number };

// render a equirectangular png image in rgbe format to a cubemap
export async function createCubeMapFromImage(
    device: GPUDevice,
    urls: string | string[],
    options?: Options
): Promise<GPUTexture> {
    urls = typeof urls == 'string' ? [urls] : urls;
    if (urls.length != 1 && urls.length != 6)
        throw new Error("input needs to be a single equirectangular map or six images");

    // case 6 images use third party code
    if (urls.length == 6) {
        return await createTextureFromImages(device, urls, { mips: options?.withMips })
    }

    // single file case
    const hdr = urls[0].toLowerCase().endsWith('.hdr');
    let texture = hdr ?
        await createTextureFromHdr(device, urls[0]) :
        await createTextureFromImage(device, urls[0], { usage: GPUTextureUsage.COPY_SRC, format: options?.format });

    return createCubeMapFromTexture(device, texture, options);
}

export async function createCubeMapFromTexture(
    device: GPUDevice,
    texture: GPUTexture,
    options?: Options
): Promise<GPUTexture> {
    if (texture.dimension != '2d' || texture.depthOrArrayLayers != 1)
        throw new Error("GPUTexture has wrong dimension");
    const exp = Math.round(Math.log2(texture.height / 2));
    const size = options?.size ?? Math.pow(2, exp);
    return createMap(device, texture, size, options?.withMips == true ? 'cube_mips' : 'cube', options?.format, options?.offset);
}

export async function createIrradianceMap(device: GPUDevice, cubemap: GPUTexture, size: number = 64): Promise<GPUTexture> {
    if (cubemap.dimension != '2d' || cubemap.depthOrArrayLayers != 6)
        throw new Error("texture isn't a cubemap aka 6 layered 2d texture array");
    return createMap(device, cubemap, size, 'irradiance');
}

// creates an environment map with mipmaps representing the environment for different roughness reflections
// utilizes mip maps on creation if available
export async function createSpecularEnvironmentMap(device: GPUDevice, cubemap: GPUTexture, size: number = 128): Promise<GPUTexture> {
    if (cubemap.dimension != '2d' || cubemap.depthOrArrayLayers != 6)
        throw new Error("texture isn't a cubemap aka 6 layered 2d texture array");
    return createMap(device, cubemap, size, 'specular');
}

// creates the second part of the split sum approximation, the first part is the prefiltered environment map
export async function createBrdfMap(device: GPUDevice, size: number = 512): Promise<GPUTexture> {
    return createBrdfMapImp(device, size);
}


// multi purpose function for creating cubemaps, irradiance maps, "prefiltered maps"
async function createMap(device: GPUDevice, sourceTexture: GPUTexture, size: number, targetMap: MapType, targetFormat?: GPUTextureFormat, offset?: number): Promise<GPUTexture> {
    offset = offset ?? 0;
    targetFormat = targetFormat ?? sourceTexture.format;
    // map dependent settings    
    const sourceSize = sourceTexture.width;
    const maxMipLevelsCount = Math.min(1 + Math.floor(Math.log2(sourceSize)), 5);
    const mipLevelsCount = targetMap == 'specular' || targetMap == 'cube_mips' ? maxMipLevelsCount : 1;
    const sourceTextureView = targetMap == 'cube' || targetMap == 'cube_mips' ? sourceTexture.createView() : sourceTexture.createView({ dimension: 'cube' });
    let frag_shader =
        targetMap == 'cube' || targetMap == 'cube_mips' ? CUBEMAP_FRAG :
            targetMap == 'irradiance' ? IRRADIANCEMAP_FRAG
                : SPECULARMAP_FRAG;
    //if the environment map has mipmaps we can use them for smoother results
    const prefilterRenderMode = sourceTexture.mipLevelCount == 1 ? 0 : 1;
    let shaderConstants: Record<string, number> | undefined = undefined;
    if (targetMap == 'specular') {
        shaderConstants = { mode: prefilterRenderMode, resolution: sourceSize, roughness: 1.0 }
    }
    else if (targetMap == 'cube' || targetMap == 'cube_mips') {
        shaderConstants = { offset: offset }
        console.log(offset);
    };


    let target = device.createTexture({
        size: [size, size, 6],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING,
        format: targetFormat,
        mipLevelCount: mipLevelsCount,
    });

    // cube vertex data
    let cubeBuffer = device.createBuffer({
        size: CUBE_VERTEX_ARRAY.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(cubeBuffer, 0, CUBE_VERTEX_ARRAY);

    // sampler
    const samplerDescriptor: GPUSamplerDescriptor = {
        addressModeU: 'repeat',
        addressModeV: 'repeat',
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        lodMinClamp: 0,
        lodMaxClamp: 32,
        maxAnisotropy: 16,
    };

    let sampler = device.createSampler(samplerDescriptor);

    // views/uniforms
    // lookAt uses the cross product
    // cross product depends on left or right handed coordinates
    // that's why Z+ is swapped with Z-
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

    // renderpass 
    // mipmaps for the environment cubemap are created afterwards
    // irradiance doesn't have mipmaps
    // the prefilter mode renders every mipmap level separatly    
    const mipCycles = targetMap == 'specular' ? mipLevelsCount : 1;
    for (let mipLevel = 0; mipLevel < mipCycles; mipLevel++) {
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
            if (shaderConstants && targetMap == 'specular')
                shaderConstants.roughness = mipLevel / (mipLevelsCount - 1);
            let pipeline = await createPipeline(device, targetFormat, frag_shader, shaderConstants);
            pass.setPipeline(pipeline)
            let bindGroup = new BindGroupBuilder(device, pipeline, "Texture Builder Binding Group")
                .addBuffer(uniBuffer)
                .addTexture(sourceTextureView)
                .addSampler(sampler)
                .createBindGroup()
            pass.setBindGroup(0, bindGroup);
            pass.draw(CUBE_VERTEX_COUNT);
            pass.end();
            device.queue.submit([enc.finish()])
        }
    }
    await device.queue.onSubmittedWorkDone();

    if (targetMap == 'cube_mips')
        generateMipmap(device, target);

    return target;
}

async function createPipeline(
    device: GPUDevice,
    format: GPUTextureFormat,
    frag_shader: string,
    constants?: {}
): Promise<GPURenderPipeline> {

    let vLayout: GPUVertexBufferLayout = {
        arrayStride: DEF_VERTEX_SIZE,
        attributes: [
            {
                // position
                shaderLocation: 0,
                offset: 0,
                format: 'float32x4',
            }
        ],
    };

    let opt: PipeOptions = {
        label: `Texture Builder Piepline`,
        aaSampleCount: 1,
        cullMode: 'none',
        fragmentConstants: constants,
        //canvasFormat: format,
        depthStencilState: 'none',
        targets: [{ format }],
    }

    let pipe = new NewPipeBuilder({ vertex: VERTEX_SHADER, fragment: frag_shader }, vLayout, DEF_TOPOLOGY, opt);

    return await pipe.buildAsync(device);
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
override offset : f32 = 1.0;

@group(0) @binding(1) var sourceTexture : texture_2d<f32>;
@group(0) @binding(2) var textureSampler : sampler;

@fragment
fn fragmentMain(@builtin(position) position : vec4f, @location(0) viewDir : vec4f) ->  @location(0) vec4f
{
    let dumm = offset;
    const PI = 3.14159265359; 
    const invPI = 1.0/vec2f(2*PI, PI);
    let v = normalize(viewDir.xyz);
    var uv = vec2f(offset + atan2(v.z, v.x), acos(v.y)) * invPI;    
    return textureSample(sourceTexture, textureSampler, uv);
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
            let sinTheta = sin(theta);
            let cosTheta = sqrt(1 - sinTheta * sinTheta);
            let tangentSample = vec3f(sinTheta * cos(phi),  sinTheta * sin(phi), cosTheta);
            // tangent space to world
            let sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * N;     
            // sampleVec is inverted
            // confirmed by verifying that Cubemap, IrradianceMap and SpecularMap align            
            irradiance += textureSample(sourceTexture, textureSampler, sampleVec * vec3f(1, 1, -1)).xyz * cosTheta * sinTheta;
            nrSamples += 1;
        }
    }
    irradiance = PI * irradiance * (1.0 / nrSamples);

    return vec4f(irradiance,1);
}
`;