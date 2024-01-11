import { CUBE_VERTEX_BUFFER_LAYOUT } from '../meshes/cube_mesh';
import normal_shader from '../shaders/normal_shader.wgsl';
import { CameraAndLightsBufferWriter } from './cameraAndLightsBufferWriter';
import { InstancesBufferWriter } from './instancesBufferWriter';
import { BlinnPhongMaterial } from './materials/blinnPhongMaterial';
import { createBlinnPhongBindGroup, createPipeline } from './pipelineBuilder';

export async function createNormalPipeline(
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    aaSampleCount: number
): Promise<GPURenderPipeline> {
    const shaderModule = device.createShaderModule({ label: "Normal Shader", code: normal_shader });
    const normalTextureBinding = {
        binding: 7,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
    };
    return createPipeline(device, shaderModule, [CUBE_VERTEX_BUFFER_LAYOUT, NORMAL_VERTEX_BUFFER_LAYOUT], canvasFormat, aaSampleCount, [normalTextureBinding]);
}

export const NORMAL_VERTEX_BUFFER_LAYOUT: GPUVertexBufferLayout = {
    arrayStride: 24,
    attributes: [
        {
            format: "float32x3",
            offset: 0,
            shaderLocation: 4,
        },
        {
            format: "float32x3",
            offset: 12,
            shaderLocation: 5,
        },
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

    const normalTextureBindGroup: GPUBindGroupEntry = {
        binding: 7,
        resource: material.normalTexture.createView(),
    }

    return createBlinnPhongBindGroup(device, pipeline, instancesBuffer, uniforms, material, sampler, [normalTextureBindGroup]);
}