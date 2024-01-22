import { CUBE_VERTEX_BUFFER_LAYOUT } from '../meshes/cube_mesh';
import { CameraAndLightsBufferWriter } from './cameraAndLightsBufferWriter';
import { InstancesBufferWriter } from './instancesBufferWriter';
import { BlinnPhongMaterial } from './materials/blinnPhongMaterial';
import { createBindGroup, createPipeline, createShadowMapBindGroup } from './pipelineBuilder';
import { NORMAL_VERTEX_BUFFER_LAYOUT } from '../meshes/normalDataBuilder';

import shader from '../shaders/blinn_phong.wgsl';

export type BlinnPhongPipelineBuilder = {
    pipeline: GPURenderPipeline,
    usesNormalData: boolean,
    createBindGroupsFunc: (config: BlinnPhongBindGroupConfig) => GPUBindGroup[]
}

export type BlinnPhongBindGroupConfig = {
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    instancesBuffer: InstancesBufferWriter,
    uniforms: CameraAndLightsBufferWriter,
    material: BlinnPhongMaterial,
    sampler: GPUSampler,
    shadowMap: GPUTexture | undefined,
    shadowMapSampler: GPUSampler
}

export type BlinnPhongPipelineConfig = {
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    aaSampleCount: number,
    shadowMapSize?: number
}

export async function createBlinnPhongPipelineBuilder(config: BlinnPhongPipelineConfig): Promise<BlinnPhongPipelineBuilder> {
    const device = config.device;
    const shaderModule = device.createShaderModule({ label: "Blinn Phong Shader", code: shader });
    const normalTextureBinding = {
        binding: 7,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
    };
    const pipeline = await createPipeline(
        device,
        shaderModule,
        [CUBE_VERTEX_BUFFER_LAYOUT, NORMAL_VERTEX_BUFFER_LAYOUT],
        config.canvasFormat,
        config.aaSampleCount,
        config.shadowMapSize,
        [normalTextureBinding]
    );

    return {
        pipeline: pipeline,
        usesNormalData: true,
        createBindGroupsFunc: (config: BlinnPhongBindGroupConfig) => { return createBlinnPhongBindGroup_w_Normals(config) }
    };
}

export async function createBlinnPhongPipelineBuilder_NoNormals(config: BlinnPhongPipelineConfig): Promise<BlinnPhongPipelineBuilder> {
    const device = config.device;
    const shaderModule = device.createShaderModule({ label: "Blinn Phong Shader without Normals", code: shader });
    const pipeline = await createPipeline(device,
        shaderModule,
        [CUBE_VERTEX_BUFFER_LAYOUT],
        config.canvasFormat,
        config.aaSampleCount,
        config.shadowMapSize,
        [],
        "vertexMain_alt",
        "fragmentMain_alt"
    );

    return {
        pipeline: pipeline,
        usesNormalData: false,
        createBindGroupsFunc: (config: BlinnPhongBindGroupConfig) => { return createBlinnPhongBindGroup(config) }
    };
}

function createBlinnPhongBindGroup(config: BlinnPhongBindGroupConfig) {
    const def = createBindGroup(config.device, config.pipeline, config.instancesBuffer, config.uniforms, config.material, config.sampler);
    const shadow = createShadowMapBindGroup(config.device, config.pipeline, config.shadowMap, config.shadowMapSampler);
    return [def, shadow];
}

function createBlinnPhongBindGroup_w_Normals(config: BlinnPhongBindGroupConfig): GPUBindGroup[] {
    const normalTextureBindGroup: GPUBindGroupEntry = {
        binding: 7,
        resource: config.material.normalTexture.createView(),
    }
    const def = createBindGroup(config.device, config.pipeline, config.instancesBuffer, config.uniforms, config.material, config.sampler, [normalTextureBindGroup]);
    const shadow = createShadowMapBindGroup(config.device, config.pipeline, config.shadowMap, config.shadowMapSampler);
    return [def, shadow];
}