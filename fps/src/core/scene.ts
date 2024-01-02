import { Camera } from "./camera/camera";
import { WASDCamera } from "./camera/wasdCamera";
import { Light } from "./light";
import { LightsArray } from "./lightsArray";
import { ModelInstance } from "./modelInstance";

export class Scene {
    public isAnimated: boolean = true;
    public camera: Camera = new WASDCamera();
    public lights: LightsArray = new LightsArray([new Light()]);;
    public models: ModelInstance[] = [];
    public update(deltaTime: number) { }

    constructor(options?: { isAnimated?: boolean, camera?: Camera }) {
        if (options) {
            this.isAnimated = options.isAnimated ?? true;
            this.camera = options.camera ?? this.camera;
        }
    }
}