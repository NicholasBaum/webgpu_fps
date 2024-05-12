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

    public currentFps = 0;
    public currentFrameTime = 0;
    private lastTimestamp = 0;

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
    private currentViewPort: [number, number, number, number];

    constructor(public scene: Scene, public canvas: HTMLCanvasElement) {
        this.inputHandler = createInputHandler(window, canvas);
        this.currentViewPort = [0, 0, canvas.width, canvas.height];
    }

    async runAsync(): Promise<void> {
        if (this.device)
            throw new Error("Engine is already running.");
        await this.initAsync();
        this.render();
    }

    private async initAsync() {
        // get gpu device
        ({ device: this.device, context: this.context, canvasFormat: this.canvasFormat }
            = await createDeviceContext(this.canvas));

        // reset engine
        this._currentTexture2dView = undefined;

        // build shadow maps
        await this.buildShadowMap();

        // build environment maps and scene renderer
        await this.scene.environmentMap?.buildAsync(this.device);
        this.sceneRenderer = await createSceneRenderer(this.device, this.scene, this.shadowBuilder);

        // dev renderer        
        this.lightViewRenderers = (await createLightViewRenderers(this.device, this.scene)).map(x => { return { renderer: x, selected: false } });
        this.textureViewer = await createTextureRenderer(this.device, () => [this.canvas.width, this.canvas.height]);
        this.lightSourceRenderer = await createLightSourceRenderer(this.device, this.scene.lights, this.scene.camera);

        const oberver = new ResizeObserver(() => {
            this.onCanvasSizeChanged()
        })
        oberver.observe(this.canvas);
        this.onCanvasSizeChanged();
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
        requestAnimationFrame((timestamp: number) => {
            const delta_ms = timestamp - this.lastTimestamp;
            const delta = delta_ms * 0.001;
            this.currentFrameTime = 0.8 * delta_ms + 0.2 * this.currentFrameTime;
            this.lastTimestamp = timestamp;
            this.currentFps = 1000 / this.currentFrameTime;

            // update scene            
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
                mainPass.setViewport(this.currentViewPort[0], this.currentViewPort[1], this.currentViewPort[2], this.currentViewPort[3], 0, 1);
                this.sceneRenderer.render(mainPass);
                this.lightSourceRenderer.render(this.device, mainPass);
            }
            mainPass.end();

            // submit commands and loop
            this.device.queue.submit([encoder.finish()]);
            this.render()
        });
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

    private onCanvasSizeChanged() {
        requestAnimationFrame(() => {
            const devicePixelRatio = window.devicePixelRatio;
            this.canvas.width = this.canvas.clientWidth * devicePixelRatio;
            this.canvas.height = this.canvas.clientHeight * devicePixelRatio;
            this.createRenderTargets();
            this.setViewport();
        });
    }

    private createRenderTargets() {
        const sampleCount = this.useMSAA ? 4 : 1;
        const size = [this.canvas.width, this.canvas.height];
        this.intermediateTarget?.destroy();

        // in MSAA this is the first render target
        this.intermediateTarget = this.useMSAA ? this.device.createTexture({
            size: size,
            sampleCount: sampleCount,
            format: this.canvasFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        }) : undefined;

        this.depthTexture?.destroy();
        // used for the zbuffer, alternatively you could order the vertices from back to front
        this.depthTexture = this.device.createTexture({
            size: size,
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            sampleCount: sampleCount,
        });
        this.depthTextureView = this.depthTexture.createView();
    }

    private setViewport() {
        if (this.scene.aspectRatio == 'auto') {
            this.scene.camera.aspect = this.canvas.width / this.canvas.height;
            this.currentViewPort = [0, 0, this.canvas.width, this.canvas.height];
            return;
        }
        const aspect = this.scene.camera.aspect;
        let viewW = this.canvas.width;
        let viewH = viewW / aspect;
        let xOffset = 0;
        let yOffset = (this.canvas.height - viewH) / 2;
        if (viewH > this.canvas.height) {
            viewH = this.canvas.height;
            viewW = viewH * aspect;
            xOffset = (this.canvas.width - viewW) / 2;
            yOffset = 0;
        }
        this.currentViewPort = [xOffset, yOffset, viewW, viewH];
    }

    destroy() {
        this.device.destroy();
    }

    //////////////////////
    //UI Related Section//
    //////////////////////
    set showBackground(val: boolean) {
        this.sceneRenderer.renderBackground = val;
    }

    showScene() {
        this._currentTexture2dView = undefined;
        this.lightViewRenderers.forEach(x => x.selected = false);
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
        if (this.scene.environmentMap && mipLevel < this.scene.environmentMap.specularMap.mipLevelCount)
            this._currentTexture2dView = [this.scene.environmentMap.specularMap.createView({ mipLevelCount: 1, baseMipLevel: mipLevel }), '2d-array-l6'];
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