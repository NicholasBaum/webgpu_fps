import { Mat4, mat4, vec3 } from "wgpu-matrix";
import { BoundingBox, calcBBUnion, calcBBCenter, transformBoundingBox } from "../boundingBox";
import { Light } from "../light";
import { Scene } from "../scene";

export type ShadowMapArray = { texture_array: GPUTexture, views: ShadowMap[] }

export class ShadowMap {
    constructor(
        public readonly id: number,
        private readonly size: number,
        private readonly texture: GPUTexture,
        public readonly textureView: GPUTextureView,
        public light_mat: Mat4,
        private readonly light: Light,
        private readonly boundingBox: BoundingBox
    ) { }

    static createAndAssignShadowMap(device: GPUDevice, scene: Scene, size: number = 1024.0): ShadowMapArray {
        let selectedLights = scene.lights.filter(x => x.renderShadowMap);
        if (selectedLights.length < 1)
            throw new Error("Can't create shadow map with no applicable lighs.");
        let views: ShadowMap[] = []
        let boxes = scene.models.map(x => x.getBoundingBox());
        let bb = calcBBUnion(boxes);
        let texture_array = device.createTexture({
            size: [size, size, selectedLights.length],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            format: 'depth32float',
        });

        selectedLights.forEach((light, i) => {
            light.shadowMap = new ShadowMap(
                i,
                size,
                texture_array,
                texture_array.createView({
                    label: `shadpw map view ${i}`,
                    dimension: "2d",
                    aspect: "all",
                    baseMipLevel: 0,
                    baseArrayLayer: i,
                    arrayLayerCount: 1,
                }),
                mat4.identity(),
                light,
                bb
            );
            light.shadowMap.createViewMat();
            views.push(light.shadowMap);
        });
        return { texture_array, views };
    }

    public createViewMat() {
        // calculating a good spot for the directional light view
        // by using the scenes bounding box
        const bb = this.boundingBox;
        const bbCenter = calcBBCenter(bb);
        const bbSpan = vec3.distance(bb.min, bb.max);
        const lightDir = vec3.normalize(this.light.positionOrDirection);
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