import { Camera } from "./camera/camera";
import { WASDCamera } from "./camera/wasdCamera";
import { DirectLight } from "./directLight";
import { ModelInstance } from "./modelInstance";

export class Scene {
    public camera: Camera = new WASDCamera();
    public light: DirectLight = new DirectLight([0, 10, 0], [0, -1, 0], [1, 1, 1, 0]);
    public models: ModelInstance[] = [];
    public update(deltaTime: number) { }
}