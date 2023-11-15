import { Camera } from "./camera/camera";
import { WASDCamera } from "./camera/wasdCamera";
import { ModelInstance } from "./modelInstance";

export class Scene {
    public camera: Camera = new WASDCamera();
    public models: ModelInstance[] = [];
    public update(deltaTime: number) { }
}