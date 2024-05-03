import { NewPipeBuilder, PipeOptions } from "./newPipeBuilder";
import { InstancesGroup } from "../primitives/instancesBuffer";
import { SceneSettingsBuffer } from "../primitives/sceneSettingsBuffer";
import { PbrMaterial } from "../materials/pbrMaterial";
import { BindGroupBuilder } from "./bindGroupBuilder";
import { DEF_VERTEX_BUFFER_LAYOUT } from "../../meshes/cube";
import { TANGENTS_BUFFER_LAYOUT } from "../../meshes/tangents";

import shader from "../../shaders/pbr.wgsl"
import pbr_functions from "../../shaders/pbr_functions.wgsl"
import tone_mapping from "../../shaders/tone_mapping.wgsl"
const PBR_SHADER = shader + pbr_functions + tone_mapping;
const layout = [DEF_VERTEX_BUFFER_LAYOUT];
const normalsLayout = [DEF_VERTEX_BUFFER_LAYOUT, TANGENTS_BUFFER_LAYOUT];

export function createPbrRenderer(device: GPUDevice, withNormalMaps: boolean = true): Promise<PbrRenderer> {
    return new PbrRenderer(
        withNormalMaps ? normalsLayout : layout,
        'triangle-list',
        withNormalMaps)
        .buildAsync(device);
}

export class PbrRenderer {

    private _pipeline: NewPipeBuilder;
    get device() { return this._pipeline.device; }

    constructor(
        vertexBufferLayout: GPUVertexBufferLayout[],
        topology: GPUPrimitiveTopology,
        private hasNormals: boolean,
    ) {

        const options: PipeOptions = {
            vertexEntry: this.hasNormals ? 'vertexMain' : `vertexMain_alt`,
            fragmentEntry: this.hasNormals ? `fragmentMain` : `fragmentMain_alt`,
        }

        this._pipeline = new NewPipeBuilder(PBR_SHADER, options)
            .setVertexBufferLayouts(vertexBufferLayout, topology);
    }

    async buildAsync(device: GPUDevice): Promise<PbrRenderer> {
        if (this.device == device)
            return this;
        await this._pipeline.buildAsync(device);
        return this;
    }

    render(
        pass: GPURenderPassEncoder,
        instances: InstancesGroup,
        material: PbrMaterial,
        sceneData: SceneSettingsBuffer,
        irradianceMap: GPUTextureView,
        prefilteredMap: GPUTextureView,
        brdfMap: GPUTextureView,
        shadowMapView: GPUTextureView
    ) {
        if (!this._pipeline.actualPipeline || !this.device)
            throw new Error(`renderer wasn't built.`);

        let builder = new BindGroupBuilder(this.device, this._pipeline.actualPipeline, `Pbr Pipeline`);

        // model group
        builder.addBuffer(instances);
        builder.addBuffer(sceneData);

        // material group
        builder.addGroup();
        builder.addBuffer(material);
        builder.addLinearSampler();
        builder.addTexture(material.ambientOcclussionTexture.createView());
        builder.addTexture(material.albedoTexture.createView());
        builder.addTexture(material.metalTexture.createView());
        builder.addTexture(material.roughnessTexture.createView());

        if (this.hasNormals)
            builder.addTexture(material.normalTexture.createView());

        // shadow group
        builder.addGroup();
        builder.addTexture(shadowMapView);
        builder.addDepthSampler()

        // environment group
        builder.addGroup();
        builder.addLinearSampler();
        builder.addTexture(irradianceMap);
        builder.addTexture(prefilteredMap);
        builder.addTexture(brdfMap);

        pass.setVertexBuffer(0, instances.vertexBuffer.buffer);
        if (this.hasNormals)
            pass.setVertexBuffer(1, instances.normalBuffer!.buffer);

        // create and assign bind groups
        builder.createBindGroups().forEach((x, i) => pass.setBindGroup(i, x));
        pass.setPipeline(this._pipeline.actualPipeline);
        pass.draw(instances.vertexBuffer.vertexCount, instances.length);
    }
}