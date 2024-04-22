import { CUBE_VERTEX_BUFFER_LAYOUT } from '../../meshes/cube_mesh';
import { RenderBindGroupsConfig, RenderPipelineConfig, RenderPipelineInstance, createBindGroup, createEnvironmentMapBindGroup, createPipeline, createShadowMapBindGroup } from './pipelineBuilder';
import { NORMAL_VERTEX_BUFFER_LAYOUT } from '../../meshes/normalDataBuilder';

import shader from '../../shaders/blinn_phong.wgsl';

export async function createBlinnPhongPipelineBuilder(pipelineConfig: RenderPipelineConfig): Promise<RenderPipelineInstance> {
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
        createBindGroupsFunc: (config: RenderBindGroupsConfig) => { return createBlinnPhongBindGroup(config, true); }
    };
}

export async function createBlinnPhongPipelineBuilder_NoNormals(pipelineConfig: RenderPipelineConfig): Promise<RenderPipelineInstance> {
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
        createBindGroupsFunc: (config: RenderBindGroupsConfig) => { return createBlinnPhongBindGroup(config, false); }
    };
}

function createBlinnPhongBindGroup(config: RenderBindGroupsConfig, withNormals: boolean) {
    const extras = withNormals ? [{
        binding: 7,
        resource: config.material.normalTexture.createView(),
    }] : [];
    const def = createBindGroup(config.device, config.pipeline, config.instancesBuffer, config.uniforms, config.material, config.sampler, extras);
    const shadow = createShadowMapBindGroup(config.device, config.pipeline, config.shadowMap, config.shadowMapSampler);
    const env = createEnvironmentMapBindGroup(config.device, config.pipeline, config.environmentMap?.cubeMap.gpuTexture, config.environmentMapSampler)
    return [def, shadow, env];
}