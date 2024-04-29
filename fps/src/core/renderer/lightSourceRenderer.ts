import { mat4 } from "wgpu-matrix";
import { getCubeModelData } from "../../meshes/modelFactory";
import { ICamera } from "../camera/camera";
import { Light } from "../light";
import { NewPipeBuilder } from "./newPipeBuilder";
import { BindGroupDefinition, BufferDefinition } from "./bindGroupDefinition";
import { BufferObject } from "../primitives/bufferObject";
import { BindGroupProvider } from "./bindGroupProvider";
import { IBufferObject } from "../primitives/bufferObjectBase";

// returns a renderer to render a cube at the source of the light
export async function createLightSourceRenderer(device: GPUDevice, lights: Light[], camera: ICamera): Promise<LightSourceRenderer> {
    return await new LightSourceRenderer(lights, camera).buildAsync(device);
}

export class LightSourceRenderer {

    private _pipeBuilder;
    private bufferBindings;
    private vbo;
    private builder?: BindGroupProvider;
    private buffers?: IBufferObject[];

    constructor(
        private lights: Light[],
        private camera: ICamera
    ) {
        this.vbo = getCubeModelData().vertexBuffer;
        this.bufferBindings = new BindGroupDefinition([
            new BufferDefinition({ type: 'uniform' }),
            new BufferDefinition({ type: 'read-only-storage' }),
            new BufferDefinition({ type: 'read-only-storage' })
        ]);

        this._pipeBuilder = new NewPipeBuilder(SHADER)
            .setVertexBufferLayouts(this.vbo.layout, this.vbo.topology)
            .addBindGroup(this.bufferBindings);
    }

    async buildAsync(device: GPUDevice) {
        await this._pipeBuilder.buildAsync(device);

        this.vbo.writeToGpu(device);

        const colors = this.lights.map(x => new Float32Array(x.diffuseColor));
        const transforms = () => this.lights.map(x => mat4.uniformScale(mat4.translation([...x.position, 0]), 0.5) as Float32Array);

        this.buffers = [
            new BufferObject(() => mat4.multiply(this.camera.projectionMatrix, this.camera.view) as Float32Array, GPUBufferUsage.UNIFORM),
            new BufferObject(colors, GPUBufferUsage.STORAGE),
            new BufferObject(transforms, GPUBufferUsage.STORAGE)
        ];

        this.buffers.forEach(x => x.writeToGpu(device));
        this.builder = new BindGroupProvider(device, this._pipeBuilder.actualPipeline!)
            .addBuffer(...this.buffers);

        this.builder.createBindGroups();

        return this;
    }

    render(device: GPUDevice, pass: GPURenderPassEncoder, instanceCount?: number | undefined): void {
        if (!this._pipeBuilder.actualPipeline)
            throw new Error(`Pipeline hasn't been built.`);
        this.buffers!.forEach(x => x.writeToGpu(device));
        pass.setVertexBuffer(0, this.vbo.buffer);
        this.builder!.getBindGroups().forEach((x, i) => pass.setBindGroup(i, x));
        pass.setPipeline(this._pipeBuilder.actualPipeline);
        pass.draw(this.vbo.vertexCount, instanceCount ?? this.lights.length);
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

