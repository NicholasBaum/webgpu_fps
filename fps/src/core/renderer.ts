import { ModelAsset } from "./modelAsset";
import { ModelInstance } from "./modelInstance";
import { LightsArray } from "./lightsArray";
import { Scene } from "./scene";
import { MeshRendererUniforms } from "./meshRendererUniforms";
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";
import { Camera } from "./camera/camera";
import { createBindGroup, createDefaultPipeline, createSampler, } from "./pipelineBuilder";



// shaderModule, pipeline, sampler are always constant
// lights are constant for all assets in one pass
// vertex data is constant per asset
// material and uniforms

export class InstancesRenderer {

    private groups: RenderGroup[] = [];

    private sceneMap: Map<ModelAsset, ModelInstance[]>;
    private lights: LightsArray;
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

        this.lights.writeToGpu(this.device);

        for (let group of this.sceneMap.values()) {
            let asset = group[0].asset;
            asset.writeMeshToGpu(this.device);
            await asset.material.writeTexturesToGpuAsync(this.device, true);
            asset.material.writeToGpu(this.device);
            let rg = new RenderGroup(
                this.device,
                this.pipeline,
                group,
                asset.vertexBuffer!,
                asset.vertexCount,
                asset.material,
                sampler,
                this.lights,
                this.camera
            );
            this.groups.push(rg);
            //rg.uniforms.writeToGpu(this.device);
        }
    }

    render(renderPass: GPURenderPassEncoder) {
        this.lights.writeToGpu(this.device);
        // TODO: this.camera.writeToGpu(this.device);
        for (let g of this.groups) {
            g.uniforms.writeToGpu(this.device);
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
    get instancesCount(): number { return this.instances.length; }
    public uniforms: MeshRendererUniforms;

    private instances: ModelInstance[];

    constructor(
        device: GPUDevice,
        pipeline: GPURenderPipeline,
        instances: ModelInstance[],
        vertexBuffer: GPUBuffer,
        vertexCount: number,
        material: BlinnPhongMaterial,
        sampler: GPUSampler,
        lights: LightsArray,
        camera: Camera,
    ) {
        if (instances.length < 1) {
            throw new RangeError("instances can't be empty");
        }
        this.instances = instances;
        this.vertexBuffer = vertexBuffer;
        this.vertexCount = vertexCount;
        this.uniforms = new MeshRendererUniforms(camera, this.instances)
        this.uniforms.writeToGpu(device);
        //TODO: remove inits from here
        this.bindGroup = createBindGroup(device, pipeline, this.uniforms, lights, material, sampler);
    }
}