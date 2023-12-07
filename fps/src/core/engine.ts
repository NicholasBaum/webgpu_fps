import { MeshRenderer } from "./meshRenderer";
import { InputHandler, createInputHandler } from "./input";
import { Scene } from "./scene";
import { Camera } from "./camera/camera";
import { ModelInstance } from "./modelInstance";
import { ModelAsset } from "./modelAsset";
import { mat4 } from "wgpu-matrix";

export class Engine {

    public useMSAA = true;
    public useMipMaps = true;
    private readonly aaSampleCount = 4; // only 1 and 4 is allowed

    // initialized in init method
    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private canvasFormat!: GPUTextureFormat;
    private renderTarget!: GPUTexture; // if using MSAA you need to render to background "canvas"    
    private depthTexture!: GPUTexture;
    private depthTextureView!: GPUTextureView;

    private inputHandler: InputHandler;
    private lastFrameMS = Date.now();
    private meshRenderer: MeshRenderer[] = [];
    private sceneMap: Map<ModelAsset, ModelInstance[]>;

    constructor(public scene: Scene, public canvas: HTMLCanvasElement) {
        this.sceneMap = this.groupByAsset(this.scene.models);
        this.inputHandler = createInputHandler(window);
    }

    async run(): Promise<void> {
        await this.initAsync();
        this.render();
    }

    private async initAsync() {

        await this.initGpuContext();
        
        this.scene.camera.aspect = this.canvas.width / this.canvas.height;
      
        for (let group of this.sceneMap.values()) {
            const renderer = new MeshRenderer(
                group,
                this.scene.camera,
                this.device,
                this.canvasFormat,
                this.aaSampleCount,
            );
            await renderer.initializeAsync();
            this.meshRenderer.push(renderer);
        }
    }

    private render() {
        requestAnimationFrame(() => {
            const delta = this.getDeltaTime();
            this.scene.update(delta);
            this.scene.camera.update(delta, this.inputHandler());

            // have to be recreated each frame
            let resolveTargetView = this.context.getCurrentTexture().createView();
            let renderTargetView = this.useMSAA ? this.renderTarget.createView() : resolveTargetView;

            const renderPassDescriptor: GPURenderPassDescriptor = {
                colorAttachments: [
                    {
                        view: renderTargetView,
                        resolveTarget: resolveTargetView,
                        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    }
                ],
                depthStencilAttachment: {
                    view: this.depthTextureView,
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store',
                }
            };
            const encoder = this.device.createCommandEncoder();
            const renderPass = encoder.beginRenderPass(renderPassDescriptor);

            for (let r of this.meshRenderer)
                r.render(renderPass);
            renderPass.end();
            this.device.queue.submit([encoder.finish()]);
            this.render()
        });
    }

    getDeltaTime(): number {
        const now = Date.now();
        const deltaTime = (now - this.lastFrameMS) / 1000;
        this.lastFrameMS = now;
        return deltaTime;
    }

    groupByAsset(instances: ModelInstance[]): Map<ModelAsset, ModelInstance[]> {
        let groups: Map<ModelAsset, ModelInstance[]> = instances.reduce((acc, m) => {
            let key = m.asset;
            if (!acc.has(key))
                acc.set(key, []);
            acc.get(key)?.push(m);
            return acc;
        }, new Map<ModelAsset, ModelInstance[]>());
        return groups;
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
            this.renderTarget = this.device.createTexture({
                size: [this.canvas.width, this.canvas.height],
                sampleCount: this.aaSampleCount,
                format: this.canvasFormat,
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });
        }

        // depth stencil
        // either you have to order the vertices correctly so the closest fragment gets rendered last
        // or use a depth stencil which automatically renders the fragment closest to camera by creating a zbuffer
        this.depthTexture = this.device.createTexture({
            size: [this.canvas.width, this.canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            sampleCount: this.useMSAA ? this.aaSampleCount : 1,
        });

        this.depthTextureView = this.depthTexture.createView();
    }

}