import { EnvironmentMap } from "../environment/environmentMap";
import { ShadowMapArray } from "../shadows/shadowMap";
import { NewPipeBuilder, PipeOptions } from "./newPipeBuilder";
import { InstancesBuffer } from "../primitives/instancesBuffer";
import { SceneSettingsBuffer } from "../primitives/sceneSettingsBuffer";
import { BindGroupDefinition, BufferDefinition, DepthSamplerDefinition, LinearSamplerDefinition, TextureDefinition } from "./bindGroupBuilder";
import { Material, PbrMaterial } from "../materials/pbrMaterial";
import { BlinnPhongMaterial } from "../materials/blinnPhongMaterial";

import shader from "../../shaders/pbr.wgsl"
import pbr_functions from "../../shaders/pbr_functions.wgsl"
import tone_mapping from "../../shaders/tone_mapping.wgsl"
const PBR_SHADER = shader + pbr_functions + tone_mapping;
import BLINN_SHADER from '../../shaders/blinn_phong.wgsl';
import { BindGroupEntriesBuilder } from "../pipeline/bindGroup";

export class PbrRenderer {

    private _pipeline: NewPipeBuilder;
    get device() { return this._pipeline.device; }

    private textureBindings: TextureDefinition[];
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
            fragmentConstants: { shadowMapSize: shadowMapSize },
        }

        const textureCount = (this.isPbr ? 4 : 3) + (this.hasNormals ? 1 : 0);
        this.textureBindings = Array.from({ length: textureCount }, () => new TextureDefinition({}));
        this.textureBindings.forEach((x, i) => x.label = `${this.isPbr ? "Pbr" : "Blinn"}Texture Map Binding ${i}`);

        let instancsDataGroup = new BindGroupDefinition()
            .add(new BufferDefinition({ type: 'read-only-storage' })) // models
            .add(new BufferDefinition({ type: 'read-only-storage' })) // scene data
            .add(new BufferDefinition({ type: 'uniform' })) // material
            .add(new LinearSamplerDefinition())
            .add(...this.textureBindings);

        let shadowMapGroup = new BindGroupDefinition()
            .add(new TextureDefinition({ viewDimension: '2d-array', sampleType: 'depth', multisampled: false }, `${this.isPbr ? "Pbr" : "Blinn"}Shadow Map Binding`))
            .add(new DepthSamplerDefinition());

        let environmentGroup = new BindGroupDefinition();
        if (this.isPbr) {
            environmentGroup
                .add(new LinearSamplerDefinition())
                .add(new TextureDefinition({ viewDimension: 'cube' }, `Pbr Cube Envrionment Map Binding`))
                .add(new TextureDefinition({ viewDimension: 'cube' }, `Pbr Specular Environment Map Binding`))
                .add(new TextureDefinition({ viewDimension: '2d' }, `Pbr Brdf Map Binding`));
        }
        else {
            environmentGroup
                .add(new TextureDefinition({ viewDimension: 'cube' }, `"Blinn Environment Map Binding`))
                .add(new LinearSamplerDefinition());
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

        const shadowMapView = shadowMap?.textureArray.createView({
            dimension: "2d-array",
            label: `${this.isPbr ? "Pbr" : "Blinn"}Shadow Map View`
        })
            ?? this.createDummyShadowTexture(this.device, "ShadowMap Dummy");

        const cubeMap = environmentMap?.cubeMap.createView({ dimension: 'cube' }) ?? this.createDummyCubeTexture(this.device, "cubeMap Dummy");
        const irradianceMap = environmentMap?.irradianceMap.createView({ dimension: 'cube' }) ?? this.createDummyCubeTexture(this.device, "irradianceMap Dummy");
        const prefilteredMap = environmentMap?.prefilteredMap.createView({ dimension: 'cube' }) ?? this.createDummyCubeTexture(this.device, "prefilteredMap Dummy");
        const brdfMap = environmentMap?.brdfMap.createView() ?? this.createDummyTexture(this.device, "brdfMap Dummy");


        let builder = new BindGroupEntriesBuilder(this.device, this._pipeline.pipeline, `${this.mode} Pipeline`);

        // model and material group
        builder.addBuffer(instances);
        builder.addBuffer(sceneData);
        builder.addBuffer(material);
        builder.addLinearSampler();

        if (material instanceof PbrMaterial) {
            builder.addTexture(material.ambientOcclussionTexture.createView());
            builder.addTexture(material.albedoTexture.createView());
            builder.addTexture(material.metalTexture.createView());
            builder.addTexture(material.roughnessTexture.createView());
        }
        else {
            builder.addTexture(material.ambientTexture.createView());
            builder.addTexture(material.diffuseTexture.createView());
            builder.addTexture(material.specularTexture.createView());
        }

        if (this.hasNormals)
            builder.addTexture(material.normalTexture.createView());

        // shadow group
        builder.addGroup();

        builder.addTexture(shadowMapView);
        builder.addDepthSampler()

        // environment group
        builder.addGroup();

        if (material instanceof PbrMaterial) {
            builder.addLinearSampler();
            builder.addTexture(irradianceMap);
            builder.addTexture(prefilteredMap);
            builder.addTexture(brdfMap);
        }
        else {
            builder.addTexture(cubeMap);
            builder.addLinearSampler();
        }

        pass.setVertexBuffer(0, instances.vertexBuffer.buffer);
        if (this.hasNormals)
            pass.setVertexBuffer(1, instances.normalBuffer!.buffer);

        // create and assign bind groups
        builder.createBindGroups().forEach((x, i) => pass.setBindGroup(i, x));
        pass.setPipeline(this._pipeline.pipeline);
        pass.draw(instances.vertexBuffer.vertexCount, instances.length);
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