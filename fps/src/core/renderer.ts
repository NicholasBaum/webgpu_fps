import { ModelInstance } from "./modelInstance";
import { SceneSettingsBuffer } from "./primitives/sceneSettingsBuffer";
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";
import { ICamera } from "./camera/camera";
import { Light } from "./light";
import { InstancesBuffer } from "./primitives/instancesBuffer";
import { createBlinnPhongPipelineBuilder, createBlinnPhongPipelineBuilder_NoNormals } from "./pipeline/blinnPhongPipelineBuilder";
import { RenderBindGroupsConfig, RenderPipelineConfig, RenderPipelineInstance, createSampler, createShadowMapSampler } from "./pipeline/pipelineBuilder";
import { ShadowMapArray } from "./shadows/shadowMap";
import { EnvironmentMap } from "./environment/environmentMap";
import { createPbrPipelineBuilder } from "./pipeline/pbrPipelineBuilder";
import { Material, PbrMaterial } from "./materials/pbrMaterial";
import { VertexBufferObject } from "./primitives/vertexBufferObject";
import { groupByValues } from "../helper/groupBy";

export class Renderer {

    public name: string | null = null;

    private groups: RenderGroup[] = [];
    // initialized in the init method
    private pipeline!: RenderPipelineInstance;
    private pipeline_NoNormals!: RenderPipelineInstance;
    private camAndLightUniform!: SceneSettingsBuffer;
    private sampler!: GPUSampler;
    private shadowMapSampler!: GPUSampler;
    private environmentMapSampler!: GPUSampler;
    private pbrPipeline_NoNormals!: RenderPipelineInstance;
    private pbrPipeline!: RenderPipelineInstance;

    constructor(
        private device: GPUDevice,
        private camera: ICamera,
        private lights: Light[],
        private models: ModelInstance[],
        private canvasFormat: GPUTextureFormat,
        private aaSampleCount: number,
        private shadowMap?: ShadowMapArray,
        private environmentMap?: EnvironmentMap
    ) { }

    async initializeAsync() {
        this.sampler = createSampler(this.device);
        this.shadowMapSampler = createShadowMapSampler(this.device);
        this.environmentMapSampler = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

        const config: RenderPipelineConfig = {
            device: this.device,
            canvasFormat: this.canvasFormat,
            aaSampleCount: this.aaSampleCount,
            shadowMapSize: this.shadowMap?.textureSize
        }

        this.pipeline = await createBlinnPhongPipelineBuilder(config);
        this.pipeline_NoNormals = await createBlinnPhongPipelineBuilder_NoNormals(config);
        this.pbrPipeline = await createPbrPipelineBuilder(config);
        this.pbrPipeline_NoNormals = await createPbrPipelineBuilder(config, false);

        this.camAndLightUniform = new SceneSettingsBuffer(this.camera, this.lights, this.environmentMap)
        this.camAndLightUniform.writeToGpu(this.device);


        await this.createRenderGroups();
    }

    render(renderPass: GPURenderPassEncoder) {
        this.camAndLightUniform.writeToGpu(this.device);
        for (let rg of this.groups) {
            rg.instancesBuffer.writeToGpu(this.device)
            rg.material.writeToGpu(this.device);
            renderPass.setPipeline(rg.pipeline);
            for (let i = 0; i < rg.bindGroups.length; i++)
                renderPass.setBindGroup(i, rg.bindGroups[i]);
            renderPass.setVertexBuffer(0, rg.vertexBuffer);
            if (rg.pipeline == this.pipeline.pipeline || rg.pipeline == this.pbrPipeline.pipeline)
                renderPass.setVertexBuffer(1, rg.normalDataBuffer);
            renderPass.draw(rg.vertexCount, rg.instancesCount, 0, 0);
        }
    }

    private async createRenderGroups() {
        // create groups that can be rendered in one pass
        type Key = { vbo: VertexBufferObject, nbo: VertexBufferObject | undefined, mat: Material, builder: RenderPipelineInstance };
        const getKey = (x: ModelInstance) => {
            let builder: RenderPipelineInstance;
            if (x.hasNormals && x.material.hasNormalMap) {
                builder = x.material instanceof PbrMaterial ? this.pbrPipeline : this.pipeline;
                return { vbo: x.vertexBuffer, nbo: x.normalBuffer, mat: x.material, builder: builder }
            } else {
                builder = x.material instanceof PbrMaterial ? this.pbrPipeline_NoNormals : this.pipeline_NoNormals;
                return { vbo: x.vertexBuffer, nbo: undefined, mat: x.material, builder: builder }
            }
        };
        let sorted: Map<Key, ModelInstance[]> = groupByValues(this.models, getKey);

        const baseBindGroupConfig = {
            device: this.device,
            uniforms: this.camAndLightUniform,
            sampler: this.sampler,
            shadowMap: this.shadowMap?.textureArray,
            shadowMapSampler: this.shadowMapSampler,
            environmentMap: this.environmentMap,
            environmentMapSampler: this.environmentMapSampler
        }

        // wrap groups into RenderGroup
        for (let pair of sorted.entries()) {
            const pipeline = pair[0].builder.pipeline;
            const createBindGroups = pair[0].builder.createBindGroupsFunc;
            const refModel = pair[1][0];
            const instancesBuffer = new InstancesBuffer(pair[1]);
            refModel.vertexBuffer.writeToGpu(this.device);
            refModel.normalBuffer?.writeToGpu(this.device);
            await refModel.material.writeTexturesToGpuAsync(this.device, true);
            refModel.material.writeToGpu(this.device);
            instancesBuffer.writeToGpu(this.device);

            // merge "uniform" base with group specific binding resources
            const bindGroupConfig: RenderBindGroupsConfig = {
                ...baseBindGroupConfig, ... {
                    pipeline,
                    instancesBuffer,
                    material: refModel.material,
                }
            };

            // create BindGroup
            const bindGroup = createBindGroups(bindGroupConfig);

            const rg = new RenderGroup(
                instancesBuffer,
                instancesBuffer.length,
                refModel.vertexBuffer.buffer,
                refModel.vertexBuffer.vertexCount,
                refModel.material,
                bindGroup,
                pipeline,
                refModel.normalBuffer?.buffer
            );

            this.groups.push(rg);
        }
    }
}

class RenderGroup {
    constructor(
        public instancesBuffer: InstancesBuffer,
        public instancesCount: number,
        public vertexBuffer: GPUBuffer,
        public vertexCount: number,
        public material: BlinnPhongMaterial | PbrMaterial,
        public bindGroups: GPUBindGroup[],
        public pipeline: GPURenderPipeline,
        public normalDataBuffer: GPUBuffer | null = null,
    ) { }
}