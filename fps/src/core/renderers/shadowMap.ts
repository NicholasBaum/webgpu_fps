import { Mat4, mat4, vec3 } from "wgpu-matrix";
import { BoundingBox, calcBBUnion, calcBBCenter, transformBoundingBox } from "../boundingBox";
import { Light } from "../light";
import { Scene } from "../scene";

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
        const sm = new ShadowMap(index, smView, light, bb);
        sm.createViewMat();
        views.push(sm);
        light.shadowMap = sm;
    });
    return { textureArray, views, textureSize: size };
}


// class holding the shadow map textures view for a light 
// and update logic
export class ShadowMap {

    public light_mat: Mat4 = mat4.identity();

    constructor(
        public readonly id: number,
        public readonly textureView: GPUTextureView,
        private readonly light: Light,
        private readonly boundingBox: BoundingBox
    ) { }

    public createViewMat() {
        // calculating a good spot for the directional light view
        // by using the scenes bounding box
        const bb = this.boundingBox;
        const bbCenter = calcBBCenter(bb);
        const bbSpan = vec3.distance(bb.min, bb.max);
        const lightDir = vec3.normalize(this.light.direction);
        const lightPos = vec3.addScaled(bbCenter, lightDir, -bbSpan);
        const lightViewMatrix = mat4.lookAt(lightPos, bbCenter, [0, 1, 0]);
        const bb_lightSpace = transformBoundingBox(bb, lightViewMatrix);

        const lightProjectionMatrix = mat4.create();
        {
            const left = bb_lightSpace.min[0];
            const right = bb_lightSpace.max[0];
            const bottom = bb_lightSpace.min[1];
            const top = bb_lightSpace.max[1];
            const near = 0;
            const far = -bb_lightSpace.min[2];
            mat4.ortho(left, right, bottom, top, near, far, lightProjectionMatrix);
        }

        const lightViewProjMatrix = mat4.multiply(
            lightProjectionMatrix,
            lightViewMatrix
        );
        this.light_mat = lightViewProjMatrix;
    }
}