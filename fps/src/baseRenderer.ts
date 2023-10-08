import { mat4, vec3 } from "wgpu-matrix";
import { CUBE_VERTEX_ARRAY } from "./meshes/CubeMesh";
import { ModelInstance } from "./core/ModelInstance";
import { GpuManager } from "./core/GpuManager";
import { ModelAsset } from "./core/ModelAsset";

export class BaseRenderer {

    protected useMSAA = true;
    private readonly aaSampleCount = 4; // other values aren't allowed i think
    private renderTargetView: GPUTextureView | undefined = undefined; // if using MSAA you need to render to background "canvas"

    protected device!: GPUDevice;
    protected context!: GPUCanvasContext;
    protected canvasFormat!: GPUTextureFormat;

    private gpuManager!: GpuManager;
    protected uniformsBuffer!: GPUBuffer;
    protected pipeline!: GPURenderPipeline;
    protected bindingGroup!: GPUBindGroup;
    protected shaderModule!: GPUShaderModule;

    private cube_asset!: ModelAsset;
    private instances: ModelInstance[] = [];

    get vertexBuffer() { return this.gpuManager.vertexBuffer }

    constructor(protected canvas: HTMLCanvasElement) { }


    async initialize() {
        await this.initGpuContext();

        this.uniformsBuffer = this.device.createBuffer(this.getUniformsDesc());
        this.cube_asset = this.gpuManager.loadModel("cube_ass_01", CUBE_VERTEX_ARRAY);
        this.instances.push(new ModelInstance("Cube01", this.cube_asset));
        this.instances.push(new ModelInstance("Cube02", this.cube_asset));

        this.shaderModule = this.device.createShaderModule(this.cube_asset.shader);
        this.pipeline = await this.device.createRenderPipelineAsync(this.createCubePipelineDesc(this.cube_asset.vertexBufferLayout, this.shaderModule));
        this.bindingGroup = this.device.createBindGroup(this.getBindingGroupDesc(this.pipeline));

        this.render();
    }

    render() {
        requestAnimationFrame(() => { this.initRenderLoop(); });
    }

    private initRenderLoop() {
        this.updateTransforms();

        const commandEncoder = this.device.createCommandEncoder();
        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: this.useMSAA ? this.renderTargetView! : this.context.getCurrentTexture().createView(),
                    resolveTarget: this.useMSAA ? this.context.getCurrentTexture().createView() : undefined,
                    loadOp: "clear",
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    storeOp: "store",
                },
            ],
        };
        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindingGroup);
        renderPass.setVertexBuffer(0, this.vertexBuffer);
        renderPass.draw(this.instances[0].asset.vertexCount, this.instances.length, 0, 0);
        renderPass.end();
        this.device.queue.submit([commandEncoder.finish()]);

        this.render();
    }

    protected updateTransforms() {
        const aspect = this.canvas.width / this.canvas.height;
        const projectionMatrix = mat4.perspective(
            (2 * Math.PI) / 5,
            aspect,
            1,
            100.0
        );
        const modelViewProjectionMatrix = mat4.create();
        const viewMatrix = mat4.identity();
        mat4.translate(viewMatrix, vec3.fromValues(0, 0, -4), viewMatrix);
        const now = Date.now() / 1000;
        mat4.rotate(
            viewMatrix,
            vec3.fromValues(Math.sin(now), Math.cos(now), 0),
            1,
            viewMatrix
        );

        mat4.multiply(projectionMatrix, viewMatrix, modelViewProjectionMatrix);
        this.device.queue.writeBuffer(this.uniformsBuffer, 0, modelViewProjectionMatrix as Float32Array);
    }

    private getBindingGroupDesc(pipeline: GPURenderPipeline): GPUBindGroupDescriptor {
        return {
            label: "binding group",
            layout: pipeline.getBindGroupLayout(0),
            entries: [{
                binding: 0,
                resource: { buffer: this.uniformsBuffer }
            },
            ]
        }
    }

    private getUniformsDesc(): GPUBufferDescriptor {
        return {
            label: "uniforms buffer",
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        }
    }

    private createCubePipelineDesc(vertexBufferLayout: GPUVertexBufferLayout, shaderModule: GPUShaderModule): GPURenderPipelineDescriptor {
        return {
            label: "mesh pipeline",
            layout: "auto",
            vertex: {
                module: shaderModule,
                entryPoint: "vertexMain",
                buffers: [vertexBufferLayout]
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fragmentMain",
                targets: [{
                    format: this.canvasFormat,
                    blend: {
                        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                        alpha: {}
                    }
                }]
            },
            primitive: {
                topology: "triangle-list",
                cullMode: 'back',
            },
            multisample: this.useMSAA ?
                { count: this.aaSampleCount, }
                : undefined,
        };
    }

    private async initGpuContext() {

        // get gpu device
        if (!navigator.gpu)
            throw new Error("WebGPU not supported on this browser.");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter)
            throw new Error("No appropriate GPUAdapter found.");
        this.device = await adapter.requestDevice();

        // init canvas context
        this.context = <unknown>this.canvas.getContext("webgpu") as GPUCanvasContext;
        this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: this.canvasFormat,
            alphaMode: 'premultiplied',
        });

        // init "background" rendertarget 
        if (this.useMSAA) {
            const renderTarget = this.device.createTexture({
                size: [this.canvas.width, this.canvas.height],
                sampleCount: this.aaSampleCount,
                format: this.canvasFormat,
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });
            this.renderTargetView = renderTarget.createView();
        }

        // init custom objects
        this.gpuManager = new GpuManager(this.device);
    }
}
