import { CUBE_VERTEX_BUFFER_LAYOUT } from '../meshes/cube_mesh';
import { CameraAndLightsBufferWriter } from './cameraAndLightsBufferWriter';
import { InstancesBufferWriter } from './instancesBufferWriter';
import { BlinnPhongMaterial } from './materials/blinnPhongMaterial';
import { createBindGroup, createEnvironmentMapBindGroup, createPipeline, createShadowMapBindGroup } from './pipelineBuilder';
import { NORMAL_VERTEX_BUFFER_LAYOUT } from '../meshes/normalDataBuilder';

import shader from '../shaders/blinn_phong.wgsl';
import { PbrMaterial } from './materials/pbrMaterial';

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
    material: BlinnPhongMaterial | PbrMaterial,
    sampler: GPUSampler,
    shadowMap: GPUTexture | undefined,
    shadowMapSampler: GPUSampler,
    environmentMap: GPUTexture | undefined,
    environmentMapSampler: GPUSampler
}

export type RenderPipelineConfig = {
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    aaSampleCount: number,
    shadowMapSize?: number
}

export async function createBlinnPhongPipelineBuilder(pipelineConfig: RenderPipelineConfig): Promise<BlinnPhongPipelineBuilder> {
    const device = pipelineConfig.device;
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
        pipelineConfig.canvasFormat,
        pipelineConfig.aaSampleCount,
        pipelineConfig.shadowMapSize,
        [normalTextureBinding]
    );

    return {
        pipeline: pipeline,
        usesNormalData: true,
        createBindGroupsFunc: (config: BlinnPhongBindGroupConfig) => { return createBlinnPhongBindGroup(config, true); }
    };
}

export async function createBlinnPhongPipelineBuilder_NoNormals(pipelineConfig: RenderPipelineConfig): Promise<BlinnPhongPipelineBuilder> {
    const device = pipelineConfig.device;
    const shaderModule = device.createShaderModule({ label: "Blinn Phong Shader without Normals", code: shader });
    
    const pipeline = await createPipeline(
        device,
        shaderModule,
        [CUBE_VERTEX_BUFFER_LAYOUT],
        pipelineConfig.canvasFormat,
        pipelineConfig.aaSampleCount,
        pipelineConfig.shadowMapSize,
        [],
        "vertexMain_alt",
        "fragmentMain_alt"
    );

    return {
        pipeline: pipeline,
        usesNormalData: false,
        createBindGroupsFunc: (config: BlinnPhongBindGroupConfig) => { return createBlinnPhongBindGroup(config, false); }
    };
}

function createBlinnPhongBindGroup(config: BlinnPhongBindGroupConfig, withNormals: boolean) {
    const extras = withNormals ? [{
        binding: 7,
        resource: config.material.normalTexture.createView(),
    }] : [];
    const def = createBindGroup(config.device, config.pipeline, config.instancesBuffer, config.uniforms, config.material, config.sampler, extras);
    const shadow = createShadowMapBindGroup(config.device, config.pipeline, config.shadowMap, config.shadowMapSampler);
    const env = createEnvironmentMapBindGroup(config.device, config.pipeline, config.environmentMap, config.environmentMapSampler)
    return [def, shadow, env];
}