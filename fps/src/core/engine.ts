import { MeshRenderer } from "./meshRenderer";
import { createInputHandler } from "./input";
import { Scene } from "./scene";
import { Camera } from "./camera/camera";

export class Engine {

    private lastFrameMS = Date.now();
    private meshRenderer: MeshRenderer;

    constructor(public scene: Scene, public canvas: HTMLCanvasElement, public camera: Camera) {
        this.meshRenderer = new MeshRenderer(scene.models, canvas, camera, createInputHandler(window));
    }

    async run(): Promise<void> {
        await this.meshRenderer.initialize();
        this.internalRun();
    }

    private internalRun() {
        requestAnimationFrame(() => {
            let delta = this.getDeltaTime();
            this.scene.update(delta);
            this.meshRenderer.render(delta);
            this.internalRun()
        });
    }

    getDeltaTime(): number {
        const now = Date.now();
        const deltaTime = (now - this.lastFrameMS) / 1000;
        this.lastFrameMS = now;
        return deltaTime;
    }
}