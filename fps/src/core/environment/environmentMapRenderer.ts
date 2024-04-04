import { Mat4, mat4 } from 'wgpu-matrix';
import { ICamera } from '../camera/camera';
import { createSampler } from '../pipeline/pipelineBuilder';
import { cubePositionOffset, cubeUVOffset, cubeVertexArray, cubeVertexCount, cubeVertexSize } from '../../meshes/cube_mesh';

export class EnvironmentMapRenderer {

    protected vertexBuffer: GPUBuffer;
    protected pipeline: GPURenderPipeline;
    protected sampler: GPUSampler;
    viewProjectionMatrix: Mat4 = mat4.identity();

    constructor(
        protected device: GPUDevice,
        protected canvasFormat: GPUTextureFormat,
        protected aaSampleCount: number,
        protected canvasWidth: number,
        protected canvasHeight: number,
        protected camera: ICamera
    ) {
        this.vertexBuffer = device.createBuffer({
            size: cubeVertexArray.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.vertexBuffer, 0, cubeVertexArray as Float32Array)
        this.pipeline = this.createPipeline(device);
        this.sampler = createSampler(device);
    }

    render(texture: GPUTexture | GPUTextureView, pass: GPURenderPassEncoder) {
        const textureView = texture instanceof GPUTextureView ? texture : texture.createView({ dimension: 'cube' });
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.createBindGroup(textureView));
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.draw(cubeVertexCount);
    }

    protected createBindGroup(textureView: GPUTextureView) {
        let desc: { label: string, layout: GPUBindGroupLayout, entries: GPUBindGroupEntry[] } = {
            label: "environment map renderer binding group",
            layout: this.pipeline.getBindGroupLayout(0),
            entries:
                [
                    {
                        binding: 0,
                        resource: textureView,
                    },
                    {
                        binding: 1,
                        resource: this.sampler,
                    },
                    {
                        binding: 2,
                        resource: { buffer: this.getCameraGPUBuffer(this.device) },
                    }
                ]
        };

        return this.device.createBindGroup(desc);
    }

    private _gpuBuffer: GPUBuffer | null = null;

    getCameraGPUBuffer(device: GPUDevice) {
        if (!this._gpuBuffer) {
            this._gpuBuffer = device.createBuffer({
                label: "EnvironmentMapRenderer: camera buffer",
                size: 128,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
        }

        device.queue.writeBuffer(this._gpuBuffer, 0, this.camera.view as Float32Array);
        device.queue.writeBuffer(this._gpuBuffer, 64, this.camera.projectionMatrix as Float32Array);
        return this._gpuBuffer;
    }

    protected getBindGroupLayoutEntries(): GPUBindGroupLayoutEntry[] {
        return [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { viewDimension: "cube" }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: { type: "filtering" }
            },
            {
                binding: 2, // uniforms
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: "uniform" }
            },
        ];
    }

    private createPipeline(device: GPUDevice): GPURenderPipeline {
        let entries = this.getBindGroupLayoutEntries();
        let bindingGroupDef = device.createBindGroupLayout({ entries: entries });
        let pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindingGroupDef] });

        const shaderModule = device.createShaderModule({ label: "Texture Renderer", code: this.getShader() });
        const pipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain',
                buffers: [
                    {
                        arrayStride: cubeVertexSize,
                        attributes: [
                            {
                                // position
                                shaderLocation: 0,
                                offset: cubePositionOffset,
                                format: 'float32x4',
                            },
                            {
                                // uv
                                shaderLocation: 1,
                                offset: cubeUVOffset,
                                format: 'float32x2',
                            },
                        ],
                    },
                ],
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragmentMain',
                targets: [{
                    format: this.canvasFormat,
                }],
            },
            primitive: {
                topology: 'triangle-list',
                // Since we are seeing from inside of the cube
                // and we are using the regular cube geomtry data with outward-facing normals,
                // the cullMode should be 'front' or 'none'.
                cullMode: 'none',
            },
            multisample: { count: this.aaSampleCount },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: false,
                depthCompare: "less-equal",
            },
        });

        return pipeline;
    }

    protected getShader() {
        return SHADER;
    }
}

const SHADER = `

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

@fragment
fn fragmentMain(
  @location(0) viewDir: vec4f
) -> @location(0) vec4f 
{    
    return textureSample(texture, textureSampler, viewDir.xyz * vec3f(1,1,-1));
}
`;