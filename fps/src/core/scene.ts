import { Camera } from "./camera/camera";
import { WASDCamera } from "./camera/wasdCamera";
import { EnvironmentMap } from "./environment/environmentMap";
import { Light, LightType } from "./light";
import { ModelInstance } from "./modelInstance";

export class Scene {
    public aspectRatio: 'auto' | 'camera' = 'auto';
    public isAnimated: boolean = true;
    public camera: Camera = new WASDCamera({ position: [0, 0, 10] });
    public lights: Light[] = [new Light({ type: LightType.Direct, direction: [-1, -2, -1] })];;
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