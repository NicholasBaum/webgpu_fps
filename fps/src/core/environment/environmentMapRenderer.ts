import { ICamera } from '../camera/camera';
import { createSampler } from '../pipeline/pipelineBuilder';
import { cubePositionOffset, cubeUVOffset, cubeVertexArray, cubeVertexCount, cubeVertexSize } from '../../meshes/cube_mesh';
import tone_mapping from "../../shaders/tone_mapping.wgsl"

export class EnvironmentMapRenderer {

    private vertexBuffer: GPUBuffer;
    private sampler: GPUSampler;
    private pipeline: GPURenderPipeline;
    private textureView: GPUTextureView

    constructor(
        private device: GPUDevice,
        private canvasFormat: GPUTextureFormat,
        private aaSampleCount: number,
        private camera: ICamera,
        texture: GPUTexture
    ) {
        this.vertexBuffer = device.createBuffer({
            size: cubeVertexArray.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.vertexBuffer, 0, cubeVertexArray as Float32Array)
        this.pipeline = this.createPipeline(device, texture.format == 'rgba16float');
        this.sampler = createSampler(device);
        this.textureView = texture.createView({ dimension: 'cube' });
    }

    render(pass: GPURenderPassEncoder) {
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.createBindGroup());
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.draw(cubeVertexCount);
    }

    protected createBindGroup() {
        let desc: { label: string, layout: GPUBindGroupLayout, entries: GPUBindGroupEntry[] } = {
            label: "EnvironmentMapRenderer binding group",
            layout: this.pipeline.getBindGroupLayout(0),
            entries:
                [
                    {
                        binding: 0,
                        resource: this.textureView,
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

    private createPipeline(device: GPUDevice, isHdr: boolean): GPURenderPipeline {
        let entries = this.getBindGroupLayoutEntries();
        let bindingGroupDef = device.createBindGroupLayout({ entries: entries });
        let pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindingGroupDef] });

        const shaderModule = device.createShaderModule({ label: "EnvironmentMapRenderer", code: this.getShader() });
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
                constants: { isHdr: isHdr ? 1.0 : 0.0 },
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
        return SHADER + tone_mapping;
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