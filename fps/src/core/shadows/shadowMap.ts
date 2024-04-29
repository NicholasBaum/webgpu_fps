import { Mat4, Vec4, mat4, vec3 } from "wgpu-matrix";
import { BoundingBox, calcBBCenter, transformBoundingBox } from "../primitives/boundingBox";
import { Light } from "../light";
import { ICamera } from "../camera/camera";

// class holding the shadow map textures view for a light 
// and update logic
export abstract class ShadowMap {

    public camera: ICamera;
    public get lightPosition() { return this.light.position; }
    public light_mat: Mat4 = mat4.identity();
    public view_mat: Mat4 = mat4.identity();
    public proj_mat: Mat4 = mat4.identity();

    constructor(
        public readonly id: number,
        public readonly textureView: GPUTextureView,
        protected readonly light: Light,
    ) {
        this.camera = new MatrixForwardingCamera(this);
    }

    public abstract createViewMat(): void;
}

class MatrixForwardingCamera implements ICamera {
    constructor(private map: ShadowMap) { }
    get view(): Mat4 { return this.map.view_mat; }
    get projectionMatrix(): Mat4 { return this.map.proj_mat; }
    get position(): Vec4 { return new Float32Array([...this.map.lightPosition, 1]); }
}

export class DirectShadowMap extends ShadowMap {

    constructor(
        id: number,
        textureView: GPUTextureView,
        light: Light,
        private boundingBox: BoundingBox
    ) {
        super(id, textureView, light);
    }

    public override createViewMat() {
        // calculating a good spot for the directional light view
        // by using the scenes bounding box
        const bb = this.boundingBox;
        const bbCenter = calcBBCenter(bb);
        const bbSpan = vec3.distance(bb.min, bb.max);
        const lightDir = vec3.normalize(this.light.direction);
        const lightPos = vec3.addScaled(bbCenter, lightDir, -bbSpan);

        let up = vec3.cross(this.light.direction, [0, 1, 0]);
        up = vec3.equalsApproximately(up, [0, 0, 0]) ? [0, 0, 1] : [0, 1, 0];
        mat4.lookAt(lightPos, bbCenter, up, this.view_mat);

        const bb_lightSpace = transformBoundingBox(bb, this.view_mat);
        const left = bb_lightSpace.min[0];
        const right = bb_lightSpace.max[0];
        const bottom = bb_lightSpace.min[1];
        const top = bb_lightSpace.max[1];
        const near = 0;
        const far = -bb_lightSpace.min[2];
        mat4.ortho(left, right, bottom, top, near, far, this.proj_mat);

        mat4.multiply(this.proj_mat, this.view_mat, this.light_mat);
    }
}

export class TargetShadowMap extends ShadowMap {

    constructor(
        id: number,
        textureView: GPUTextureView,
        light: Light,
    ) {
        super(id, textureView, light);
    }

    public override createViewMat() {
        const pos = this.light.position;
        const targetPos = vec3.add(pos, this.light.direction);

        // can use any up vector except 0 or parallel to the light direction
        // the up vector only changes the cameras tilt 
        // but not the shadwos of a cone target light        
        let up = vec3.cross(this.light.direction, [0, 1, 0]);
        up = vec3.equalsApproximately(up, [0, 0, 0]) ? [0, 0, 1] : [0, 1, 0];
        mat4.lookAt(pos, targetPos, up, this.view_mat);

        const fov = (this.light.coneAngleDeg / 180) * Math.PI;
        const aspect = 1;
        const near = 0.1;
        const far = 100000.0;
        mat4.perspective(fov, aspect, near, far, this.proj_mat);

        mat4.multiply(this.proj_mat, this.view_mat, this.light_mat);
    }
}