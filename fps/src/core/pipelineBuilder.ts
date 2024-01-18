import { CUBE_VERTEX_BUFFER_LAYOUT } from "../meshes/cube_mesh";
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";
import { CameraAndLightsBufferWriter } from "./cameraAndLightsBufferWriter";
import shader from '../shaders/normal_shader.wgsl'
import blinnShader from '../shaders/blinn_phong_shader.wgsl'
import { InstancesBufferWriter } from "./instancesBufferWriter";

export async function createBlinnPhongPipeline(
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    aaSampleCount: number
): Promise<GPURenderPipeline> {
    const shaderModule = device.createShaderModule({ label: "Blinn Phong Shader", code: shader + '\n' + blinnShader });
    return createPipeline(device, shaderModule, [CUBE_VERTEX_BUFFER_LAYOUT], canvasFormat, aaSampleCount, undefined, "vertexMain_alt", "fragmentMain_alt");
}

export function createBlinnPhongBindGroup(config: {
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    instancesBuffer: InstancesBufferWriter,
    uniforms: CameraAndLightsBufferWriter,
    material: BlinnPhongMaterial,
    sampler: GPUSampler,
    shadowMap: GPUTexture | null,
    shadowMapSampler: GPUSampler
}
) {
    return createBindGroup(config.device, config.pipeline, config.instancesBuffer, config.uniforms, config.material, config.sampler, config.shadowMap, config.shadowMapSampler);
}

export function createBindGroup(
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    instancesBuffer: InstancesBufferWriter,
    uniforms: CameraAndLightsBufferWriter,
    material: BlinnPhongMaterial,
    sampler: GPUSampler,
    shadowMap: GPUTexture | null,
    shadowMapSampler: GPUSampler,
    extraBindGroups?: GPUBindGroupEntry[])
    : GPUBindGroup {

    const extras: GPUBindGroupEntry[] = shadowMap ? [
        {
            binding: 8,
            resource: shadowMap.createView(),
        },
        {
            binding: 9,
            resource: shadowMapSampler,
        },
    ] : [
        {
            binding: 8,
            resource: device.createTexture({
                size: [1, 1, 1],
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                format: 'depth32float',
            }).createView(),
        },
        {
            binding: 9,
            resource: shadowMapSampler,
        },
    ];

    let desc: { label: string, layout: GPUBindGroupLayout, entries: GPUBindGroupEntry[] } = {
        label: "binding group",
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
    if (extraBindGroups)
        desc.entries.push(...extraBindGroups)
    desc.entries.push(...extras);
    return device.createBindGroup(desc);
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

export async function createPipeline(
    device: GPUDevice,
    shaderModule: GPUShaderModule,
    vertexBufferLayout: GPUVertexBufferLayout[],
    canvasFormat: GPUTextureFormat,
    aaSampleCount: number,
    extraGPUBindGroupLayout?: GPUBindGroupLayoutEntry[],
    vertexEntryPoint: string = "vertexMain",
    fragmentEntryPoint: string = "fragmentMain"

): Promise<GPURenderPipeline> {

    let entries: GPUBindGroupLayoutEntry[] = [
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
        {
            binding: 8, // shadow map
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: "depth" }
        },
        {
            binding: 9, // shadow map sampler
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: "comparison" }
        },
    ];

    if (extraGPUBindGroupLayout && extraGPUBindGroupLayout.length > 0) {
        entries.push(...extraGPUBindGroupLayout);
    }

    let bindingGroupDef = device.createBindGroupLayout({ entries: entries });
    let pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindingGroupDef] });

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
            }]
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