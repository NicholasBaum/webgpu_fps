import { ModelAsset } from "./modelAsset";
import { ModelInstance } from "./modelInstance";
import { Scene } from "./scene";
import { CameraAndLightsBufferWriter } from "./cameraAndLightsBufferWriter";
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";
import { Camera } from "./camera/camera";
import { Light } from "./light";
import { InstancesBufferWriter } from "./instancesBufferWriter";
import { createBlinnPhongPipeline_w_Normals, createBlinnPhongBindGroup_w_Normals } from "./normalPipelineBuilder";
import { createBlinnPhongBindGroup, createBlinnPhongPipeline, createSampler, createShadowMapSampler } from "./pipelineBuilder";
import { ShadowMapArray } from "./renderers/shadowMap";

enum PipelineMode {
    BlinnPhong,
    NormalMap,
}

type RenderGroupKey = { asset: ModelAsset, mode: PipelineMode };

export class Renderer {

    private sceneMap: Map<RenderGroupKey, ModelInstance[]>;
    private lights: Light[];
    private camera: Camera;
    private groups: RenderGroup[] = [];
    // initialized in the init method
    private blinnPhongPipeline!: GPURenderPipeline;
    private normalPipeline!: GPURenderPipeline;
    private camAndLightUniform!: CameraAndLightsBufferWriter;


    constructor(private device: GPUDevice, private scene: Scene, private canvasFormat: GPUTextureFormat,
        private aaSampleCount: number, private shadowMap: ShadowMapArray | undefined) {

        this.sceneMap = this.groupByAsset(scene.models);

        this.lights = scene.lights;
        this.camera = scene.camera;
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

    async initializeAsync() {
        let sampler = createSampler(this.device);
        let shadowMapSampler = createShadowMapSampler(this.device);

        this.blinnPhongPipeline = await createBlinnPhongPipeline(this.device, this.canvasFormat, this.aaSampleCount, this.shadowMap?.textureSize);
        this.normalPipeline = await createBlinnPhongPipeline_w_Normals(this.device, this.canvasFormat, this.aaSampleCount, this.shadowMap?.textureSize);

        this.camAndLightUniform = new CameraAndLightsBufferWriter(this.camera, this.lights)
        this.camAndLightUniform.writeToGpu(this.device);

        for (let pair of this.sceneMap.entries()) {
            let pipeline = pair[0].mode == PipelineMode.BlinnPhong ? this.blinnPhongPipeline : this.normalPipeline;
            let asset = pair[0].asset;
            asset.writeMeshToGpu(this.device);
            await asset.material.writeTexturesToGpuAsync(this.device, true);
            asset.material.writeToGpu(this.device);
            const instancesBuffer = new InstancesBufferWriter(pair[1]);
            instancesBuffer.writeToGpu(this.device);

            let bindGroupResources = {
                device: this.device,
                pipeline,
                instancesBuffer,
                uniforms: this.camAndLightUniform,
                material: asset.material,
                sampler,
                shadowMap: this.shadowMap?.textureArray,
                shadowMapSampler
            };

            let rg = new RenderGroup(
                instancesBuffer,
                instancesBuffer.instances.length,
                asset.vertexBuffer!,
                asset.vertexCount,
                asset.material,
                this.blinnPhongPipeline == pipeline ?
                    createBlinnPhongBindGroup(bindGroupResources) :
                    createBlinnPhongBindGroup_w_Normals(bindGroupResources),
                pipeline,
                asset.normalBuffer
            );
            this.groups.push(rg);
        }
    }


    groupByAsset(instances: ModelInstance[]): Map<RenderGroupKey, ModelInstance[]> {
        const getKey = (x: ModelInstance) => {
            let mode = x.asset.material.normalMapPath != null ? PipelineMode.NormalMap : PipelineMode.BlinnPhong;
            return { asset: x.asset, mode: mode }
        };
        let groups: Map<RenderGroupKey, ModelInstance[]> = instances.reduce((acc, m) => {
            let key = getKey(m);
            if (!acc.has(key))
                acc.set(key, []);
            acc.get(key)?.push(m);
            return acc;
        }, new Map<RenderGroupKey, ModelInstance[]>());

        // add light renderables
        let lightModels = this.scene.lights.map(x => x.model)
        if (lightModels.length > 0)
            groups.set({ asset: lightModels[0].asset, mode: PipelineMode.BlinnPhong }, lightModels)
        return groups;
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