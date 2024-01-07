import normal_shader from '../shaders/normal_shader.wgsl';
import { CameraAndLightsBufferWriter } from './cameraAndLightsBufferWriter';
import { InstancesBufferWriter } from './instancesBufferWriter';
import { BlinnPhongMaterial } from './materials/blinnPhongMaterial';

export async function createNormalPipeline(
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    aaSampleCount: number
): Promise<GPURenderPipeline> {
    const shaderModule = device.createShaderModule({ label: "Normal Shader", code: normal_shader });
    return createPipeline_withNormalMap(device, shaderModule, Normal_VERTEX_BUFFER_LAYOUT, canvasFormat, aaSampleCount);
}

const Normal_VERTEX_BUFFER_LAYOUT: GPUVertexBufferLayout = {
    arrayStride: 56,
    attributes: [
        {
            format: "float32x4",
            offset: 0,
            shaderLocation: 0,
        },
        {
            format: "float32x4",
            offset: 16,
            shaderLocation: 1,
        },
        {
            format: "float32x2",
            offset: 32,
            shaderLocation: 2,
        },
        {
            format: "float32x4",
            offset: 40,
            shaderLocation: 3,
        }
    ]
};

export function createNormalBindGroup(
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    instancesBuffer: InstancesBufferWriter,
    uniforms: CameraAndLightsBufferWriter,
    material: BlinnPhongMaterial,
    sampler: GPUSampler)
    : GPUBindGroup {

    let desc = {
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
                {
                    binding: 7,
                    resource: material.normalTexture.createView(),
                }
            ]
    };

    return device.createBindGroup(desc);
}

async function createPipeline_withNormalMap(
    device: GPUDevice,
    shaderModule: GPUShaderModule,
    vertexBufferLayout: GPUVertexBufferLayout,
    canvasFormat: GPUTextureFormat,
    aaSampleCount: number
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
            binding: 7, // texture
            visibility: GPUShaderStage.FRAGMENT,
            texture: {}
        },
    ];

    let bindingGroupDef = device.createBindGroupLayout({ entries: entries });
    let pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindingGroupDef] });

    let pieplineDesc: GPURenderPipelineDescriptor = {
        label: "mesh pipeline",
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: "vertexMain",
            buffers: [vertexBufferLayout]
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fragmentMain",
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
        multisample: aaSampleCount ? { count: aaSampleCount, } : undefined,
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        },
    };

    return await device.createRenderPipelineAsync(pieplineDesc);
}