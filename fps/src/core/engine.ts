import { InputHandler, createInputHandler } from "./input";
import { Scene } from "./scene";
import { Renderer } from "./renderer";
import { ShadowMapRenderer } from "./renderers/shadowMapRenderer";
import { TextureRenderer } from "./renderers/textureRenderer";
import { ShadowMapArray, createAndAssignShadowMap } from "./renderers/shadowMap";

// a command encoder takes multiple render passes
// every frame can be rendered in multiple passes
// every pass can use mutliple pipelines
// every pipeline corresponds to a shader program
// pipelines are defined by a BindGroupLayout and VertexBufferLayout among other things
// first one describes the "uniform" variables of the shader 
// last one the input parameters of the vertex shader function
// every pass needs to set a pipeline and bind the "uniform" data as BindGroup as well as the vertex data

// the ModelInstances are grouped by assets into RenderGroups
// so all instances of one asset can be rendered in one pass

// shaderModule, pipeline, sampler are always the same after Renderer initialization
// vertex data, textures are written to the gpu once per RenderGroup on initialization
// lights and camera are written to the gpu once per frame
// instances data + material parameters are of a RenderGroup is written once per corresponding pass meaning once per frame

export class Engine {

    drawnShadowMapId: number = -1;

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

    get renderer(): ReadonlyArray<Renderer> { return this._renderer; }
    private _renderer: Renderer[] = [];
    public setRendererByIndex(i: number) {
        if (i < 0 || i >= this._renderer.length)
            throw new RangeError("Renderer index out of range.");
        this.mainRenderer = this._renderer[i];
    }
    private mainRenderer!: Renderer;
    private shadowMapRenderer: ShadowMapRenderer | undefined;
    private textureRenderer!: TextureRenderer;
    private shadowMap: ShadowMapArray | undefined;
    private get shadowMaps() { return this.shadowMap?.views; }

    private currentAnimationFrameId = 0;

    constructor(public scene: Scene, public canvas: HTMLCanvasElement, public readonly shadowMapSize = 2048.0) {
        this.inputHandler = createInputHandler(window, canvas);
    }

    async run(): Promise<void> {
        if (this.device) {
            cancelAnimationFrame(this.currentAnimationFrameId);
            this.device.destroy();
        }
        await this.initAsync();
        this.render();
    }

    private async initAsync() {

        await this.initGpuContext();

        this.scene.camera.aspect = this.canvas.width / this.canvas.height;
        if (this.scene.lights.filter(x => x.renderShadowMap).length > 0)
            this.shadowMap = createAndAssignShadowMap(this.device, this.scene, this.shadowMapSize);

        // final result renderer
        this.mainRenderer = new Renderer(this.device, this.scene.camera, this.scene.lights, this.scene.models, this.canvasFormat, this.aaSampleCount, this.shadowMap, this.scene.environmentMap);
        await this.mainRenderer.initializeAsync();
        this.mainRenderer.name = "main";
        this._renderer.push(this.mainRenderer);

        // ShadowMap renderer
        if (this.shadowMap) {
            this.shadowMapRenderer = new ShadowMapRenderer(this.device, this.scene.models, this.shadowMap.views);
            await this.shadowMapRenderer.initAsync();
        }

        // ShadowMap texture renderer
        if (this.shadowMap)
            this.textureRenderer = new TextureRenderer(this.device, this.canvasFormat, this.aaSampleCount, this.canvas.width, this.canvas.height);

        // Renderer for the light views
        for (let [i, light] of [...this.scene.lights.filter(x => x.shadowMap)].entries()) {
            let r = new Renderer(this.device, light.shadowMap!.camera, this.scene.lights, this.scene.models, this.canvasFormat, this.aaSampleCount);
            await r.initializeAsync();
            r.name = `light view ${i}`;
            this._renderer.push(r);
        }
    }

    private render() {
        this.currentAnimationFrameId = requestAnimationFrame(() => {
            const delta = this.getDeltaTime();
            this.scene.update(delta);
            this.scene.camera.update(delta, this.inputHandler());

            // have to be recreated each frame
            let finalTarget = this.context.getCurrentTexture().createView();
            let immediateRenderTarget = this.useMSAA ? this.renderTarget.createView() : finalTarget;

            const renderPassDescriptor: GPURenderPassDescriptor = {
                colorAttachments: [
                    {
                        view: immediateRenderTarget,
                        resolveTarget: this.useMSAA ? finalTarget : undefined,
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
            this.shadowMapRenderer?.render(encoder);
            //final pass
            const renderPass = encoder.beginRenderPass(renderPassDescriptor);

            if (this.drawnShadowMapId >= 0 && this.shadowMaps && this.drawnShadowMapId < this.shadowMaps.length)
                this.textureRenderer.render(this.shadowMaps[this.drawnShadowMapId].textureView, renderPass);
            else
                this.mainRenderer.render(renderPass);
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