import { groupByValues } from "../../helper/groupBy";
import { ICamera } from "../camera/camera";
import { EnvironmentMap } from "../environment/environmentMap";
import { EnvironmentRenderer, createEnvironmentRenderer } from "../environment/environmentRenderer";
import { Light } from "../light";
import { Material, PbrMaterial } from "../materials/pbrMaterial";
import { ModelInstance } from "../modelInstance";
import { InstancesBuffer } from "../primitives/instancesBuffer";
import { SceneSettingsBuffer } from "../primitives/sceneSettingsBuffer";
import { VertexBufferObject } from "../primitives/vertexBufferObject";
import { Scene } from "../scene";
import { ShadowMapArray } from "../shadows/shadowMap";
import { PbrRenderer, createBlinnPhongRenderer, createPbrRenderer } from "./pbrRenderer";

export async function createSceneRenderer(device: GPUDevice, scene: Scene, shadowMap?: ShadowMapArray) {
    return await new SceneRenderer(scene.camera, scene.lights, scene.models, scene.environmentMap, shadowMap).buildAsync(device);
}

export async function createLightViewRenderers(device: GPUDevice, scene: Scene, shadowMap?: ShadowMapArray) {
    return await Promise.all(
        scene.lights
            .filter(x => !!x.shadowMap)
            .map(x => new SceneRenderer(x.shadowMap!.camera, scene.lights, scene.models, scene.environmentMap, shadowMap)
                .buildAsync(device))
    );
}

export class SceneRenderer {

    renderBackground = true;

    // gets assigned in the buildAsync
    private device!: GPUDevice;
    private pbrRenderer!: PbrRenderer;
    private pbrRenderer_NN!: PbrRenderer;
    private blinnRenderer!: PbrRenderer;
    private blinnRenderer_NN!: PbrRenderer;
    private environmentRenderer?: EnvironmentRenderer;

    private sceneSettingsBuffer: SceneSettingsBuffer;
    private groups: RenderGroup[] = [];

    constructor(
        private camera: ICamera,
        private lights: Light[],
        private models: ModelInstance[],
        private environmentMap?: EnvironmentMap,
        private shadowMap?: ShadowMapArray
    ) {
        this.renderBackground = !!environmentMap;
        this.sceneSettingsBuffer = new SceneSettingsBuffer(this.camera, this.lights, this.renderBackground)
    }

    async buildAsync(device: GPUDevice) {
        this.device = device;
        this.pbrRenderer = await createPbrRenderer(this.device);
        this.pbrRenderer_NN = await createPbrRenderer(this.device, false);
        this.blinnRenderer = await createBlinnPhongRenderer(this.device);
        this.blinnRenderer_NN = await createBlinnPhongRenderer(this.device, false);
        if (this.environmentMap)
            this.environmentRenderer = await createEnvironmentRenderer(device, this.camera, this.environmentMap.cubeMap)
        await this.createRenderGroups();

        return this;
    }

    render(renderPass: GPURenderPassEncoder) {
        this.sceneSettingsBuffer.writeToGpu(this.device);
        for (let g of this.groups) {
            g.instancesBuffer.writeToGpu(this.device)
            g.material.writeToGpu(this.device);
            if (g.material instanceof PbrMaterial)
                if (g.instancesBuffer.normalBuffer && g.material.hasNormalMap)
                    this.pbrRenderer.render(renderPass, g.instancesBuffer, g.material, this.sceneSettingsBuffer, this.environmentMap, this.shadowMap);
                else
                    this.pbrRenderer_NN.render(renderPass, g.instancesBuffer, g.material, this.sceneSettingsBuffer, this.environmentMap, this.shadowMap);
            else
                if (g.instancesBuffer.normalBuffer && g.material.hasNormalMap)
                    this.blinnRenderer.render(renderPass, g.instancesBuffer, g.material, this.sceneSettingsBuffer, this.environmentMap, this.shadowMap);
                else
                    this.blinnRenderer_NN.render(renderPass, g.instancesBuffer, g.material, this.sceneSettingsBuffer, this.environmentMap, this.shadowMap);
        }

        // render environment background
        if (this.renderBackground)
            this.environmentRenderer?.render(renderPass);
    }

    private async createRenderGroups() {
        // create groups that can be rendered in one pass
        type Key = { vbo: VertexBufferObject, nbo: VertexBufferObject | undefined, mat: Material };
        const getKey = (x: ModelInstance) => {
            if (x.hasNormals && x.material.hasNormalMap) {
                return { vbo: x.vertexBuffer, nbo: x.normalBuffer, mat: x.material }
            } else {
                return { vbo: x.vertexBuffer, nbo: undefined, mat: x.material }
            }
        };
        let groups: Map<Key, ModelInstance[]> = groupByValues(this.models, getKey);

        // wrap groups into RenderGroup
        for (let [key, g] of groups.entries()) {
            let instancesBuffer = new InstancesBuffer(g);
            this.groups.push({ instancesBuffer, material: key.mat });

            key.vbo.writeToGpu(this.device);
            key.nbo?.writeToGpu(this.device);
            await key.mat.writeTexturesToGpuAsync(this.device, true);
            key.mat.writeToGpu(this.device);
            instancesBuffer.writeToGpu(this.device);
        }
    }
}

type RenderGroup = { instancesBuffer: InstancesBuffer, material: Material }