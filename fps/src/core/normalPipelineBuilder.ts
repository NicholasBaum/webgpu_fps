import { CUBE_VERTEX_BUFFER_LAYOUT } from '../meshes/cube_mesh';
import shader from '../shaders/blinn_phong.wgsl';
import { BlinnPhongBindGroupDesc, createBindGroup, createPipeline } from './pipelineBuilder';

export async function createBlinnPhongPipeline_w_Normals(
    device: GPUDevice,
    canvasFormat: GPUTextureFormat,
    aaSampleCount: number
): Promise<GPURenderPipeline> {
    const shaderModule = device.createShaderModule({ label: "Normal Shader", code: shader });
    const normalTextureBinding = {
        binding: 7,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
    };
    return createPipeline(device, shaderModule, [CUBE_VERTEX_BUFFER_LAYOUT, NORMAL_VERTEX_BUFFER_LAYOUT], canvasFormat, aaSampleCount, [normalTextureBinding]);
}

export function createBlinnPhongBindGroup_w_Normals(config: BlinnPhongBindGroupDesc) {

    const normalTextureBindGroup: GPUBindGroupEntry = {
        binding: 7,
        resource: config.material.normalTexture.createView(),
    }

    return createBindGroup(config.device, config.pipeline, config.instancesBuffer, config.uniforms,
        config.material, config.sampler, config.shadowMap, config.shadowMapSampler, [normalTextureBindGroup]);
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