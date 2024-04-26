import { CUBE_VERTEX_BUFFER_LAYOUT } from "../../meshes/cube_mesh";
import shader from "../../shaders/pbr.wgsl"
import pbr_functions from "../../shaders/pbr_functions.wgsl"
import tone_mapping from "../../shaders/tone_mapping.wgsl"
import { RenderBindGroupsConfig, RenderPipelineConfig, RenderPipelineInstance, createBindGroup, createPipeline, createShadowMapBindGroup } from "./pipelineBuilder";
import { PbrMaterial } from "../materials/pbrMaterial";
import { NORMAL_VERTEX_BUFFER_LAYOUT } from "../../meshes/normalDataBuilder";

const SHADER = shader + pbr_functions + tone_mapping;

export async function createPbrPipelineBuilder(pipelineConfig: RenderPipelineConfig, useNormals: boolean = true): Promise<RenderPipelineInstance> {
    const device = pipelineConfig.device;
    const shaderModule = device.createShaderModule({ label: useNormals ? "Pbr Shader" : "Pbr Shader without normals", code: SHADER });
    // pbr uses one more texture than Blinn-Phong
    const texture = { binding: 7, visibility: GPUShaderStage.FRAGMENT, texture: {} };
    const normalTexture = { binding: 8, visibility: GPUShaderStage.FRAGMENT, texture: {} }

    const environmentMapGroup: GPUBindGroupLayoutEntry[] = [
        {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: 'filtering' }
        },
        {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "cube", }
        },
        {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "cube", }
        },
        {
            binding: 3,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { viewDimension: "2d", }
        },
    ];

    const pipeline = await createPipeline(device,
        shaderModule,
        useNormals ? [CUBE_VERTEX_BUFFER_LAYOUT, NORMAL_VERTEX_BUFFER_LAYOUT] : [CUBE_VERTEX_BUFFER_LAYOUT],
        pipelineConfig.canvasFormat,
        pipelineConfig.aaSampleCount,
        pipelineConfig.shadowMapSize,
        useNormals ? [texture, normalTexture] : [texture],
        useNormals ? "vertexMain" : "vertexMain_alt",
        useNormals ? "fragmentMain" : "fragmentMain_alt",
        environmentMapGroup
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
    const env = createEnvironmentMapBindGroup(config)
    return [def, shadow, env];
}

function createEnvironmentMapBindGroup(config: RenderBindGroupsConfig) {

    const device = config.device;
    // create dummy if necessary
    let irr = config.environmentMap?.irradianceMap ?? device.createTexture({
        size: [1, 1, 6],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: 'rgba8unorm',
    });

    let pref = config.environmentMap?.prefilteredMap ?? device.createTexture({
        size: [1, 1, 6],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: 'rgba8unorm',
    });

    let brdf = config.environmentMap?.brdfMap ?? device.createTexture({
        size: [1, 1, 1],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: 'rgba8unorm',
    });

    let desc = {
        label: "environment map binding group pbr",
        layout: config.pipeline.getBindGroupLayout(2),
        entries: [
            {
                binding: 0,
                resource: config.environmentMapSampler,
            },
            {
                binding: 1,
                resource: irr.createView({ dimension: "cube", }),
            },
            {
                binding: 2,
                resource: pref.createView({ dimension: "cube", }),
            },
            {
                binding: 3,
                resource: brdf.createView(),
            },

        ],
    };

    return device.createBindGroup(desc);
}