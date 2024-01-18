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
import { ShadowMap } from "./renderers/shadowMapRenderer";

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
        private aaSampleCount: number, private shadowMap: ShadowMap | null) {

        this.sceneMap = this.groupByAsset(scene.models);

        this.lights = scene.lights;
        this.camera = scene.camera;
    }

    render(renderPass: GPURenderPassEncoder) {
        this.camAndLightUniform.writeToGpu(this.device);
        for (let g of this.groups) {
            g.writeToGpu(this.device);
            renderPass.setPipeline(g.pipeline);
            for (let i = 0; i < g.bindGroups.length; i++)
                renderPass.setBindGroup(i, g.bindGroups[i]);
            renderPass.setVertexBuffer(0, g.vertexBuffer);
            if (this.normalPipeline == g.pipeline)
                renderPass.setVertexBuffer(1, g.normalDataBuffer);
            renderPass.draw(g.vertexCount, g.instancesCount, 0, 0);
        }
    }

    async initializeAsync() {
        let sampler = createSampler(this.device);
        let shadowMapSampler = createShadowMapSampler(this.device);

        this.blinnPhongPipeline = await createBlinnPhongPipeline(this.device, this.canvasFormat, this.aaSampleCount);
        this.normalPipeline = await createBlinnPhongPipeline_w_Normals(this.device, this.canvasFormat, this.aaSampleCount);

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

            let config = {
                device: this.device,
                pipeline,
                instancesBuffer,
                uniforms: this.camAndLightUniform,
                material: asset.material,
                sampler,
                shadowMap: this.shadowMap ? this.shadowMap.texture : null,
                shadowMapSampler
            };

            let rg = new RenderGroup(
                instancesBuffer,
                asset.vertexBuffer!,
                asset.vertexCount,
                asset.material,
                this.blinnPhongPipeline == pipeline ?
                    createBlinnPhongBindGroup(config) :
                    createBlinnPhongBindGroup_w_Normals(config),
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
    public instancesCount: number;
    constructor(
        private instancesBuffer: InstancesBufferWriter,
        public vertexBuffer: GPUBuffer,
        public vertexCount: number,
        private material: BlinnPhongMaterial,
        public bindGroups: GPUBindGroup[],
        public pipeline: GPURenderPipeline,
        public normalDataBuffer: GPUBuffer | null = null,
    ) {
        this.instancesCount = instancesBuffer.instances.length;
    }

    writeToGpu(device: GPUDevice) {
        this.instancesBuffer.writeToGpu(device);
        this.material.writeToGpu(device);
    }
}