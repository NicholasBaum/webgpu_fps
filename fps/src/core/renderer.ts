import { ModelAsset } from "./modelAsset";
import { ModelInstance } from "./modelInstance";
import { Scene } from "./scene";
import { CameraAndLightsBufferWriter } from "./cameraAndLightsBufferWriter";
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";
import { Camera } from "./camera/camera";
import { createBindGroup, createDefaultPipeline, createSampler, } from "./pipelineBuilder";
import { Light } from "./light";
import { InstancesBufferWriter } from "./instancesBufferWriter";


// every can be rendered in multiple passes
// every pass uses a pipeline which corresponds to a shader program
// pipelines are defined by a BindGroupLayout and VertexBufferLayout among other things
// first one describes the "uniform" variables of the shader 
// last one the input parameters of the vertex shader function
// every pass needs to set a pipeline and bind the "uniform" data as BindGroup as well as the vertex data

// the ModelInstances are grouped by assets into RenderGroups
// so all instances of one asset can be rendered in one pass

// shaderModule, pipeline, sampler are always the same after Renderer initialization
// vertex data, textures are written to the gpu once per RenderGroup on initialization
// lights and camera are written to the gpu once per frame
// instances data + material parameters are of a RenderGroup is written once per corresponding pass meaning once per frame

export class Renderer {

    private sceneMap: Map<ModelAsset, ModelInstance[]>;
    private lights: Light[];
    private camera: Camera;
    private groups: RenderGroup[] = [];
    // initialized in the init method
    private pipeline!: GPURenderPipeline;
    private camAndLightUniform!: CameraAndLightsBufferWriter;


    constructor(public device: GPUDevice, scene: Scene, private canvasFormat: GPUTextureFormat, private aaSampleCount: number) {
        this.sceneMap = this.groupByAsset(scene.models);
        this.lights = scene.lights;
        this.camera = scene.camera;
    }

    render(renderPass: GPURenderPassEncoder) {
        this.camAndLightUniform.writeToGpu(this.device);
        for (let g of this.groups) {
            g.writeToGpu(this.device);
            renderPass.setPipeline(this.pipeline);
            renderPass.setBindGroup(0, g.bindGroup);
            renderPass.setVertexBuffer(0, g.vertexBuffer);
            renderPass.draw(g.vertexCount, g.instancesCount, 0, 0);
        }
    }

    async initializeAsync() {
        let sampler = createSampler(this.device);

        this.pipeline = await createDefaultPipeline(
            this.device,
            this.canvasFormat,
            this.aaSampleCount
        );

        this.camAndLightUniform = new CameraAndLightsBufferWriter(this.camera, this.lights)
        this.camAndLightUniform.writeToGpu(this.device);

        for (let instances of this.sceneMap.values()) {
            let asset = instances[0].asset;
            asset.writeMeshToGpu(this.device);
            await asset.material.writeTexturesToGpuAsync(this.device, true);
            asset.material.writeToGpu(this.device);
            const instancesBuffer = new InstancesBufferWriter(instances);
            instancesBuffer.writeToGpu(this.device);
            let rg = new RenderGroup(
                this.device,
                this.pipeline,
                instancesBuffer,
                instances.length,
                asset.vertexBuffer!,
                asset.vertexCount,
                asset.material,
                sampler,
                this.camAndLightUniform,
            );
            this.groups.push(rg);
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
    private material: BlinnPhongMaterial;

    constructor(
        device: GPUDevice,
        pipeline: GPURenderPipeline,
        instancesBuffer: InstancesBufferWriter,
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
        this.instancesBuffer = instancesBuffer;
        this.material = material;
        this.bindGroup = createBindGroup(device, pipeline, this.instancesBuffer, uniforms, material, sampler);
    }

    writeToGpu(device: GPUDevice) {
        this.instancesBuffer.writeToGpu(device);
        this.material.writeToGpu(device);
    }

}