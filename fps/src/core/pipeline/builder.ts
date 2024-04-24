import { Mat4, Vec4, mat4, vec2 } from "wgpu-matrix";
import { getCubeModelData } from "../../meshes/modelFactory";
import { Light } from "../light";
import { ICamera } from "../camera/camera";
import { VertexBufferObject } from "../primitives/VertexBufferObject";
import { BufferObject } from "../primitives/bufferObject";

function buildArrayElement(res: Vec4[] | Mat4[]): BindGroupElement {
    if (res.length < 1)
        throw new Error("Binding an empty array wasn't tested/implemented yet.");

    if (res[0] instanceof Float64Array)
        throw new Error(`Float64Array isn't supported at this moment.`);

    // remark: e.g. Vec4 itself is an array when refering to number[] and therefore Vec4 is a 2d array
    //         this is relvant for type checking

    if (res[0] instanceof Float32Array) {
        return buildArray(res as Float32Array[]);
    }
    else {
        // res is number[][]
        return buildArray(res.map(x => new Float32Array(x)));
    }
}

// Todo: return type of the lambda function could be number[] or Float64Array what wouldn't work
function buildElement(res: Vec4 | Mat4 | (() => Float32Array)): BindGroupElement {
    if (res instanceof Float64Array)
        throw new Error(`Float64Array isn't supported at this moment.`);
    if (Array.isArray(res)) {
        // res is number[][]
        return build(new Float32Array(res));
    }
    else {
        return build(res);
    }
}

function build(o: Float32Array | (() => Float32Array)) {
    let visibility = GPUShaderStage.VERTEX | GPUShaderStage.VERTEX;
    let type: GPUBufferBindingLayout = { type: 'uniform' };
    let buffer = new BufferObject(o);
    return new BindGroupElement(visibility, type, buffer);
}

function buildArray(o: Float32Array[]) {
    let visibility = GPUShaderStage.VERTEX | GPUShaderStage.VERTEX;
    let type: GPUBufferBindingLayout = { type: 'read-only-storage' };
    let buffer = new BufferObject(o);
    return new BindGroupElement(visibility, type, buffer);
}

export class BindGroupElement {
    constructor(
        public readonly visibility: GPUShaderStageFlags,
        public readonly type: GPUBufferBindingLayout,
        public readonly buffer: BufferObject) {
    }
}

export class BindGroupBuilder {
    public index: number = 0;
    private elements: BindGroupElement[] = [];
    // the actual binded data
    private get buffers() { return this.elements.map(x => x.buffer) }

    constructor() {

    }

    createBindGroup(device: GPUDevice, pipeline: GPURenderPipeline): GPUBindGroup {
        return device.createBindGroup(this.buildDescriptor(pipeline))
    }

    getBindGroupLayoutdescriptor(): GPUBindGroupLayoutDescriptor {
        return {
            entries: this.elements.map((x, i) => {
                return {
                    binding: i,
                    visibility: x.visibility,
                    buffer: x.type,
                }
            })
        }
    }

    private buildDescriptor(pipeline: GPURenderPipeline): GPUBindGroupDescriptor {
        return {
            layout: pipeline.getBindGroupLayout(this.index),
            entries: this.buffers.map((x, i) => {
                return {
                    binding: i,
                    resource: { buffer: x.buffer }
                }
            })
        };
    }

    add(el: BindGroupElement) {
        this.elements.push(el);
    }

    writeToGpu(device: GPUDevice) {
        this.buffers.forEach(x => x.writeToGpu(device));
    }
}

export class PipelineBuilder {

    private vbos: VertexBufferObject[] = [];
    private groups: BindGroupBuilder[] = [];
    private pipeline: GPURenderPipeline | undefined;
    private SHADER: string;
    private instanceCount: number = 1;

    constructor(shader: string, instanceCount: number = 1) {
        this.SHADER = shader;
        this.instanceCount = instanceCount;
    }

    addVertexBuffer(vbo: VertexBufferObject) {
        this.vbos.push(vbo);
    }

    addBindGroup(group: BindGroupBuilder) {
        group.index = this.groups.length;
        this.groups.push(group);
    }

    async buildAsync(device: GPUDevice) {
        this.pipeline = await PipelineBuilder.createPipeline(device, this.vbos, this.groups, this.SHADER);
    }

    private static async createPipeline(
        device: GPUDevice,
        vbos: VertexBufferObject[],
        groups: BindGroupBuilder[],
        shader: string,
        options?: {
            canvasFormat?: GPUTextureFormat,
            aaSampleCount?: number,
            fragmentEntry?: string,
            vertexEntry?: string
        }): Promise<GPURenderPipeline> {

        let groupLayouts = groups.map(x => device.createBindGroupLayout(x.getBindGroupLayoutdescriptor()));
        let pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: groupLayouts })
        let shaderModule = device.createShaderModule({ code: shader });
        let topology = vbos[0].topology;

        let pieplineDesc: GPURenderPipelineDescriptor = {
            label: "mesh pipeline",
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: options?.vertexEntry ?? "vertexMain",
                buffers: vbos.map(x => x.vertexBufferLayout)
            },
            fragment: {
                module: shaderModule,
                entryPoint: options?.fragmentEntry ?? "fragmentMain",
                targets: [{
                    format: options?.canvasFormat ?? 'bgra8unorm',
                    blend: {
                        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                        alpha: {}
                    }
                }],
            },
            primitive: {
                topology: topology,
                cullMode: 'back',
            },
            multisample: { count: options?.aaSampleCount ?? 4, },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        };

        return await device.createRenderPipelineAsync(pieplineDesc);
    }

    render(device: GPUDevice, pass: GPURenderPassEncoder) {
        if (!this.pipeline)
            throw new Error(`Pipeline hasn't been built.`);
        this.groups.forEach(x => x.writeToGpu(device));
        pass.setPipeline(this.pipeline);
        this.groups.forEach((x, i) => { pass.setBindGroup(i, x.createBindGroup(device, this.pipeline!)) });
        this.vbos.forEach((x, i) => { pass.setVertexBuffer(i, x.buffer) });
        pass.draw(this.vbos[0].vertexCount, this.instanceCount);
    }
}


export async function createDebugLightsRenderer(device: GPUDevice, lights: Light[], cam: ICamera) {

    const vbo = getCubeModelData().vertexBuffer;
    const colors = lights.map(x => new Float32Array(x.diffuseColor));
    const transforms = lights.map(x => mat4.uniformScale(mat4.translation([...x.position, 0]), 0.5));

    const builder = new BindGroupBuilder();
    builder.add(buildElement(() => mat4.multiply(cam.projectionMatrix, cam.view) as Float32Array));
    builder.add(buildArrayElement(colors));
    builder.add(buildArrayElement(transforms));

    const pipeBuilder = new PipelineBuilder(SHADER, lights.length);
    pipeBuilder.addVertexBuffer(vbo);
    pipeBuilder.addBindGroup(builder);
    await pipeBuilder.buildAsync(device);
    vbo.writeToGpu(device);
    return pipeBuilder;
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

