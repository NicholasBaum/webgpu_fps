import { mat4, vec3 } from "wgpu-matrix";
import { CUBE_VERTEX_ARRAY } from "./meshes/CubeMesh";
import { ModelInstance } from "./core/ModelInstance";
import { VertexBufferManager } from "./core/VertexBufferManager";
import { ModelAsset } from "./core/ModelAsset";
import { createTextureOnDevice } from "./core/io";

export class BaseRenderer {

    protected useMSAA = true;
    private readonly aaSampleCount = 4; // other values aren't allowed i think
    private renderTargetView: GPUTextureView | undefined = undefined; // if using MSAA you need to render to background "canvas"

    protected device!: GPUDevice;
    protected context!: GPUCanvasContext;
    protected canvasFormat!: GPUTextureFormat;

    private vBufferManager!: VertexBufferManager;
    private uniformBuffer!: GPUBuffer;
    protected pipeline!: GPURenderPipeline;
    protected bindingGroup!: GPUBindGroup;
    protected shaderModule!: GPUShaderModule;

    private cube_asset!: ModelAsset;
    private boxCount = 16;
    private instances: ModelInstance[] = [];

    constructor(protected canvas: HTMLCanvasElement) { }


    async initialize() {
        await this.initGpuContext();

        this.cube_asset = this.vBufferManager.loadModel("cube_ass_01", CUBE_VERTEX_ARRAY);
        this.uniformBuffer = this.device.createBuffer(this.getUniformsDesc(this.boxCount * 64));

        let s = 0.35;
        let d = 2;
        for (let i = 0; i < this.boxCount; i++) {
            let t = mat4.identity();
            let x = (i % 4) * d;
            let y = Math.floor(i / 4) * d;
            mat4.translate(t, [x - 3.0, y - 2, 0], t)
            mat4.scale(t, [s, s, s], t)
            let instance = new ModelInstance(`Cube01${i.toString().padStart(3, '0')}`, this.cube_asset, t);
            this.instances.push(instance);
        }

        this.shaderModule = this.device.createShaderModule(this.cube_asset.shader);
        this.pipeline = await this.device.createRenderPipelineAsync(this.createCubePipelineDesc(this.cube_asset.vertexBufferLayout, this.shaderModule));

        const sampler = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
        const texture = await createTextureOnDevice('../assets/uv_dist.jpg', this.device);
        this.bindingGroup = this.device.createBindGroup(this.getBindingGroupDesc(this.pipeline, sampler, texture));

        this.render();
    }

    private getUniformsDesc(size: number): GPUBufferDescriptor {
        return {
            label: "entity data buffer",
            size: size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        }
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
        renderPass.setVertexBuffer(0, this.vBufferManager.buffers[0]);
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

        // mat4.rotate(
        //     viewMatrix,
        //     vec3.fromValues(Math.sin(now), Math.cos(now), 0),
        //     1,
        //     viewMatrix
        // );

        mat4.multiply(projectionMatrix, viewMatrix, modelViewProjectionMatrix);
        for (let i = 0; i < this.boxCount; i++) {
            let modelMatrix = this.instances[i].transform;
            mat4.rotate(
                modelMatrix,
                vec3.fromValues(Math.sin(now), Math.cos(now), 0),
                0.01,
                modelMatrix
            );
            let t = mat4.multiply(modelViewProjectionMatrix, modelMatrix);
            this.device.queue.writeBuffer(this.uniformBuffer, i * 64, t as Float32Array);
        }
    }

    private getBindingGroupDesc(pipeline: GPURenderPipeline, sampler: GPUSampler, texture: GPUTexture): GPUBindGroupDescriptor {
        return {
            label: "binding group",
            layout: pipeline.getBindGroupLayout(0),
            entries: [{
                binding: 0,
                resource: { buffer: this.uniformBuffer }
            },
            {
                binding: 1,
                resource: sampler
            },
            {
                binding: 2,
                resource: texture.createView(),
            }
            ]
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
        this.vBufferManager = new VertexBufferManager(this.device);
    }
}
