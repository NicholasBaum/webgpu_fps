import { ModelInstance } from "./modelInstance";
import { Camera, WASDCamera } from "./camera";

export class Scene {
    public camera: Camera = new WASDCamera();
    public models: ModelInstance[] = [];
    public update(deltaTime: number) { }
}