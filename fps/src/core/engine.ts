import { InputHandler, createInputHandler } from "./input";
import { Scene } from "./scene";
import { ShadowMapRenderer, createShadowMapRendererAsync } from "./shadows/shadowMapRenderer";
import { ShadowMapArray, createAndAssignShadowMap } from "./shadows/shadowMap";
import { EnvironmentRenderer, createEnvironmentRenderer } from "./environment/environmentRenderer";
import { LightSourceRenderer, createLightSourceRenderer } from "./renderer/lightSourceRenderer";
import { TexRenderMode, TextureRenderer, createTextureRenderer } from "./renderer/textureRenderer";
import { SceneRenderer, createLightViewRenderers, createSceneRenderer } from "./renderer/sceneRenderer";

// a command encoder takes multiple render passes
// every frame can be rendered in multiple passes
// every pass can use mutliple pipelines
// every pipeline corresponds to a shader program
// pipelines are defined by a BindGroupLayout and VertexBufferLayout among other things
// former defines a shaders "global/uniform" data
// later one the format of the vertex shaders input data
// every pass needs to set a pipeline and bind the "uniform" data as BindGroup as well as the vertex data
export class Engine {

    // renderer
    private sceneRenderer!: SceneRenderer;

    private shadowMapRenderer: ShadowMapRenderer | undefined;
    private shadowMap: ShadowMapArray | undefined;
    private useShadowMaps = false;

    // dev renderer
    private textureViewer!: TextureRenderer;
    private _currentTexture2dView: [view: GPUTextureView, mode: TexRenderMode] | undefined = undefined;

    private lightViewRenderers: { renderer: SceneRenderer, selected: boolean }[] = [];
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

        // reset 
        this._currentTexture2dView = undefined;
        this.scene.camera.aspect = this.canvas.width / this.canvas.height;

        await this.buildShadowMap();

        // build environment maps and scene renderer
        await this.scene.environmentMap?.buildAsync(this.device);
        this.sceneRenderer = await createSceneRenderer(this.device, this.scene, this.shadowMap);



        // dev renderer        
        this.lightViewRenderers = (await createLightViewRenderers(this.device, this.scene)).map(x => { return { renderer: x, selected: false } });
        this.textureViewer = await createTextureRenderer(this.device, this.canvas.width, this.canvas.height);
        this.lightSourceRenderer = await createLightSourceRenderer(this.device, this.scene.lights, this.scene.camera);
    }

    private async buildShadowMap() {
        this.shadowMap = undefined;
        this.shadowMapRenderer = undefined;
        this.useShadowMaps = this.scene.lights.filter(x => x.useShadowMap).length > 0;
        if (!this.useShadowMaps)
            return;

        this.shadowMap = createAndAssignShadowMap(this.device, this.scene.models, this.scene.lights, this.shadowMapSize);
        this.shadowMapRenderer = await createShadowMapRendererAsync(this.device, this.scene, this.shadowMap);
    }

    private render() {
        this.currentAnimationFrameId = requestAnimationFrame(() => {

            // update scene
            const delta = this.getDeltaTime();
            this.scene.update(delta);
            this.scene.camera.update(delta, this.inputHandler());

            // create command buffer
            const encoder = this.device.createCommandEncoder();

            // shadow map build prepass, used in main and lightview renderer
            this.shadowMapRenderer?.addPass(encoder);

            // main render pass
            const mainPass = encoder.beginRenderPass(this.createRenderPassDescriptor());

            if (this._currentTexture2dView)
                this.textureViewer.render(mainPass, this._currentTexture2dView[0], this._currentTexture2dView[1]);
            else if (this.lightViewRenderers.some(x => x.selected))
                this.lightViewRenderers.find(x => x.selected)!.renderer.render(mainPass);
            else {
                this.sceneRenderer.render(mainPass);
                this.lightSourceRenderer.render(this.device, mainPass);
            }
            mainPass.end();

            // submit commands and loop
            this.device.queue.submit([encoder.finish()]);
            this.render()
        });
    }

    set showBackground(val: boolean) {
        this.sceneRenderer.renderBackground = val;
    }

    showScene() {
        this._currentTexture2dView = undefined;
    }

    showEnvironmentMap() {
        if (this.scene.environmentMap)
            this._currentTexture2dView = [this.scene.environmentMap.cubeMap.createView(), '2d-array-l6'];
    }

    showShadowMap(index: number) {
        if (this.shadowMap && index < this.shadowMap.views.length)
            this._currentTexture2dView = [this.shadowMap.views[index].textureView, 'depth'];
    }

    showIrradianceMap() {
        if (this.scene.environmentMap)
            this._currentTexture2dView = [this.scene.environmentMap.irradianceMap.createView(), '2d-array-l6'];
    }

    showEnvSpecularMap(mipLevel: number) {
        if (this.scene.environmentMap && mipLevel < this.scene.environmentMap.prefilteredMap.mipLevelCount)
            this._currentTexture2dView = [this.scene.environmentMap.prefilteredMap.createView({ mipLevelCount: 1, baseMipLevel: mipLevel }), '2d-array-l6'];
    }

    showBrdfMap() {
        if (this.scene.environmentMap)
            this._currentTexture2dView = [this.scene.environmentMap.brdfMap.createView(), '2d'];
    }

    showLightView(index: number) {
        this.lightViewRenderers.forEach(x => x.selected = false);
        if (index < this.lightViewRenderers.length)
            this.lightViewRenderers[index].selected = true;
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