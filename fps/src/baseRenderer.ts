import { Mat4, mat4 } from "wgpu-matrix";
import { ModelInstance } from "./core/ModelInstance";
import { VertexBufferManager } from "./core/VertexBufferManager";
import { Camera } from "./core/camera";
import { InputHandler } from "./core/input";
import { createTextureFromImage } from "webgpu-utils";

export class BaseRenderer {

    public useMSAA = true;
    public useMipMaps = true;

    private readonly aaSampleCount = 4; // only 1 and 4 is allowed
    private renderTargetView: GPUTextureView | undefined = undefined; // if using MSAA you need to render to background "canvas"

    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private canvasFormat!: GPUTextureFormat;

    public vBufferManager!: VertexBufferManager;
    private uniformBuffer!: GPUBuffer;
    private pipeline!: GPURenderPipeline;
    private bindingGroup!: GPUBindGroup;
    private shaderModule!: GPUShaderModule;
    private depthTexture!: GPUTexture;
    private viewProjectionMatrix: Mat4 = mat4.identity();

    constructor(public instances: ModelInstance[], protected canvas: HTMLCanvasElement, public camera: Camera, public inputHandler: InputHandler) { }

    async initialize() {
        this.uniformBuffer = this.device.createBuffer(this.getUniformsDesc(this.instances.length * 64));
        let entity = this.instances[0];
        this.shaderModule = this.device.createShaderModule(entity.asset.shader);
        this.pipeline = await this.device.createRenderPipelineAsync(this.createCubePipelineDesc(entity.asset.vertexBufferLayout, this.shaderModule));

        const samplerDescriptor: GPUSamplerDescriptor = {
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
            lodMinClamp: 0,
            lodMaxClamp: 4,
            maxAnisotropy: 16,
        };
        const sampler = this.device.createSampler(samplerDescriptor);
        const texture = await createTextureFromImage(this.device, '../assets/uv_dist.jpg', { mips: this.useMipMaps });
        this.bindingGroup = this.device.createBindGroup(this.getBindingGroupDesc(this.pipeline, sampler, texture));
    }

    private getUniformsDesc(size: number): GPUBufferDescriptor {
        return {
            label: "entity data buffer",
            size: size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        }
    }

    render(deltaTime: number) {
        this.updateTransforms(deltaTime);

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
            depthStencilAttachment: {
                view: this.depthTexture.createView(),

                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        };
        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindingGroup);
        renderPass.setVertexBuffer(0, this.vBufferManager.buffers[0]);
        renderPass.draw(this.instances[0].asset.vertexCount, this.instances.length, 0, 0);
        renderPass.end();
        this.device.queue.submit([commandEncoder.finish()]);
    }

    protected updateTransforms(deltaTime: number) {
        const vp = this.getViewProjectionMatrix(deltaTime);
        for (let i = 0; i < this.instances.length; i++) {
            let modelMatrix = this.instances[i].transform;
            let modelViewProjecitonMatrix = mat4.multiply(vp, modelMatrix);
            this.device.queue.writeBuffer(this.uniformBuffer, i * 64, modelViewProjecitonMatrix as Float32Array);
        }
    }

    getViewProjectionMatrix(deltaTime: number) {
        const aspect = this.canvas.width / this.canvas.height;
        // matrix applying perspective distortion
        const projectionMatrix = mat4.perspective(
            (2 * Math.PI) / 5,
            aspect,
            1,
            100.0
        );
        // standard translation matrix to get objects into view
        const viewMatrix = this.camera.update(deltaTime, this.inputHandler());
        // projection and view matrix are split because lightning calculation need to be done post view 
        mat4.multiply(projectionMatrix, viewMatrix, this.viewProjectionMatrix);
        return this.viewProjectionMatrix as Float32Array;
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
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        };
    }

    public async initGpuContext() {

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

        // depth stencil
        // either you have to order the vertices correctly so the closest fragment gets rendered last
        // or use a depth stencil which automatically renders the fragment closest to camera by creating a zbuffer
        this.depthTexture = this.device.createTexture({
            size: [this.canvas.width, this.canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            sampleCount: this.useMSAA ? 4 : 1,
        });

        // init custom objects
        this.vBufferManager = new VertexBufferManager(this.device);
    }
}
