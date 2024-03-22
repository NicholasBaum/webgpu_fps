import { RenderBindGroupsConfig, RenderPipelineInstance, RenderPipelineConfig } from "../blinnPhongPipelineBuilder";
import { CUBE_VERTEX_BUFFER_LAYOUT } from "../../meshes/cube_mesh";
import shader from "../../shaders/pbr.wgsl"
import { createBindGroup, createEnvironmentMapBindGroup, createPipeline, createShadowMapBindGroup } from "../pipelineBuilder";
import { PbrMaterial } from "../materials/pbrMaterial";
import { NORMAL_VERTEX_BUFFER_LAYOUT } from "../../meshes/normalDataBuilder";

export async function createPbrPipelineBuilder(pipelineConfig: RenderPipelineConfig, useNormals: boolean = true): Promise<RenderPipelineInstance> {
    const device = pipelineConfig.device;
    const shaderModule = device.createShaderModule({ label: useNormals ? "Pbr Shader" : "Pbr Shader without normals", code: shader });
    // pbr uses one more texture than Blinn-Phong
    const texture = { binding: 7, visibility: GPUShaderStage.FRAGMENT, texture: {} };
    const normalTexture = { binding: 8, visibility: GPUShaderStage.FRAGMENT, texture: {} }

    const pipeline = await createPipeline(device,
        shaderModule,
        useNormals ? [CUBE_VERTEX_BUFFER_LAYOUT, NORMAL_VERTEX_BUFFER_LAYOUT] : [CUBE_VERTEX_BUFFER_LAYOUT],
        pipelineConfig.canvasFormat,
        pipelineConfig.aaSampleCount,
        pipelineConfig.shadowMapSize,
        useNormals ? [texture, normalTexture] : [texture],
        useNormals ? "vertexMain" : "vertexMain_alt",
        useNormals ? "fragmentMain" : "fragmentMain_alt",
    );

    return {
        pipeline: pipeline,
        usesNormalData: useNormals,
        createBindGroupsFunc: (config: RenderBindGroupsConfig) => { return createPbrBindGroup(config, useNormals); }
    };
}

function createPbrBindGroup(config: RenderBindGroupsConfig, withNormals: boolean) {

    const texture = { binding: 7, resource: (config.material as PbrMaterial).roughnessTexture.createView(), };
    const normalTexture = { binding: 8, resource: config.material.normalTexture.createView(), };
    const extras = withNormals ? [texture, normalTexture] : [texture];

    const def = createBindGroup(config.device, config.pipeline, config.instancesBuffer, config.uniforms, config.material, config.sampler, extras);
    const shadow = createShadowMapBindGroup(config.device, config.pipeline, config.shadowMap, config.shadowMapSampler);
    const env = createEnvironmentMapBindGroup(config.device, config.pipeline, config.environmentMap, config.environmentMapSampler)
    return [def, shadow, env];
}