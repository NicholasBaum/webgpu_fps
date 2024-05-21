import { groupByValues } from "../../helper/groupBy";
import { ICamera } from "../camera/camera";
import { EnvironmentMap } from "../environment/environmentMap";
import { EnvironmentRenderer, createEnvironmentRenderer } from "../environment/environmentRenderer";
import { Light } from "../light";
import { Material, PbrMaterial } from "../materials/pbrMaterial";
import { ModelInstance } from "../modelInstance";
import { InstancesGroup } from "../primitives/instancesBuffer";
import { SceneSettingsBuffer } from "../primitives/sceneSettingsBuffer";
import { VertexBufferObject } from "../primitives/vertexBufferObject";
import { Scene } from "../scene";
import { ShadowMapBuilder } from "../shadows/shadowMapBuilder";
import { BlinnPhongRenderer, createBlinnPhongRenderer } from "./blinnPhongRenderer";
import { PbrRenderer, createPbrRenderer } from "./pbrRenderer";

export async function createSceneRenderer(device: GPUDevice, scene: Scene, sampleCount: 1 | 4, shadowMapBuilder?: ShadowMapBuilder) {
    return await new SceneRenderer(scene.camera, scene.lights, scene.models, sampleCount, scene.environmentMap, shadowMapBuilder).buildAsync(device);
}

export async function createLightViewRenderers(device: GPUDevice, scene: Scene, sampleCount: 1 | 4, shadowMap?: ShadowMapBuilder) {
    return await Promise.all(
        scene.lights
            .filter(x => !!x.shadowMap)
            .map(x => new SceneRenderer(x.shadowMap!.camera, scene.lights, scene.models, sampleCount, scene.environmentMap, shadowMap)
                .buildAsync(device))
    );
}

// wraps data that can be rendered as one
type RenderGroup = { hasNormals: boolean, instancesBuffer: InstancesGroup, material: Material }

export class SceneRenderer {

    renderBackground = true;

    // gets assigned in the buildAsync
    private device!: GPUDevice;
    private pbrRenderer!: PbrRenderer;
    private pbrRenderer_NN!: PbrRenderer;
    private blinnRenderer!: BlinnPhongRenderer;
    private blinnRenderer_NN!: BlinnPhongRenderer;
    private environmentRenderer?: EnvironmentRenderer;

    private sceneSettingsBuffer: SceneSettingsBuffer;
    private groups: RenderGroup[] = [];

    private cubeMap!: GPUTextureView;
    private irradianceMap!: GPUTextureView;
    private prefilteredMap!: GPUTextureView;
    private brdfMap!: GPUTextureView;
    private shadowMapView!: GPUTextureView;

    constructor(
        private camera: ICamera,
        private lights: Light[],
        private models: ModelInstance[],
        private sampleCount: 1 | 4,
        private environmentMap?: EnvironmentMap,
        private shadowMapBuilder?: ShadowMapBuilder
    ) {
        this.renderBackground = !!environmentMap;
        this.sceneSettingsBuffer = new SceneSettingsBuffer(this.camera, this.lights, this.renderBackground)
    }

    async buildAsync(device: GPUDevice) {
        this.device = device;
        this.pbrRenderer = await createPbrRenderer(this.device, this.sampleCount);
        this.pbrRenderer_NN = await createPbrRenderer(this.device, this.sampleCount, false);
        this.blinnRenderer = await createBlinnPhongRenderer(this.device, this.sampleCount);
        this.blinnRenderer_NN = await createBlinnPhongRenderer(this.device, this.sampleCount, false);
        if (this.environmentMap)
            this.environmentRenderer = await createEnvironmentRenderer(device, this.camera, this.environmentMap.cubeMap, this.sampleCount)
        await this.createRenderGroups();
        this.createEnvironmentMaps();
        return this;
    }

    render(renderPass: GPURenderPassEncoder) {
        this.sceneSettingsBuffer.writeToGpu(this.device);
        for (let g of this.groups) {
            g.instancesBuffer.writeToGpu(this.device)
            g.material.writeToGpu(this.device);
            if (g.material instanceof PbrMaterial) {
                let pbr = g.hasNormals ? this.pbrRenderer : this.pbrRenderer_NN;
                pbr.render(renderPass, g.instancesBuffer, g.material, this.sceneSettingsBuffer, this.irradianceMap, this.prefilteredMap, this.brdfMap, this.shadowMapView);
            }
            else {
                let blinn = g.hasNormals ? this.blinnRenderer : this.blinnRenderer_NN;
                blinn.render(renderPass, g.instancesBuffer, g.material, this.sceneSettingsBuffer, this.cubeMap, this.shadowMapView);
            }
        }

        // render environment background
        if (this.renderBackground)
            this.environmentRenderer?.render(renderPass);
    }

    private async createRenderGroups() {
        // create groups that can be rendered in one pass
        type Key = { usesNormalMap: boolean, vbo: VertexBufferObject, mat: Material };
        const getKey = (x: ModelInstance) => {
            if (x.hasNormals && x.material.hasNormalMap) {
                return { usesNormalMap: true, vbo: x.vertexBuffer, mat: x.material }
            } else {
                return { usesNormalMap: false, vbo: x.vertexBuffer, mat: x.material }
            }
        };
        let groups: Map<Key, ModelInstance[]> = groupByValues(this.models, getKey);

        // wrap groups into RenderGroup
        for (let [key, g] of groups.entries()) {
            let instancesBuffer = new InstancesGroup(g);
            this.groups.push({ hasNormals: key.usesNormalMap, instancesBuffer, material: key.mat });

            instancesBuffer.vertexBuffer.writeToGpu(this.device);
            instancesBuffer.normalBuffer?.writeToGpu(this.device);
            await key.mat.writeTexturesToGpuAsync(this.device, true);
            key.mat.writeToGpu(this.device);
            instancesBuffer.writeToGpu(this.device);
        }
    }

    private createEnvironmentMaps() {
        this.shadowMapView = this.shadowMapBuilder?.textureArray.createView({ dimension: "2d-array", label: `Shadow Map View` })
            ?? createDummyShadowTexture(this.device, "shadow map dummy");

        this.cubeMap = this.environmentMap?.cubeMap.createView({ dimension: 'cube' })
            ?? createDummyCubeTexture(this.device, "cube map dummy");

        this.irradianceMap = this.environmentMap?.irradianceMap.createView({ dimension: 'cube' })
            ?? createDummyCubeTexture(this.device, "irradiance map dummy");

        this.prefilteredMap = this.environmentMap?.specularMap.createView({ dimension: 'cube' })
            ?? createDummyCubeTexture(this.device, "envSpecular map dummy");

        this.brdfMap = this.environmentMap?.brdfMap.createView()
            ?? createDummyTexture(this.device, "brdf map dummy");
    }
}


function createDummyTexture(device: GPUDevice, label?: string): GPUTextureView {
    return createTexture(device, 1, 'rgba8unorm', '2d', label);
}

function createDummyCubeTexture(device: GPUDevice, label?: string) {
    return createTexture(device, 6, 'rgba8unorm', 'cube', label);
}

function createDummyShadowTexture(device: GPUDevice, label?: string) {
    return createTexture(device, 1, 'depth32float', '2d-array', label);
}

function createTexture(device: GPUDevice, layer: number, format: GPUTextureFormat, dimension: GPUTextureViewDimension, label?: string) {
    return device.createTexture({
        size: [1, 1, layer],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: format,
        label
    }).createView({ dimension: dimension, });
}