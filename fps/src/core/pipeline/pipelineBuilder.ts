import { BlinnPhongMaterial } from "../materials/blinnPhongMaterial";
import { CameraAndLightsBufferWriter } from "../primitives/cameraAndLightsBufferWriter";
import { InstancesBufferWriter } from "../primitives/instancesBufferWriter";
import { PbrMaterial } from "../materials/pbrMaterial";
import { EnvironmentMap } from "../environment/environmentMap";

export type RenderPipelineInstance = {
    pipeline: GPURenderPipeline,
    usesNormalData: boolean,
    createBindGroupsFunc: (config: RenderBindGroupsConfig) => GPUBindGroup[]
}

export type RenderBindGroupsConfig = {
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    instancesBuffer: InstancesBufferWriter,
    uniforms: CameraAndLightsBufferWriter,
    material: BlinnPhongMaterial | PbrMaterial,
    sampler: GPUSampler,
    shadowMap: GPUTexture | undefined,
    shadowMapSampler: GPUSampler,
    environmentMap: EnvironmentMap | undefined,
    environmentMapSampler: GPUSampler
}

export type RenderPipelineConfig = {
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    aaSampleCount: number,
    shadowMapSize?: number
}

export function createBindGroup(
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    instancesBuffer: InstancesBufferWriter,
    uniforms: CameraAndLightsBufferWriter,
    material: BlinnPhongMaterial | PbrMaterial,
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
                    resource: { buffer: uniforms.buffer }
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
                    resource: material instanceof PbrMaterial ? material.ambientOcclussionTexture.createView() : material.ambientTexture.createView(),
                },
                {
                    binding: 5,
                    resource: material instanceof PbrMaterial ? material.albedoTexture.createView() : material.diffuseTexture.createView(),
                },
                {
                    binding: 6,
                    resource: material instanceof PbrMaterial ? material.metalTexture.createView() : material.specularTexture.createView(),
                },
            ]
    };
    if (extraBindGroupsEntries)
        desc.entries.push(...extraBindGroupsEntries)
    return device.createBindGroup(desc);
}

export function createShadowMapBindGroup(device: GPUDevice, pipeline: GPURenderPipeline, shadowMap: GPUTexture | undefined, shadowMapSampler: GPUSampler) {

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

export function createEnvironmentMapBindGroup(device: GPUDevice, pipeline: GPURenderPipeline, map: GPUTexture | undefined, sampler: GPUSampler) {

    // create dummy if necessary
    map = map ?? device.createTexture({
        size: [1, 1, 6],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: 'rgba8unorm',
    });

    let desc = {
        label: "environment map binding group",
        layout: pipeline.getBindGroupLayout(2),
        entries: [
            {
                binding: 0,
                resource: map.createView({
                    dimension: "cube",
                }),
            },
            {
                binding: 1,
                resource: sampler,
            },
        ],
    };

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
    environmentMapGroupLayoutEntriesReplacement?: GPUBindGroupLayoutEntry[]

): Promise<GPURenderPipeline> {

    let defaultGroup: GPUBindGroupLayoutEntry[] = [
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
    defaultGroup.push(...extraLayoutEntries);

    let shadowMapGroup: GPUBindGroupLayoutEntry[] = [
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

    const environmentMapGroup: GPUBindGroupLayoutEntry[] = environmentMapGroupLayoutEntriesReplacement ?? [
        {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {
                viewDimension: "cube",
            }
        },
        {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: "filtering" }
        }

    ];

    let groupLayout1 = device.createBindGroupLayout({ entries: defaultGroup });
    let groupLayout2 = device.createBindGroupLayout({ entries: shadowMapGroup });
    let groupLayout3 = device.createBindGroupLayout({ entries: environmentMapGroup });
    let pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [groupLayout1, groupLayout2, groupLayout3] });

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