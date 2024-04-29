import { InputHandler, createInputHandler } from "./input";
import { Scene } from "./scene";
import { ShadowMapRenderer, createShadowMapRendererAsync } from "./shadows/shadowMapRenderer";
import { LightSourceRenderer, createLightSourceRenderer } from "./renderer/lightSourceRenderer";
import { TexRenderMode, TextureRenderer, createTextureRenderer } from "./renderer/textureRenderer";
import { SceneRenderer, createLightViewRenderers, createSceneRenderer } from "./renderer/sceneRenderer";
import { ShadowMapBuilder, buildAndAssignShadowMaps } from "./shadows/shadowMapBuilder";
import { createDeviceContext } from "./renderer/deviceContext";

// a command encoder takes multiple render passes
// every frame can be rendered in multiple passes
// every pass can use mutliple pipelines
// every pipeline corresponds to a shader program
// pipelines are defined by a BindGroupLayout and VertexBufferLayout among other things
// former defines a shaders "global/uniform" data
// later one the format of the vertex shaders input data
// every pass needs to set a pipeline and bind the "uniform" data as BindGroup as well as the vertex data
export class Engine {

    private readonly useMSAA = true;
    private readonly shadowMapSize = 2048.0

    // renderer
    private sceneRenderer!: SceneRenderer;

    private shadowRenderer: ShadowMapRenderer | undefined;
    private shadowBuilder: ShadowMapBuilder | undefined;
    private useShadowMaps = false;

    // dev renderer
    private textureViewer!: TextureRenderer;
    private _currentTexture2dView: [view: GPUTextureView, mode: TexRenderMode] | undefined = undefined;

    private lightViewRenderers: { renderer: SceneRenderer, selected: boolean }[] = [];
    private lightSourceRenderer!: LightSourceRenderer;

    // initialized in initGpuContext method    
    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private canvasFormat!: GPUTextureFormat;
    private depthTexture!: GPUTexture;
    private depthTextureView!: GPUTextureView;
    // used as intermediate target when MSAA is used 
    private intermediateTarget: GPUTexture | undefined;

    private inputHandler: InputHandler;
    private lastFrameMS = Date.now();
    private currentAnimationFrameId = 0;

    constructor(public scene: Scene, public canvas: HTMLCanvasElement) {
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
        await this.initTargetsAsync()

        // reset 
        this._currentTexture2dView = undefined;
        this.scene.camera.aspect = this.canvas.width / this.canvas.height;

        // build shadow maps
        await this.buildShadowMap();

        // build environment maps and scene renderer
        await this.scene.environmentMap?.buildAsync(this.device);
        this.sceneRenderer = await createSceneRenderer(this.device, this.scene, this.shadowBuilder);

        // dev renderer        
        this.lightViewRenderers = (await createLightViewRenderers(this.device, this.scene)).map(x => { return { renderer: x, selected: false } });
        this.textureViewer = await createTextureRenderer(this.device, this.canvas.width, this.canvas.height);
        this.lightSourceRenderer = await createLightSourceRenderer(this.device, this.scene.lights, this.scene.camera);
    }

    private async buildShadowMap() {
        this.shadowBuilder = undefined;
        this.shadowRenderer = undefined;
        this.useShadowMaps = this.scene.lights.filter(x => x.useShadowMap).length > 0;
        if (!this.useShadowMaps)
            return;

        this.shadowBuilder = buildAndAssignShadowMaps(this.device, this.scene.models, this.scene.lights, this.shadowMapSize);
        this.shadowRenderer = await createShadowMapRendererAsync(this.device, this.scene, this.shadowBuilder);
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
            this.shadowRenderer?.addPass(encoder);

            // main render pass
            const mainPass = encoder.beginRenderPass(this.createDefaultPassDescriptor());

            if (this._currentTexture2dView)
                this.textureViewer.render(mainPass, this._currentTexture2dView[0], this._currentTexture2dView[1]);
            else if (this.lightViewRenderers.some(x => x.selected))
                this.lightViewRenderers.find(x => x.selected)!.renderer.render(mainPass);
            else {
                // main renderer 
                this.sceneRenderer.render(mainPass);
                this.lightSourceRenderer.render(this.device, mainPass);
            }
            mainPass.end();

            // submit commands and loop
            this.device.queue.submit([encoder.finish()]);
            this.render()
        });
    }


    private getDeltaTime(): number {
        const now = Date.now();
        const deltaTime = (now - this.lastFrameMS) / 1000;
        this.lastFrameMS = now;
        return deltaTime;
    }

    private createDefaultPassDescriptor(): GPURenderPassDescriptor {
        // have to be recreated each frame
        const finalTarget = this.context.getCurrentTexture().createView();
        // assuming MSAA is used when intermediateTarget exists
        const intermediateTarget = this.intermediateTarget?.createView() ?? finalTarget;

        const desc: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    // first target of the renderpass
                    view: intermediateTarget ?? finalTarget,
                    // if multi sampling is used the end result is written to this target
                    resolveTarget: intermediateTarget ? finalTarget : undefined,
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

        return desc;
    }

    private async initTargetsAsync() {

        const { device, context, canvasFormat } = await createDeviceContext(this.canvas);
        const sampleCount = this.useMSAA ? 4 : 1;
        const canvas = this.canvas;
        this.device = device;
        this.context = context;
        this.canvasFormat = canvasFormat;

        // in MSAA this is the first render target
        this.intermediateTarget = this.useMSAA ? device.createTexture({
            size: [canvas.width, canvas.height],
            sampleCount: sampleCount,
            format: canvasFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        }) : undefined;

        // used for the zbuffer, alternatively you could order the vertices from back to front
        this.depthTexture = device.createTexture({
            size: [canvas.width, canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            sampleCount: sampleCount,
        });
        this.depthTextureView = this.depthTexture.createView();
    }

    //////////////////////
    //UI Related Section//
    //////////////////////
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
        if (this.shadowBuilder && index < this.shadowBuilder.maps.length)
            this._currentTexture2dView = [this.shadowBuilder.maps[index].textureView, 'depth'];
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
}