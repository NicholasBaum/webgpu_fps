import { InputHandler, createInputHandler } from "./input";
import { Scene } from "./scene";
import { Renderer } from "./renderer";
import { ShadowMapRenderer } from "./renderers/shadowMapRenderer";
import { TextureRenderer } from "./renderers/textureRenderer";

export class Engine {

    private get useMSAA() { return this.aaSampleCount == 4; }
    private readonly aaSampleCount: 1 | 4 = 4; // only 1 and 4 is allowed

    // initialized in initGpuContext method
    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private canvasFormat!: GPUTextureFormat;
    private renderTarget!: GPUTexture; // if using MSAA you need to render to background "canvas"    
    private depthTexture!: GPUTexture;
    private depthTextureView!: GPUTextureView;

    private inputHandler: InputHandler;
    private lastFrameMS = Date.now();

    private renderer!: Renderer;
    private shadowMapRenderer!: ShadowMapRenderer;
    private textureRenderer!: TextureRenderer;

    constructor(public scene: Scene, public canvas: HTMLCanvasElement) {
        this.inputHandler = createInputHandler(window, canvas);
    }

    async run(): Promise<void> {
        await this.initAsync();
        this.render();
    }

    private async initAsync() {

        await this.initGpuContext();

        this.scene.camera.aspect = this.canvas.width / this.canvas.height;
        this.renderer = new Renderer(this.device, this.scene, this.canvasFormat, this.aaSampleCount);
        await this.renderer.initializeAsync();
        this.shadowMapRenderer = new ShadowMapRenderer(this.device, this.scene);
        await this.shadowMapRenderer.initializeAsync();
        this.textureRenderer = new TextureRenderer(this.device, this.canvasFormat, this.aaSampleCount);
    }

    private render() {
        requestAnimationFrame(() => {
            const delta = this.getDeltaTime();
            this.scene.update(delta);
            this.scene.camera.update(delta, this.inputHandler());

            // have to be recreated each frame
            let screenTarget = this.context.getCurrentTexture().createView();
            let directRenderTarget = this.useMSAA ? this.renderTarget.createView() : screenTarget;

            const renderPassDescriptor: GPURenderPassDescriptor = {
                colorAttachments: [
                    {
                        view: directRenderTarget,
                        resolveTarget: this.useMSAA ? screenTarget : undefined,
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

            // prepass
            const encoder = this.device.createCommandEncoder();
            this.shadowMapRenderer.render(encoder);
            //final pass
            const renderPass = encoder.beginRenderPass(renderPassDescriptor);
            //this.textureRenderer.render(this.shadowMapRenderer.shadowDepthTextureView, renderPass);
            this.renderer.render(renderPass);
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