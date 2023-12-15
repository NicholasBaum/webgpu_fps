import { Mat4, Vec3, Vec4, mat4, vec3 } from "wgpu-matrix";
import Input from "../input";

// Common interface for camera implementations
export interface Camera {
    // update updates the camera using the user-input and returns the view matrix.
    update(delta_time: number, input: Input): void;

    // The camera matrix.
    // This is the inverse of the view matrix.
    matrix: Mat4;
    // Alias to column vector 0 of the camera matrix.
    right: Vec4;
    // Alias to column vector 1 of the camera matrix.
    up: Vec4;
    // Alias to column vector 2 of the camera matrix.
    back: Vec4;
    // Alias to column vector 3 of the camera matrix.
    position: Vec4;

    view: Mat4;

    aspect: number;

    projectionMatrix: Mat4;
}

// The common functionality between camera implementations
export class CameraBase {
    // The camera matrix
    private matrix_ = new Float32Array([
        1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]);

    public zFar: number = 100000;
    private _aspect: number = 1;
    get aspect() { return this._aspect; }
    set aspect(val: number) {
        this._aspect = val;
        this._projectionMatrix = mat4.perspective(
            (2 * Math.PI) / 5,
            this._aspect,
            1,
            this.zFar,
        );
    }
    private _projectionMatrix = mat4.perspective(
        (2 * Math.PI) / 5,
        this._aspect,
        1,
        this.zFar,
    );
    get projectionMatrix() { return this._projectionMatrix; }

    // The calculated view matrix
    private readonly view_ = mat4.create();

    // Aliases to column vectors of the matrix
    private right_ = new Float32Array(this.matrix_.buffer, 4 * 0, 4);
    private up_ = new Float32Array(this.matrix_.buffer, 4 * 4, 4);
    private back_ = new Float32Array(this.matrix_.buffer, 4 * 8, 4);
    private position_ = new Float32Array(this.matrix_.buffer, 4 * 12, 4);

    // Returns the camera matrix
    get matrix() {
        return this.matrix_;
    }
    // Assigns `mat` to the camera matrix
    set matrix(mat: Mat4) {
        mat4.copy(mat, this.matrix_);
    }

    // Returns the camera view matrix
    get view() {
        return this.view_;
    }
    // Assigns `mat` to the camera view
    set view(mat: Mat4) {
        mat4.copy(mat, this.view_);
    }

    // Returns column vector 0 of the camera matrix
    get right() {
        return this.right_;
    }
    // Assigns `vec` to the first 3 elements of column vector 0 of the camera matrix
    set right(vec: Vec3) {
        vec3.copy(vec, this.right_);
    }

    // Returns column vector 1 of the camera matrix
    get up() {
        return this.up_;
    }
    // Assigns `vec` to the first 3 elements of column vector 1 of the camera matrix
    set up(vec: Vec3) {
        vec3.copy(vec, this.up_);
    }

    // Returns column vector 2 of the camera matrix
    get back() {
        return this.back_;
    }
    // Assigns `vec` to the first 3 elements of column vector 2 of the camera matrix
    set back(vec: Vec3) {
        vec3.copy(vec, this.back_);
    }

    // Returns column vector 3 of the camera matrix
    get position() {
        return this.position_;
    }
    // Assigns `vec` to the first 3 elements of column vector 3 of the camera matrix
    set position(vec: Vec3) {
        vec3.copy(vec, this.position_);
    }
}



// Returns `x` clamped between [`min` .. `max`]
export function clamp(x: number, min: number, max: number): number {
    return Math.min(Math.max(x, min), max);
}

// Returns `x` float-modulo `div`
export function mod(x: number, div: number): number {
    return x - Math.floor(Math.abs(x) / div) * div * Math.sign(x);
}

// Returns `vec` rotated `angle` radians around `axis`
export function rotate(vec: Vec3, axis: Vec3, angle: number): Vec3 {
    return vec3.transformMat4Upper3x3(vec, mat4.rotation(axis, angle));
}

// Returns the linear interpolation between 'a' and 'b' using 's'
export function lerp(a: Vec3, b: Vec3, s: number): Vec3 {
    return vec3.addScaled(a, vec3.sub(b, a), s);
}
