import { mat4, vec3 } from "wgpu-matrix";
import { ModelInstance } from "./ModelInstance";
import { Camera, WASDCamera } from "./camera";
import { CUBE_VERTEX_ARRAY } from "../meshes/CubeMesh";
import { ModelAsset } from "./ModelAsset";

export class Scene {
    public camera: Camera = new WASDCamera();
    public models: ModelInstance[] = [];
    public update(deltaTime: number) { }
}

export class BoxesScene extends Scene {

    constructor() {
        super();
        let cube_asset = new ModelAsset("cube_asset_01", CUBE_VERTEX_ARRAY, '../assets/uv_dist.jpg');
        let s = 0.35;
        let d = 2;
        for (let i = 0; i < 16; i++) {
            let t = mat4.identity();
            let x = (i % 4) * d;
            let y = Math.floor(i / 4) * d;
            mat4.translate(t, [x - 3.0, y - 2, 0], t)
            mat4.scale(t, [s, s, s], t)
            let instance = new ModelInstance(`Cube01${i.toString().padStart(3, '0')}`, cube_asset, t);
            this.models.push(instance);
        }
    }

    public override update(deltaTime: number): void {
        const now = Date.now() / 1000;
        for (let i = 0; i < this.models.length; i++) {
            let modelMatrix = this.models[i].transform;
            mat4.rotate(
                modelMatrix,
                vec3.fromValues(Math.sin(now), Math.cos(now), 0),
                0.01,
                modelMatrix
            );
        }
    }
}