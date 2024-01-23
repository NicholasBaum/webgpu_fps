import { Mat4, Vec4, mat4 } from "wgpu-matrix";
import Input from "../input";
import { Camera } from "./camera";


export class DebugCamera implements Camera {
    position: Float32Array;
    constructor(public view: Mat4, public projectionMatrix: Mat4, position: Vec4) {
        this.position = new Float32Array(position);
    }
    update(delta_time: number, input: Input): void { }
    matrix: Mat4 = mat4.identity();
    right!: Vec4;
    up!: Vec4;
    back!: Vec4;
    aspect!: number;
}
