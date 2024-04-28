import { EnvironmentMap } from "../environment/environmentMap";
import { ShadowMapArray } from "../shadows/shadowMap";
import { NewPipeBuilder, PipeOptions } from "./newPipeBuilder";
import { InstancesBuffer } from "../primitives/instancesBuffer";
import { SceneSettingsBuffer } from "../primitives/sceneSettingsBuffer";
import { BindGroupBuilder, BufferBinding, DepthSamplerBinding, LinearSamplerBinding, TextureBinding } from "./bindGroupBuilder";
import { Material, PbrMaterial } from "../materials/pbrMaterial";
import { BlinnPhongMaterial } from "../materials/blinnPhongMaterial";

import shader from "../../shaders/pbr.wgsl"
import pbr_functions from "../../shaders/pbr_functions.wgsl"
import tone_mapping from "../../shaders/tone_mapping.wgsl"
const PBR_SHADER = shader + pbr_functions + tone_mapping;
import BLINN_SHADER from '../../shaders/blinn_phong.wgsl';

export class PbrRenderer {

    private _pipeline: NewPipeBuilder;
    get device() { return this._pipeline.device; }

    private textureBindings: TextureBinding[];
    get hasNormals() { return this.mode == 'pbr' || this.mode == 'blinn' }
    get isPbr() { return this.mode == 'pbr' || this.mode == 'pbr_no_normals' }

    constructor(
        vertexBufferLayout: GPUVertexBufferLayout[],
        topology: GPUPrimitiveTopology,
        shadowMapSize: number = 1024.0,
        private mode: 'pbr' | 'pbr_no_normals' | 'blinn' | 'blinn_no_normals' = 'pbr',
    ) {
        this.hasNormals
        const options: PipeOptions = {
            vertexEntry: this.hasNormals ? 'vertexMain' : `vertexMain_alt`,
            fragmentEntry: this.hasNormals ? `fragmentMain` : `fragmentMain_alt`,
            fragmentConstants: {
                shadowMapSize: shadowMapSize
            },
        }

        const textureCount = (this.isPbr ? 4 : 3) + (this.hasNormals ? 1 : 0);
        this.textureBindings = Array.from({ length: textureCount }, () => new TextureBinding({}));
        this.textureBindings.forEach((x, i) => x.label = `${this.isPbr ? "Pbr" : "Blinn"}Texture Map Binding ${i}`);

        let instancsDataGroup = new BindGroupBuilder()
            .add(new BufferBinding({ type: 'read-only-storage' })) // models
            .add(new BufferBinding({ type: 'read-only-storage' })) // scene data
            .add(new BufferBinding({ type: 'uniform' })) // material
            .add(new LinearSamplerBinding())
            .add(...this.textureBindings);

        let shadowMapGroup = new BindGroupBuilder()
            .add(new TextureBinding({ viewDimension: '2d-array', sampleType: 'depth', multisampled: false }, `${this.isPbr ? "Pbr" : "Blinn"}Shadow Map Binding`))
            .add(new DepthSamplerBinding());

        let environmentGroup = new BindGroupBuilder();
        if (this.isPbr) {
            environmentGroup
                .add(new LinearSamplerBinding())
                .add(new TextureBinding({ viewDimension: 'cube' }, `Pbr Cube Envrionment Map Binding`))
                .add(new TextureBinding({ viewDimension: 'cube' }, `Pbr Specular Environment Map Binding`))
                .add(new TextureBinding({ viewDimension: '2d' }, `Pbr Brdf Map Binding`));
        }
        else {
            environmentGroup
                .add(new TextureBinding({ viewDimension: 'cube' }, `"Blinn Environment Map Binding`))
                .add(new LinearSamplerBinding());
        }

        this._pipeline = new NewPipeBuilder(this.isPbr ? PBR_SHADER : BLINN_SHADER, options)
            .setVertexBufferLayouts(vertexBufferLayout, topology)
            .addBindGroup(instancsDataGroup)
            .addBindGroup(shadowMapGroup)
            .addBindGroup(environmentGroup);

    }

    async buildAsync(device: GPUDevice): Promise<PbrRenderer> {
        if (this.device == device)
            return this;
        await this._pipeline.buildAsync(device);
        return this;
    }

