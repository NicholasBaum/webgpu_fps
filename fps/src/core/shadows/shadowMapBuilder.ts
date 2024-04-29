import { Light, LightType } from "../light";
import { ModelInstance } from "../modelInstance";
import { calcBBUnion } from "../primitives/boundingBox";
import { DirectShadowMap, ShadowMap, TargetShadowMap } from "./shadowMap";

export type ShadowMapBuilder = { textureArray: GPUTexture, textureSize: number, maps: ShadowMap[], }

export function buildAndAssignShadowMaps(
    device: GPUDevice,
    models: ModelInstance[],
    lights: Light[],
    size: number = 1024.0
): ShadowMapBuilder {

    let selectedLights = lights.filter(x => x.useShadowMap);
    if (selectedLights.length < 1)
        throw new Error("Can't create shadow map with no applicable lighs.");

    let shadowMaps: ShadowMap[] = []
    let boxes = models.map(x => x.getBoundingBox());
    let bb = calcBBUnion(boxes);

    let textureArray = device.createTexture({
        size: [size, size, selectedLights.length],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        format: 'depth32float',
    });

    selectedLights.forEach((light, index) => {
        const textureView = textureArray.createView({
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
                sm = new DirectShadowMap(index, textureView, light, bb);
                break;
            case LightType.Target:
                sm = new TargetShadowMap(index, textureView, light);
                break;
            default:
                throw new Error(`Can't create a shadow map for type ${LightType[light.type]}`);
        }
        sm.createViewMat();
        shadowMaps.push(sm);
        light.shadowMap = sm;
    });
    return { textureArray, maps: shadowMaps, textureSize: size };
}
