import { Camera } from "./camera/camera";
import { WASDCamera } from "./camera/wasdCamera";
import { EnvironmentMap } from "./environmentMap";
import { Light } from "./light";
import { ModelInstance } from "./modelInstance";

export class Scene {
    public isAnimated: boolean = true;
    public camera: Camera = new WASDCamera();
    public lights: Light[] = [new Light()];;
    public models: ModelInstance[] = [];
    public environmentMap: EnvironmentMap | undefined;

    constructor(options?: { isAnimated?: boolean, camera?: Camera }) {
        if (options) {
            this.isAnimated = options.isAnimated ?? true;
            this.camera = options.camera ?? this.camera;
        }
    }

    public update(deltaTime: number) { }
}