import { Mat4, mat4 } from "wgpu-matrix";
import { ModelAsset } from "./ModelAsset";

export class ModelInstance {
    constructor(public name: string, public readonly asset: ModelAsset, public transform: Mat4 = mat4.identity()) { }
}