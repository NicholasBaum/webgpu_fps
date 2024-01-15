import { Mat4, mat4 } from "wgpu-matrix";
import { ModelAsset } from "./modelAsset";

export class ModelInstance {
    constructor(public name: string, public readonly asset: ModelAsset, public transform: Mat4 = mat4.identity()) { }

    translate(x: number, y: number, z: number): ModelInstance {
        mat4.translate(this.transform, [x, y, z], this.transform)
        return this;
    }

    rotate(x: number, y: number, z: number): ModelInstance {
        mat4.rotateX(this.transform, x / 180 * Math.PI, this.transform);
        mat4.rotateY(this.transform, y / 180 * Math.PI, this.transform);
        mat4.rotateZ(this.transform, z / 180 * Math.PI, this.transform);
        return this;
    }

    scale(x: number, y: number, z: number): ModelInstance {
        mat4.scale(this.transform, [x, y, z], this.transform)
        return this;
    }

    scaleBy(x: number): ModelInstance {
        return this.scale(x, x, x);
    }
}