import { Mat4, mat4 } from "wgpu-matrix";
import { ModelAsset } from "./ModelAsset";

export class ModelInstance {
    transform: Mat4 = mat4.create();
    constructor(public name: string, public readonly asset: ModelAsset) { }
}