import { CUBE_VERTEX_BUFFER_LAYOUT } from '../meshes/cube_mesh';
import shader from '../shaders/blinn_phong.wgsl';
import { CameraAndLightsBufferWriter } from './cameraAndLightsBufferWriter';
import { InstancesBufferWriter } from './instancesBufferWriter';
import { BlinnPhongMaterial } from './materials/blinnPhongMaterial';
import { createBindGroup, createPipeline, createShadowMapBindGroup } from './pipelineBuilder';

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
    const shaderModule = device.createShaderModule({ label: "Blinn Phong Shader without Normals", code: shader });
    return createPipeline(device, shaderModule, [CUBE_VERTEX_BUFFER_LAYOUT], canvasFormat, aaSampleCount, shadowMapSize, undefined, "vertexMain_alt", "fragmentMain_alt");
}

export function createBlinnPhongBindGroup(config: BlinnPhongBindGroupDesc) {
    const def = createBindGroup(config.device, config.pipeline, config.instancesBuffer, config.uniforms, config.material, config.sampler);
    const shadow = createShadowMapBindGroup(config.device, config.pipeline, config.shadowMap, config.shadowMapSampler);
    return [def, shadow];
}

export async function createBlinnPhongPipeline_w_Normals(
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    aaSampleCount: number,
    shadowMapSize?: number,
): Promise<GPURenderPipeline> {
    const shaderModule = device.createShaderModule({ label: "Blinn Phong Shader with Normals", code: shader });
    const normalTextureBinding = {
        binding: 7,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
    };
    return createPipeline(device, shaderModule, [CUBE_VERTEX_BUFFER_LAYOUT, NORMAL_VERTEX_BUFFER_LAYOUT], canvasFormat, aaSampleCount, shadowMapSize, [normalTextureBinding]);
}

export function createBlinnPhongBindGroup_w_Normals(config: BlinnPhongBindGroupDesc): GPUBindGroup[] {
    const normalTextureBindGroup: GPUBindGroupEntry = {
        binding: 7,
        resource: config.material.normalTexture.createView(),
    }
    const def = createBindGroup(config.device, config.pipeline, config.instancesBuffer, config.uniforms, config.material, config.sampler, [normalTextureBindGroup]);
    const shadow = createShadowMapBindGroup(config.device, config.pipeline, config.shadowMap, config.shadowMapSampler);
    return [def, shadow];
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