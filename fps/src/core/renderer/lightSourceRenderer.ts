import { mat4 } from "wgpu-matrix";
import { getCubeModelData } from "../../meshes/modelFactory";
import { ICamera } from "../camera/camera";
import { Light } from "../light";
import { NewPipeBuilder } from "./newPipeBuilder";
import { BindGroupDefinition } from "./bindGroupDefinition";
import { BufferObject } from "../primitives/bufferObject";
import { BindGroupBuilder } from "./bindGroupBuilder";

// returns a renderer to render a cube at the source of the light
export async function createLightSourceRenderer(device: GPUDevice, lights: Light[], camera: ICamera): Promise<LightSourceRenderer> {
    return await new LightSourceRenderer(lights, camera).buildAsync(device);
}

export class LightSourceRenderer {

    private _pipeBuilder;
    private _vbo;
    private _buffers: BufferObject[];
    private _bindGroup?: GPUBindGroup;

    constructor(
        private lights: Light[],
        private camera: ICamera
    ) {
        this._vbo = getCubeModelData().vertexBuffer;

        const colors = this.lights.map(x => new Float32Array(x.diffuseColor));
        const transforms = () => this.lights.map(x => mat4.uniformScale(mat4.translation([...x.position, 0]), 0.5) as Float32Array);

        this._buffers = [
            new BufferObject(() => mat4.multiply(this.camera.projectionMatrix, this.camera.view) as Float32Array, GPUBufferUsage.UNIFORM),
            new BufferObject(colors, GPUBufferUsage.STORAGE),
            new BufferObject(transforms, GPUBufferUsage.STORAGE)
        ];

        this._pipeBuilder = new NewPipeBuilder(SHADER)
            .setVertexBufferLayouts(this._vbo.layout, this._vbo.topology)
            .addBindGroup(
                new BindGroupDefinition()
                    .addBuffer('uniform')
                    .addBuffer('read-only-storage')
                    .addBuffer('read-only-storage')
            );
    }

    async buildAsync(device: GPUDevice) {
        await this._pipeBuilder.buildAsync(device);
        this._vbo.writeToGpu(device);
        this._buffers.forEach(x => x.writeToGpu(device));
        let builder = new BindGroupBuilder(device, this._pipeBuilder.actualPipeline!)
            .addBuffer(...this._buffers);
        this._bindGroup = builder.createBindGroups()[0];
        return this;
    }

    render(device: GPUDevice, pass: GPURenderPassEncoder, instanceCount?: number | undefined): void {
        if (!this._pipeBuilder.actualPipeline)
            throw new Error(`Pipeline hasn't been built.`);
        this._buffers.forEach(x => x.writeToGpu(device));
        pass.setVertexBuffer(0, this._vbo.buffer);
        pass.setBindGroup(0, this._bindGroup!);
        pass.setPipeline(this._pipeBuilder.actualPipeline);
        pass.draw(this._vbo.vertexCount, instanceCount ?? this.lights.length);
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