    render(
        pass: GPURenderPassEncoder,
        instances: InstancesBuffer,
        material: Material,
        sceneData: SceneSettingsBuffer,
        environmentMap?: EnvironmentMap,
        shadowMap?: ShadowMapArray
    ) {
        if (!this._pipeline.pipeline || !this.device)
            throw new Error(`renderer wasn't built.`);

        const shadowMapView = shadowMap?.textureArray.createView({ dimension: "2d-array", label: `${this.isPbr ? "Pbr" : "Blinn"}Shadow Map View` })
            ?? this.createDummyShadowTexture(this.device, "ShadowMap Dummy");

        const cubeMap = environmentMap?.cubeMap.createView({ dimension: 'cube' }) ?? this.createDummyCubeTexture(this.device, "cubeMap Dummy");
        const irradianceMap = environmentMap?.irradianceMap.createView({ dimension: 'cube' }) ?? this.createDummyCubeTexture(this.device, "irradianceMap Dummy");
        const prefilteredMap = environmentMap?.prefilteredMap.createView({ dimension: 'cube' }) ?? this.createDummyCubeTexture(this.device, "prefilteredMap Dummy");
        const brdfMap = environmentMap?.brdfMap.createView() ?? this.createDummyTexture(this.device, "brdfMap Dummy");

        this._pipeline.get<BufferBinding>(0, 0).setEntry(instances);
        this._pipeline.get<BufferBinding>(0, 1).setEntry(sceneData);
        this._pipeline.get<BufferBinding>(0, 2).setEntry(material);

        this._pipeline.get<TextureBinding>(1, 0).setEntry(shadowMapView);

        if (material instanceof PbrMaterial) {
            this.assignPbr(material)
            this._pipeline.get<TextureBinding>(2, 1).setEntry(irradianceMap);
            this._pipeline.get<TextureBinding>(2, 2).setEntry(prefilteredMap);
            this._pipeline.get<TextureBinding>(2, 3).setEntry(brdfMap);
        }
        else {
            this._pipeline.get<TextureBinding>(2, 0).setEntry(cubeMap);
            this.assignBlinn(material);
        }

        pass.setVertexBuffer(0, instances.vertexBuffer.buffer);
        if (this.hasNormals) {
            this.textureBindings[this.isPbr ? 4 : 3].setEntry(material.normalTexture.createView());
            pass.setVertexBuffer(1, instances.normalBuffer!.buffer);
        }
        this._pipeline.bindGroups.forEach((x, i) => { pass.setBindGroup(i, x.createBindGroup(this.device!, this._pipeline.pipeline!)) });
        pass.setPipeline(this._pipeline.pipeline);
        pass.draw(instances.vertexBuffer.vertexCount, instances.length);
    }

    private assignPbr(material: PbrMaterial) {
        this._pipeline.get<TextureBinding>(0, 4).setEntry(material.ambientOcclussionTexture.createView());
        //this.textureBindings[0].setEntry(material.ambientOcclussionTexture.createView());
        this.textureBindings[1].setEntry(material.albedoTexture.createView());
        this.textureBindings[2].setEntry(material.metalTexture.createView());
        this.textureBindings[3].setEntry(material.roughnessTexture.createView());
    }

    private assignBlinn(material: BlinnPhongMaterial) {
        this.textureBindings[0].setEntry(material.ambientTexture.createView());
        this.textureBindings[1].setEntry(material.diffuseTexture.createView());
        this.textureBindings[2].setEntry(material.specularTexture.createView());
    }

    private tex?: GPUTextureView;
    createDummyTexture(device: GPUDevice, label?: string): GPUTextureView {
        return this.tex ?? (this.tex = device.createTexture({
            size: [1, 1, 1],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            format: 'rgba8unorm',
            label
        }).createView());
    }

    private texCube?: GPUTextureView;
    createDummyCubeTexture(device: GPUDevice, label?: string) {
        return this.texCube ?? (this.texCube = device.createTexture({
            size: [1, 1, 6],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            format: 'rgba8unorm',
            label
        }).createView({ dimension: 'cube' }));
    }

    private texShadow?: GPUTextureView;
    createDummyShadowTexture(device: GPUDevice, label?: string) {
        return this.texShadow ?? (this.texShadow = device.createTexture({
            size: [1, 1, 1],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            format: 'depth32float',
            label
        }).createView({ dimension: "2d-array", }));
    }
}