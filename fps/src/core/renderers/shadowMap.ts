import { Mat4, Vec4, mat4, vec3 } from "wgpu-matrix";
import { BoundingBox, calcBBUnion, calcBBCenter, transformBoundingBox } from "../boundingBox";
import { Light, LightType } from "../light";
import { Scene } from "../scene";
import { ICamera } from "../camera/camera";

export type ShadowMapArray = { textureArray: GPUTexture, textureSize: number, views: ShadowMap[], }

export function createAndAssignShadowMap(device: GPUDevice, scene: Scene, size: number = 1024.0): ShadowMapArray {

    let selectedLights = scene.lights.filter(x => x.renderShadowMap);
    if (selectedLights.length < 1)
        throw new Error("Can't create shadow map with no applicable lighs.");

    let views: ShadowMap[] = []
    let boxes = scene.models.map(x => x.getBoundingBox());
    let bb = calcBBUnion(boxes);

    let textureArray = device.createTexture({
        size: [size, size, selectedLights.length],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: 'depth32float',
    });

    selectedLights.forEach((light, index) => {
        const smView = textureArray.createView({
            label: `shadow map view ${index}`,
            dimension: "2d",
            aspect: "all",
            baseMipLevel: 0,
            baseArrayLayer: index,
            arrayLayerCount: 1,
        });

        let sm: ShadowMap;
        switch (light.type) {
            case LightType.Direct:
                sm = new DirectShadowMap(index, smView, light, bb);
                break;
            case LightType.Target:
                sm = new TargetShadowMap(index, smView, light);
                break;
            default:
                throw new Error(`Can't create a shadow map for type ${LightType[light.type]}`);
        }
        sm.createViewMat();
        views.push(sm);
        light.shadowMap = sm;
    });
    return { textureArray, views, textureSize: size };
}

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

class DirectShadowMap extends ShadowMap {

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
        mat4.lookAt(lightPos, bbCenter, [0, 1, 0], this.view_mat);

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

class TargetShadowMap extends ShadowMap {

    constructor(
        id: number,
        textureView: GPUTextureView,
        light: Light,
    ) {
        super(id, textureView, light);
    }

    public override createViewMat() {
        const pos = this.light.position;
        const targetPos = this.light.target;
        mat4.lookAt(pos, targetPos, [0, 1, 0], this.view_mat);

        const fov = (this.light.cutoffInDeg / 180) * 3.14;
        const aspect = 1;
        const near = 1;
        const far = 100000.0;
        mat4.perspective(fov, aspect, near, far, this.proj_mat);

        mat4.multiply(this.proj_mat, this.view_mat, this.light_mat);
    }
}