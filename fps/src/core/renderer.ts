import { ModelInstance } from "./modelInstance";
import { Scene } from "./scene";
import { CameraAndLightsBufferWriter } from "./cameraAndLightsBufferWriter";
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";
import { Camera } from "./camera/camera";
import { Light } from "./light";
import { InstancesBufferWriter } from "./instancesBufferWriter";
import { createBlinnPhongPipeline_w_Normals, createBlinnPhongBindGroup_w_Normals, createBlinnPhongBindGroup, createBlinnPhongPipeline } from "./blinnPhongPipelineBuilder";
import { createSampler, createShadowMapSampler } from "./pipelineBuilder";
import { ShadowMapArray } from "./renderers/shadowMap";
import { groupBy } from "../helper/linq";

export class Renderer {

    private lights: Light[];
    private camera: Camera;
    private groups: RenderGroup[] = [];
    // initialized in the init method
    private blinnPhongPipeline!: GPURenderPipeline;
    private normalPipeline!: GPURenderPipeline;
    private camAndLightUniform!: CameraAndLightsBufferWriter;
    private sampler!: GPUSampler;
    private shadowMapSampler!: GPUSampler;


    constructor(private device: GPUDevice, private scene: Scene, private canvasFormat: GPUTextureFormat,
        private aaSampleCount: number, private shadowMap: ShadowMapArray | undefined) {
        this.lights = scene.lights;
        this.camera = scene.camera;
    }

    async initializeAsync() {
        this.sampler = createSampler(this.device);
        this.shadowMapSampler = createShadowMapSampler(this.device);

        this.blinnPhongPipeline = await createBlinnPhongPipeline(this.device, this.canvasFormat, this.aaSampleCount, this.shadowMap?.textureSize);
        this.normalPipeline = await createBlinnPhongPipeline_w_Normals(this.device, this.canvasFormat, this.aaSampleCount, this.shadowMap?.textureSize);

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
            if (this.normalPipeline == rg.pipeline)
                renderPass.setVertexBuffer(1, rg.normalDataBuffer);
            renderPass.draw(rg.vertexCount, rg.instancesCount, 0, 0);
        }
    }

    private async createRenderGroups() {
        const getKey = (x: ModelInstance) => {
            let pipeline = x.asset.material.normalMapPath == null ? this.blinnPhongPipeline : this.normalPipeline;
            return { asset: x.asset, pipeline }
        };
        // create all {asset x pipeline}-groups
        let sorted = groupBy(this.scene.models, getKey);

        // add light group
        if (this.lights.length > 0)
            sorted.set({ asset: this.lights[0].model.asset, pipeline: this.blinnPhongPipeline }, this.lights.map(x => x.model))

        const baseBindGroupConfig = {
            device: this.device,
            uniforms: this.camAndLightUniform,
            sampler: this.sampler,
            shadowMap: this.shadowMap?.textureArray,
            shadowMapSampler: this.shadowMapSampler
        }

        // wrap groups into RenderGroup
        for (let pair of sorted.entries()) {

            const pipeline = pair[0].pipeline;
            const asset = pair[0].asset;
            const instancesBuffer = new InstancesBufferWriter(pair[1]);

            asset.writeMeshToGpu(this.device);
            await asset.material.writeTexturesToGpuAsync(this.device, true);
            asset.material.writeToGpu(this.device);
            instancesBuffer.writeToGpu(this.device);

            // merge "uniform" base with group specific binding resources
            const bindGroupConfig = {
                ...baseBindGroupConfig, ... {
                    pipeline,
                    instancesBuffer,
                    material: asset.material,
                }
            };

            // create BindGroup
            const bindGroup = this.blinnPhongPipeline == pipeline ?
                createBlinnPhongBindGroup(bindGroupConfig) :
                createBlinnPhongBindGroup_w_Normals(bindGroupConfig);

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