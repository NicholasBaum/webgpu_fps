import { Vec3, Vec4, vec3, vec4 } from "wgpu-matrix";

export class DirectLight {

    constructor(public position: Vec3, public direction: Vec3, public color: Vec4) { }
    get bytes(): Float32Array {
        return new Float32Array(
            [
                ...this.position, 0, // position
                ...vec3.inverse(this.direction), 0, // insverse direction
                ...this.color, // color
            ]
        )
    };
}