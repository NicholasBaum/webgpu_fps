import { ModelAsset } from "./modelAsset";
import { ModelInstance } from "./modelInstance";
import { Scene } from "./scene";
import { CameraAndLightsBufferWriter } from "./cameraAndLightsBufferWriter";
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";
import { Camera } from "./camera/camera";
import { createBindGroup, createDefaultPipeline, createSampler, } from "./pipelineBuilder";
import { Light } from "./light";
import { InstancesBufferWriter } from "./instancesBufferWriter";



// shaderModule, pipeline, sampler are always constant
// lights are constant for all assets in one pass
// vertex data is constant per asset
// material and uniforms

export class Renderer {

    private groups: RenderGroup[] = [];

    private sceneMap: Map<ModelAsset, ModelInstance[]>;
    private lights: Light[];
    private camera: Camera;
    private pipeline: GPURenderPipeline | null = null;

    constructor(public device: GPUDevice, scene: Scene, private canvasFormat: GPUTextureFormat, private aaSampleCount: number) {
        this.sceneMap = this.groupByAsset(scene.models);
        this.lights = scene.lights;
        this.camera = scene.camera;
    }

    async initializeAsync() {
        let sampler = createSampler(this.device);

        this.pipeline = await createDefaultPipeline(
            this.device,
            this.canvasFormat,
            this.aaSampleCount
        );

        //this.lights.writeToGpu(this.device);
        this.uniforms = new CameraAndLightsBufferWriter(this.camera, this.lights)
        this.uniforms.writeToGpu(this.device);
        for (let group of this.sceneMap.values()) {
            let asset = group[0].asset;
            asset.writeMeshToGpu(this.device);
            await asset.material.writeTexturesToGpuAsync(this.device, true);
            asset.material.writeToGpu(this.device);
            const instanceBuffer = new InstancesBufferWriter(group);
            instanceBuffer.writeToGpu(this.device);
            let rg = new RenderGroup(
                this.device,
                this.pipeline,
                instanceBuffer,
                group.length,
                asset.vertexBuffer!,
                asset.vertexCount,
                asset.material,
                sampler,
                this.uniforms,
            );
            this.groups.push(rg);
        }
    }
    private uniforms!: CameraAndLightsBufferWriter;
    render(renderPass: GPURenderPassEncoder) {
        //this.lights.writeToGpu(this.device);
        // TODO: this.camera.writeToGpu(this.device);
        this.uniforms.writeToGpu(this.device);
        for (let g of this.groups) {
            g.writeToGpu(this.device);
            // TODO: switch to camera, light, instance data implementation
            renderPass.setPipeline(this.pipeline!);
            renderPass.setBindGroup(0, g.bindGroup);
            renderPass.setVertexBuffer(0, g.vertexBuffer);
            renderPass.draw(g.vertexCount, g.instancesCount, 0, 0);
        }
    }

    groupByAsset(instances: ModelInstance[]): Map<ModelAsset, ModelInstance[]> {
        let groups: Map<ModelAsset, ModelInstance[]> = instances.reduce((acc, m) => {
            let key = m.asset;
            if (!acc.has(key))
                acc.set(key, []);
            acc.get(key)?.push(m);
            return acc;
        }, new Map<ModelAsset, ModelInstance[]>());
        return groups;
    }
}

class RenderGroup {
    public bindGroup: GPUBindGroup;
    public vertexBuffer: GPUBuffer;
    public vertexCount: number;
    public instancesCount: number;

    private instancesBuffer: InstancesBufferWriter;

    constructor(
        device: GPUDevice,
        pipeline: GPURenderPipeline,
        instances: InstancesBufferWriter,
        instancesCount: number,
        vertexBuffer: GPUBuffer,
        vertexCount: number,
        material: BlinnPhongMaterial,
        sampler: GPUSampler,
        uniforms: CameraAndLightsBufferWriter
    ) {
        this.vertexBuffer = vertexBuffer;
        this.vertexCount = vertexCount;
        this.instancesCount = instancesCount;
        this.instancesBuffer = instances;
        this.bindGroup = createBindGroup(device, pipeline, this.instancesBuffer, uniforms, material, sampler);
    }

    writeToGpu(device: GPUDevice) {
        this.instancesBuffer.writeToGpu(device);
    }

}