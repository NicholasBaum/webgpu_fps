import { InputHandler, createInputHandler } from "./input";
import { Scene } from "./scene";
import { Renderer } from "./renderer";
import { ShadowMapRenderer } from "./shadows/shadowMapRenderer";
import { ShadowMapArray, createAndAssignShadowMap } from "./shadows/shadowMap";
import { EnvironmentMapRenderer, createEnvironmentRenderer } from "./environment/environmentMapRenderer";
import { LightSourceRenderer, createLightSourceRenderer } from "./renderer/lightSourceRenderer";
import { TexRenderMode, TextureRenderer, createTextureRenderer } from "./renderer/textureRenderer";

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

    showShadowMapView_Id: number = -1;
    renderEnvironment: boolean = true;
    showEnvironmentMapView: boolean = false;
    showIrradianceMapView: boolean = false;
    showPrefilteredMapView: boolean = false;
    showPrefEnvMapIndex: number = 0;
    showBrdfMapView: boolean = false;

    // renderer
    private currentRenderer!: Renderer;
    get renderer(): ReadonlyArray<Renderer> { return this._renderer; }
    private _renderer: Renderer[] = [];
    public setRendererByIndex(i: number) {
        if (i < 0 || i >= this._renderer.length)
            throw new RangeError("Renderer index out of range.");
        this.currentRenderer = this._renderer[i];
    }

    private shadowMapRenderer: ShadowMapRenderer | undefined;
    private shadowMap: ShadowMapArray | undefined;
    private get shadowMaps() { return this.shadowMap?.views; }

    private environmentRenderer?: EnvironmentMapRenderer;

    private textureViewer!: TextureRenderer;
    private currentTexture: [view: GPUTextureView, mode: TexRenderMode] | undefined = undefined;

    private lightSourceRenderer!: LightSourceRenderer;


    // initialized in initGpuContext method
    private readonly aaSampleCount: 1 | 4 = 4; // only 1 and 4 is allowed    
    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private canvasFormat!: GPUTextureFormat;
    private renderTarget!: GPUTexture; // if using MSAA you need to render to background "canvas"    
    private depthTexture!: GPUTexture;
    private depthTextureView!: GPUTextureView;

    private inputHandler: InputHandler;
    private lastFrameMS = Date.now();
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
        else {
            this.shadowMap = undefined;
            this.shadowMapRenderer = undefined;
        }

        // environment renderer
        if (this.scene.environmentMap) {
            await this.scene.environmentMap?.loadAsync(this.device);
            this.environmentRenderer = await createEnvironmentRenderer(this.device, this.scene.camera, this.scene.environmentMap.cubeMap);
        }
        else {
            this.environmentRenderer = undefined;
        }

        // main renderer
        this._renderer = [];
        this.currentRenderer = new Renderer(this.device, this.scene.camera, this.scene.lights, this.scene.models, this.canvasFormat, this.aaSampleCount, this.shadowMap, this.scene.environmentMap);
        await this.currentRenderer.initializeAsync();
        this.currentRenderer.name = "main";
        this._renderer.push(this.currentRenderer);

        // shadowMap builder
        if (this.shadowMap) {
            this.shadowMapRenderer = new ShadowMapRenderer(this.device, this.scene.models, this.shadowMap.views);
            await this.shadowMapRenderer.initAsync();
        }

        // renderer for the light views       
        for (let [i, light] of [...this.scene.lights.filter(x => x.shadowMap)].entries()) {
            let r = new Renderer(this.device, light.shadowMap!.camera, this.scene.lights, this.scene.models, this.canvasFormat, this.aaSampleCount);
            await r.initializeAsync();
            r.name = `light view ${i}`;
            this._renderer.push(r);
        }

        // dev renderer
        this.textureViewer = await createTextureRenderer(this.device, this.canvas.width, this.canvas.height);
        this.lightSourceRenderer = await createLightSourceRenderer(this.device, this.scene.lights, this.scene.camera);
    }

    private render() {
        this.currentAnimationFrameId = requestAnimationFrame(() => {
            // update scene
            const delta = this.getDeltaTime();
            this.scene.update(delta);
            this.scene.camera.update(delta, this.inputHandler());

            // prepass build shadowmaps
            const encoder = this.device.createCommandEncoder();
            this.shadowMapRenderer?.render(encoder);

            // final pass
            const renderPass = encoder.beginRenderPass(this.createRenderPassDescriptor());

            this.selectTextureForTextureViewer();
            if (this.currentTexture)
                this.textureViewer.render(renderPass, this.currentTexture[0], this.currentTexture[1]);
            else {
                this.currentRenderer.render(renderPass);
                this.lightSourceRenderer.render(this.device, renderPass);
                if (this.renderEnvironment)
                    this.environmentRenderer?.render(renderPass);
            }
            renderPass.end();

            // execute commands
            this.device.queue.submit([encoder.finish()]);

            // loop render call
            this.render()
        });
    }

    private selectTextureForTextureViewer() {
        if (this.shadowMaps && this.showShadowMapView_Id >= 0 && this.showShadowMapView_Id < this.shadowMaps.length)
            this.currentTexture = [this.shadowMaps[this.showShadowMapView_Id].textureView, 'depth'];
        else if (this.showEnvironmentMapView && this.scene.environmentMap)
            this.currentTexture = [this.scene.environmentMap.cubeMap.createView(), '2d-array-l6'];
        else if (this.showIrradianceMapView && this.scene.environmentMap)
            this.currentTexture = [this.scene.environmentMap.irradianceMap.createView(), '2d-array-l6'];
        else if (this.showPrefilteredMapView && this.scene.environmentMap)
            this.currentTexture = [this.scene.environmentMap.prefilteredMap.createView({ mipLevelCount: 1, baseMipLevel: this.showPrefEnvMapIndex }), '2d-array-l6'];
        else if (this.showBrdfMapView && this.scene.environmentMap)
            this.currentTexture = [this.scene.environmentMap.brdfMap.createView(), '2d'];
        else
            this.currentTexture = undefined;
    }

    private createRenderPassDescriptor(): GPURenderPassDescriptor {
        // have to be recreated each frame
        const useMSAA = this.aaSampleCount > 1;
        const finalTarget = this.context.getCurrentTexture().createView();
        const immediateRenderTarget = useMSAA ? this.renderTarget.createView() : finalTarget;

        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: immediateRenderTarget,
                    resolveTarget: useMSAA ? finalTarget : undefined,
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

        return renderPassDescriptor;
    }

    private getDeltaTime(): number {
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
        if (this.aaSampleCount > 1) {
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
            sampleCount: this.aaSampleCount,
        });

        this.depthTextureView = this.depthTexture.createView();
    }
}