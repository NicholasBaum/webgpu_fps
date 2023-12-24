import { Camera } from "./camera/camera";
import { WASDCamera } from "./camera/wasdCamera";
import { DirectLight } from "./light";
import { ModelInstance } from "./modelInstance";

export class Scene {
    public isAnimated: boolean = true;
    public camera: Camera = new WASDCamera();
    public light: DirectLight = new DirectLight(0, [0, -1, -1], [0.5, 0.5, 0.5, 0], [1, 1, 1, 0], 1, 1, 1);
    public models: ModelInstance[] = [];
    public update(deltaTime: number) { }

    constructor(options?: { isAnimated?: boolean, camera?: Camera }) {
        if (options) {
            this.isAnimated = options.isAnimated ?? true;
            this.camera = options.camera ?? this.camera;
        }
    }
}