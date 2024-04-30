import { NewPipeBuilder, PipeOptions } from "./newPipeBuilder";
import { InstancesGroup } from "../primitives/instancesBuffer";
import { SceneSettingsBuffer } from "../primitives/sceneSettingsBuffer";
import { BindGroupBuilder } from "./bindGroupBuilder";
import { CUBE_VERTEX_BUFFER_LAYOUT } from "../../meshes/cube_mesh";
import { NORMAL_VERTEX_BUFFER_LAYOUT } from "../../meshes/normalDataBuilder";

import BLINN_SHADER from '../../shaders/blinn_phong.wgsl';
import { BlinnPhongMaterial } from "../materials/blinnPhongMaterial";
const layout = [CUBE_VERTEX_BUFFER_LAYOUT];
const normalsLayout = [CUBE_VERTEX_BUFFER_LAYOUT, NORMAL_VERTEX_BUFFER_LAYOUT];

export function createBlinnPhongRenderer(device: GPUDevice, withNormalMaps: boolean = true): Promise<BlinnPhongRenderer> {
    return new BlinnPhongRenderer(
        withNormalMaps ? normalsLayout : layout,
        'triangle-list',
        withNormalMaps)
        .buildAsync(device);
}

export class BlinnPhongRenderer {

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

        this._pipeline = new NewPipeBuilder(BLINN_SHADER, options)
            .setVertexBufferLayouts(vertexBufferLayout, topology);

    }

    async buildAsync(device: GPUDevice): Promise<BlinnPhongRenderer> {
        if (this.device == device)
            return this;
        await this._pipeline.buildAsync(device);
        return this;
    }

    render(
        pass: GPURenderPassEncoder,
        instances: InstancesGroup,
        material: BlinnPhongMaterial,
        sceneData: SceneSettingsBuffer,
        cubeMap: GPUTextureView,
        shadowMapView: GPUTextureView
    ) {
        if (!this._pipeline.actualPipeline || !this.device)
            throw new Error(`renderer wasn't built.`);

        let builder = new BindGroupBuilder(this.device, this._pipeline.actualPipeline, `Blinn Phong Pipeline`);

        // model and material group
        builder.addBuffer(instances);
        builder.addBuffer(sceneData);
        builder.addBuffer(material);
        builder.addLinearSampler();

        builder.addTexture(material.ambientTexture.createView());
        builder.addTexture(material.diffuseTexture.createView());
        builder.addTexture(material.specularTexture.createView());

        if (this.hasNormals)
            builder.addTexture(material.normalTexture.createView());

        // shadow group
        builder.addGroup();

        builder.addTexture(shadowMapView);
        builder.addDepthSampler()

        // environment group
        builder.addGroup();

        builder.addTexture(cubeMap);
        builder.addLinearSampler();


        pass.setVertexBuffer(0, instances.vertexBuffer.buffer);
        if (this.hasNormals)
            pass.setVertexBuffer(1, instances.normalBuffer!.buffer);

        // create and assign bind groups
        builder.createBindGroups().forEach((x, i) => pass.setBindGroup(i, x));
        pass.setPipeline(this._pipeline.actualPipeline);
        pass.draw(instances.vertexBuffer.vertexCount, instances.length);
    }
}