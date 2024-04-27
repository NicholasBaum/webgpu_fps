import { ICamera } from '../camera/camera';
import tone_mapping from "../../shaders/tone_mapping.wgsl"
import { NewPipeBuilder, default_sampler_descriptor } from '../renderer/newPipeBuilder';
import { getCubeModelData } from '../../meshes/modelFactory';
import BindGroupBuilder, * as BGB from '../renderer/bindGroupBuilder';
import { flatten } from '../../helper/float32Array-ext';

export async function createEnvironmentRenderer(device: GPUDevice, camera: ICamera, texture: GPUTexture, sampler?: GPUSampler) {
    return await new EnvironmentRenderer(device, camera, texture).buildAsync(device);
}

export class EnvironmentRenderer {

    private _pipeline: NewPipeBuilder;

    constructor(
        private device: GPUDevice,
        camera: ICamera,
        texture: GPUTexture,
        sampler?: GPUSampler
    ) {

        let cubeVbo = getCubeModelData().vertexBuffer;

        let texBinding = new BGB.TextureBinding({ viewDimension: 'cube' }, texture.createView({ dimension: 'cube' }));
        let samplerBinding = new BGB.SamplerBinding(sampler ?? default_sampler_descriptor)
        let camMatBinding = BGB.createUniformBinding(() => {
            return flatten([camera.view as Float32Array, camera.projectionMatrix as Float32Array]);
        });

        const depthStencilState: GPUDepthStencilState = {
            format: 'depth24plus',
            depthWriteEnabled: false,
            depthCompare: "less-equal",
        };
        const fragmentConstants = { isHdr: texture.format == 'rgba16float' ? 1.0 : 0.0 };

        this._pipeline = new NewPipeBuilder(SHADER, { fragmentConstants, cullMode: 'none', depthStencilState })
            .addVertexBuffer(cubeVbo)
            .addBindGroup(new BindGroupBuilder(texBinding, samplerBinding, camMatBinding));
    }

    async buildAsync(device: GPUDevice) {
        this._pipeline.vbos.forEach(x => x.writeToGpu(device));
        await this._pipeline.buildAsync(device);
        return this;
    }

    render(renderPass: GPURenderPassEncoder) {
        if (!this._pipeline.pipeline)
            throw new Error(`Pipeline wasn't built.`);
        (this._pipeline.bindGroups[0].bindings[2] as BGB.BufferBinding).buffer.writeToGpu(this.device);
        renderPass.setVertexBuffer(0, this._pipeline.vbos[0].buffer);
        renderPass.setBindGroup(0, this._pipeline.bindGroups[0].createBindGroup(this.device, this._pipeline.pipeline));
        renderPass.setPipeline(this._pipeline.pipeline);
        renderPass.draw(this._pipeline.vbos[0].vertexCount);
    }
}

const SHADER = tone_mapping + `

struct Uniforms
{
    view: mat4x4f,
    proj : mat4x4f,
}

@group(0) @binding(0) var texture : texture_cube < f32>;
@group(0) @binding(1) var textureSampler : sampler;
@group(0) @binding(2) var<uniform> uni :  Uniforms;

struct VertexOutput
{
    @builtin(position) Position : vec4f,
    @location(0) viewDir: vec4f,
}
  
@vertex
fn vertexMain(
@location(0) position : vec4f,
@location(1) uv : vec2f
) -> VertexOutput 
{
    var out : VertexOutput;

    // remove translation from view matrix
    var tmp = mat4x4f();
    tmp[0] = vec4f(uni.view[0].xyz,0);
    tmp[1] = vec4f(uni.view[1].xyz,0);
    tmp[2] = vec4f(uni.view[2].xyz,0);
    tmp[3] = vec4f(0,0,0,1);      
    
    let p = uni.proj * tmp * position;    
    // p is divided by p.w before forwarded to the fragement shader (NDC coordinates)
    // p.z is only used as z-buffer value and if set to p.w the NDC value will be 1
    // corresponding to the farthest away point 
    out.Position = vec4f(p.x,p.y,p.w,p.w);    
    out.viewDir = position;
    return out;
}

override isHdr: f32 = 0.0;
@fragment
fn fragmentMain(
  @location(0) viewDir: vec4f
) -> @location(0) vec4f 
{    
    var finalColor =  textureSample(texture, textureSampler, viewDir.xyz).xyz;

    if(isHdr == 1.0)
    {
        finalColor = ACESFilm(finalColor);       
        finalColor = gammaEncode(finalColor);
    }

    return vec4f(finalColor,1);
}

`;