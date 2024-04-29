import { mat4 } from "wgpu-matrix";
import { getCubeModelData } from "../../meshes/modelFactory";
import { ICamera } from "../camera/camera";
import { Light } from "../light";
import { NewPipeBuilder } from "./newPipeBuilder";
import { BindGroupBuilder, BufferBinding } from "./bindGroupBuilder";
import { BufferObject } from "../primitives/bufferObject";
import { BindGroupEntriesBuilder } from "../pipeline/bindGroup";
import { IBufferObject } from "../primitives/bufferObjectBase";

// returns a renderer to render a cube at the source of the light
export async function createLightSourceRenderer(device: GPUDevice, lights: Light[], cam: ICamera): Promise<LightSourceRenderer> {
    let renderer = new LightSourceRenderer(lights, cam);
    await renderer.buildAsync(device);
    return renderer;
}

export class LightSourceRenderer {

    get pipeBuilder(): NewPipeBuilder { return this._pipeBuilder; }
    private _pipeBuilder: NewPipeBuilder;

    private instanceCount;
    private bufferBindings;
    private vbo;
    private builder?: BindGroupEntriesBuilder;
    private buffers?: IBufferObject[];

    constructor(
        private lights: Light[],
        private cam: ICamera
    ) {
        this.instanceCount = lights.length;
        this.vbo = getCubeModelData().vertexBuffer;
        this.bufferBindings = new BindGroupBuilder(...[
            new BufferBinding({ type: 'uniform' }),
            new BufferBinding({ type: 'read-only-storage' }),
            new BufferBinding({ type: 'read-only-storage' })
        ]);

        const pipeBuilder = new NewPipeBuilder(SHADER);
        pipeBuilder.setVertexBufferLayouts(this.vbo.vertexBufferLayout, this.vbo.topology);
        pipeBuilder.addBindGroup(this.bufferBindings);
        this._pipeBuilder = pipeBuilder;
    }

    async buildAsync(device: GPUDevice) {
        await this.pipeBuilder.buildAsync(device);

        this.vbo.writeToGpu(device);

        const colors = this.lights.map(x => new Float32Array(x.diffuseColor));
        const transforms = () => this.lights.map(x => mat4.uniformScale(mat4.translation([...x.position, 0]), 0.5) as Float32Array);

        this.buffers = [
            new BufferObject(() => mat4.multiply(this.cam.projectionMatrix, this.cam.view) as Float32Array, GPUBufferUsage.UNIFORM),
            new BufferObject(colors, GPUBufferUsage.STORAGE),
            new BufferObject(transforms, GPUBufferUsage.STORAGE)
        ];
        await Promise.all(this.buffers.map(x => x.buildAsync(device)));

        this.builder = new BindGroupEntriesBuilder(device, this.pipeBuilder.pipeline!)
            .addBuffer(...this.buffers);

        this.builder.createBindGroups();
    }

    render(device: GPUDevice, pass: GPURenderPassEncoder, instanceCount?: number | undefined): void {
        if (!this.pipeBuilder.pipeline)
            throw new Error(`Pipeline hasn't been built.`);
        this.buffers!.forEach(x => x.writeToGpu(device));
        pass.setVertexBuffer(0, this.vbo.buffer);
        this.builder!.getBindGroups().forEach((x, i) => pass.setBindGroup(i, x));
        pass.setPipeline(this.pipeBuilder.pipeline);
        pass.draw(this.vbo.vertexCount, instanceCount ?? this.instanceCount);
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

