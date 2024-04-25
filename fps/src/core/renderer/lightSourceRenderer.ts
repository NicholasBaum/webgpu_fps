import { mat4 } from "wgpu-matrix";
import { getCubeModelData } from "../../meshes/modelFactory";
import { ICamera } from "../camera/camera";
import { Light } from "../light";
import BindGroupBuilder, * as BGB from "./bindGroupBuilder";
import { NextRenderer } from "./nextRenderer";
import { NewPipeBuilder } from "./newPipeBuilder";

// returns a renderer to render a cube at the source of the light
export async function createLightSourceRenderer(device: GPUDevice, lights: Light[], cam: ICamera): Promise<LightSourceRenderer> {
    let renderer = new LightSourceRenderer(lights, cam);
    await renderer.buildAsync(device);
    return renderer;
}

export class LightSourceRenderer extends NextRenderer {

    get pipeBuilder(): NewPipeBuilder { return this._pipeBuilder; }
    private _pipeBuilder: NewPipeBuilder;

    constructor(lights: Light[], cam: ICamera) {
        super(lights.length);

        const vbo = getCubeModelData().vertexBuffer;
        const colors = lights.map(x => new Float32Array(x.diffuseColor));
        const transforms = () => lights.map(x => mat4.uniformScale(mat4.translation([...x.position, 0]), 0.5) as Float32Array);

        const builder = new BindGroupBuilder();
        builder.add(BGB.createElement(() => mat4.multiply(cam.projectionMatrix, cam.view) as Float32Array));
        builder.add(BGB.createArrayElement(colors));
        builder.add(BGB.createArrayElement(transforms));

        const pipeBuilder = new NewPipeBuilder(SHADER);
        pipeBuilder.addVertexBuffer(vbo);
        pipeBuilder.addBindGroup(builder);
        this._pipeBuilder = pipeBuilder;
    }

    async buildAsync(device: GPUDevice): Promise<void> {
        await this._pipeBuilder.buildAsync(device);
        this._pipeBuilder.vbos[0].writeToGpu(device);
    }
}

const SHADER = `

@group(0) @binding(0) var<uniform> viewProjMat: mat4x4f;
@group(0) @binding(1) var<storage, read> colors: array<vec4f>;
@group(0) @binding(2) var<storage, read> transforms: array<mat4x4f>;

struct VertexOutput
{
    @builtin(position) Position : vec4f,
    @location(0) color: vec4f,
}
  
@vertex
fn vertexMain(
@builtin(instance_index) index: u32,
@location(0) position: vec4f,
@location(1) uv: vec2f
) -> VertexOutput 
{  
    return VertexOutput(viewProjMat*transforms[index]*position, colors[index]);
}

@fragment
fn fragmentMain(
  @location(0) color: vec4f
) -> @location(0) vec4f 
{    
    return color;
}

`;

