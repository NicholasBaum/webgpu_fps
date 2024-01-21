import { CUBE_VERTEX_BUFFER_LAYOUT } from "../meshes/cube_mesh";
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";
import { CameraAndLightsBufferWriter } from "./cameraAndLightsBufferWriter";
import shader from '../shaders/blinn_phong.wgsl'
import { InstancesBufferWriter } from "./instancesBufferWriter";

export type BlinnPhongBindGroupDesc = {
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    instancesBuffer: InstancesBufferWriter,
    uniforms: CameraAndLightsBufferWriter,
    material: BlinnPhongMaterial,
    sampler: GPUSampler,
    shadowMap: GPUTexture | undefined,
    shadowMapSampler: GPUSampler
}

export async function createBlinnPhongPipeline(
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    aaSampleCount: number,
    shadowMapSize?: number
): Promise<GPURenderPipeline> {
    const shaderModule = device.createShaderModule({ label: "Blinn Phong Shader", code: shader });
    return createPipeline(device, shaderModule, [CUBE_VERTEX_BUFFER_LAYOUT], canvasFormat, aaSampleCount, shadowMapSize, undefined, "vertexMain_alt", "fragmentMain_alt");
}

export function createBlinnPhongBindGroup(config: BlinnPhongBindGroupDesc) {
    const def = createBindGroup(config.device, config.pipeline, config.instancesBuffer, config.uniforms, config.material, config.sampler);
    const shadow = createShadowMapBindGroup(config.device, config.pipeline, config.shadowMap, config.shadowMapSampler);
    return [def, shadow];
}

export function createShadowMapBindGroup(device: GPUDevice, pipeline: GPURenderPipeline, shadowMap: GPUTexture | undefined, shadowMapSampler: GPUSampler,) {

    // create dummy if necessary
    shadowMap = shadowMap ?? device.createTexture({
        size: [1, 1, 1],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: 'depth32float',
    });

    let desc = {
        label: "shadow map binding group",
        layout: pipeline.getBindGroupLayout(1),
        entries: [
            {
                binding: 0,
                resource: shadowMap.createView({
                    dimension: "2d-array",
                    // aspect: "all",
                    // baseMipLevel: 0,
                    // baseArrayLayer:2,
                    // arrayLayerCount: 1,
                }),
            },
            {
                binding: 1,
                resource: shadowMapSampler,
            },
        ],
    };

    return device.createBindGroup(desc);
}

export function createBindGroup(
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    instancesBuffer: InstancesBufferWriter,
    uniforms: CameraAndLightsBufferWriter,
    material: BlinnPhongMaterial,
    sampler: GPUSampler,
    extraBindGroupsEntries: GPUBindGroupEntry[] = []
): GPUBindGroup {

    let desc: { label: string, layout: GPUBindGroupLayout, entries: GPUBindGroupEntry[] } = {
        label: "default binding group",
        layout: pipeline.getBindGroupLayout(0),
        entries:
            [
                {
                    binding: 0,
                    resource: { buffer: instancesBuffer.gpuBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: uniforms.gpuBuffer }
                },
                {
                    binding: 2,
                    resource: { buffer: material.gpuBuffer }
                },
                {
                    binding: 3,
                    resource: sampler,
                },
                {
                    binding: 4,
                    resource: material.ambientTexture.createView(),
                },
                {
                    binding: 5,
                    resource: material.diffuseTexture.createView(),
                },
                {
                    binding: 6,
                    resource: material.specularTexture.createView(),
                },
            ]
    };
    if (extraBindGroupsEntries)
        desc.entries.push(...extraBindGroupsEntries)
    return device.createBindGroup(desc);
}

export async function createPipeline(
    device: GPUDevice,
    shaderModule: GPUShaderModule,
    vertexBufferLayout: GPUVertexBufferLayout[],
    canvasFormat: GPUTextureFormat,
    aaSampleCount: number,
    shadowMapSize?: number,
    extraLayoutEntries: GPUBindGroupLayoutEntry[] = [],
    vertexEntryPoint: string = "vertexMain",
    fragmentEntryPoint: string = "fragmentMain",

): Promise<GPURenderPipeline> {

    let group0: GPUBindGroupLayoutEntry[] = [
        {
            binding: 0, // models
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "read-only-storage" }
        },
        {
            binding: 1, // cam and lights
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: "read-only-storage" }
        },
        {
            binding: 2, // material
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" }
        },
        {
            binding: 3, // sampler
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {}
        },
        {
            binding: 4, // texture
            visibility: GPUShaderStage.FRAGMENT,
            texture: {}
        },
        {
            binding: 5, // texture
            visibility: GPUShaderStage.FRAGMENT,
            texture: {}
        },
        {
            binding: 6, // texture
            visibility: GPUShaderStage.FRAGMENT,
            texture: {}
        },
    ];
    group0.push(...extraLayoutEntries);

    let group1: GPUBindGroupLayoutEntry[] = [
        {
            binding: 0, // shadow maps
            visibility: GPUShaderStage.FRAGMENT,
            texture: {
                viewDimension: "2d-array",
                multisampled: false,
                sampleType: "depth"
            }
        },
        {
            binding: 1, // shadow map sampler
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: "comparison" }
        },
    ];

    let groupLayout1 = device.createBindGroupLayout({ entries: group0 });
    let groupLayout2 = device.createBindGroupLayout({ entries: group1 });
    let pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [groupLayout1, groupLayout2] });

    let pieplineDesc: GPURenderPipelineDescriptor = {
        label: "mesh pipeline",
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: vertexEntryPoint,
            buffers: vertexBufferLayout
        },
        fragment: {
            module: shaderModule,
            entryPoint: fragmentEntryPoint,
            targets: [{
                format: canvasFormat,
                blend: {
                    color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                    alpha: {}
                }
            }],
            constants: {
                shadowMapSize: shadowMapSize ?? 1024.0
            }
        },
        primitive: {
            topology: "triangle-list",
            cullMode: 'back',
        },
        multisample: { count: aaSampleCount, },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        },
    };

    return await device.createRenderPipelineAsync(pieplineDesc);
}

export function createSampler(device: GPUDevice) {
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
    return device.createSampler(samplerDescriptor);
}

export function createShadowMapSampler(device: GPUDevice) {
    const samplerDescriptor: GPUSamplerDescriptor = {
        compare: "less"
    };
    return device.createSampler(samplerDescriptor);
}