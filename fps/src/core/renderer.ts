import { ModelInstance } from "./modelInstance";
import { Scene } from "./scene";
import { CameraAndLightsBufferWriter } from "./cameraAndLightsBufferWriter";
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";
import { Camera } from "./camera/camera";
import { Light } from "./light";
import { InstancesBufferWriter } from "./instancesBufferWriter";
import { BlinnPhongBindGroupConfig, BlinnPhongPipelineBuilder, BlinnPhongPipelineConfig, createBlinnPhongPipelineBuilder, createBlinnPhongPipelineBuilder_NoNormals } from "./blinnPhongPipelineBuilder";
import { createSampler, createShadowMapSampler } from "./pipelineBuilder";
import { ShadowMapArray } from "./renderers/shadowMap";
import { groupBy } from "../helper/linq";

// implements the Blinn Phong shader model with shadow maps
// utilizes two pipeline types one with normals and one without
// shadow maps can be undefined
export class Renderer {

    public name: string | null = null;

    private groups: RenderGroup[] = [];
    // initialized in the init method
    private pipeline!: BlinnPhongPipelineBuilder;
    private pipeline_NoNormals!: BlinnPhongPipelineBuilder;
    private camAndLightUniform!: CameraAndLightsBufferWriter;
    private sampler!: GPUSampler;
    private shadowMapSampler!: GPUSampler;

    constructor(
        private device: GPUDevice,
        private camera: Camera,
        private lights: Light[],
        private models: ModelInstance[],
        private canvasFormat: GPUTextureFormat,
        private aaSampleCount: number,
        private shadowMap?: ShadowMapArray
    ) { }

    async initializeAsync() {
        this.sampler = createSampler(this.device);
        this.shadowMapSampler = createShadowMapSampler(this.device);

        const config: BlinnPhongPipelineConfig = {
            device: this.device,
            canvasFormat: this.canvasFormat,
            aaSampleCount: this.aaSampleCount,
            shadowMapSize: this.shadowMap?.textureSize
        }

        this.pipeline = await createBlinnPhongPipelineBuilder(config);
        this.pipeline_NoNormals = await createBlinnPhongPipelineBuilder_NoNormals(config);

        this.camAndLightUniform = new CameraAndLightsBufferWriter(this.camera, this.lights)
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
            if (this.pipeline.usesNormalData)
                renderPass.setVertexBuffer(1, rg.normalDataBuffer);
            renderPass.draw(rg.vertexCount, rg.instancesCount, 0, 0);
        }
    }

    private async createRenderGroups() {
        const getKey = (x: ModelInstance) => {
            let builder = x.asset.material.normalMapPath == null ? this.pipeline_NoNormals : this.pipeline;
            return { asset: x.asset, builder: builder }
        };
        // create all {asset x pipeline}-groups
        let sorted = groupBy(this.models, getKey);

        // add light group
        if (this.lights.length > 0)
            sorted.set({ asset: this.lights[0].model.asset, builder: this.pipeline_NoNormals }, this.lights.map(x => x.model))

        const baseBindGroupConfig = {
            device: this.device,
            uniforms: this.camAndLightUniform,
            sampler: this.sampler,
            shadowMap: this.shadowMap?.textureArray,
            shadowMapSampler: this.shadowMapSampler
        }

        // wrap groups into RenderGroup
        for (let pair of sorted.entries()) {

            const pipeline = pair[0].builder.pipeline;
            const createBindGroups = pair[0].builder.createBindGroupsFunc;
            const asset = pair[0].asset;
            const instancesBuffer = new InstancesBufferWriter(pair[1]);

            asset.writeMeshToGpu(this.device);
            await asset.material.writeTexturesToGpuAsync(this.device, true);
            asset.material.writeToGpu(this.device);
            instancesBuffer.writeToGpu(this.device);

            // merge "uniform" base with group specific binding resources
            const bindGroupConfig: BlinnPhongBindGroupConfig = {
                ...baseBindGroupConfig, ... {
                    pipeline,
                    instancesBuffer,
                    material: asset.material,
                }
            };

            // create BindGroup
            const bindGroup = createBindGroups(bindGroupConfig);

            const rg = new RenderGroup(
                instancesBuffer,
                instancesBuffer.length,
                asset.vertexBuffer!,
                asset.vertexCount,
                asset.material,
                bindGroup,
                pipeline,
                asset.normalBuffer
            );

            this.groups.push(rg);
        }
    }
}

class RenderGroup {
    constructor(
        public instancesBuffer: InstancesBufferWriter,
        public instancesCount: number,
        public vertexBuffer: GPUBuffer,
        public vertexCount: number,
        public material: BlinnPhongMaterial,
        public bindGroups: GPUBindGroup[],
        public pipeline: GPURenderPipeline,
        public normalDataBuffer: GPUBuffer | null = null,
    ) { }
}