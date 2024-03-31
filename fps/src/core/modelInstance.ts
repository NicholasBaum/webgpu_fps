import { Mat4, Vec3, mat4, vec3 } from "wgpu-matrix";
import { ModelAsset } from "./modelAsset";
import { transformBoundingBox } from "./primitives/boundingBox";

export interface IModelInstance {
    get asset(): ModelAsset;
    get name(): string;
    get transform(): Mat4;
}

export class ModelInstance implements IModelInstance {

    constructor(public name: string, public readonly asset: ModelAsset, public transform: Mat4 = mat4.identity()) { }

    getBoundingBox() {
        return transformBoundingBox(this.asset.boundingBox, this.transform);
    }

    translate(x: number, y: number, z: number): ModelInstance {
        mat4.translate(this.transform, [x, y, z], this.transform)
        return this;
    }

    rotate(x: number, y: number, z: number): ModelInstance {
        mat4.rotateX(this.transform, x / 180 * Math.PI, this.transform);
        mat4.rotateY(this.transform, y / 180 * Math.PI, this.transform);
        mat4.rotateZ(this.transform, z / 180 * Math.PI, this.transform);
        return this;
    }

    scale(x: number, y: number, z: number): ModelInstance {
        mat4.scale(this.transform, [x, y, z], this.transform)
        return this;
    }

    scaleBy(x: number): ModelInstance {
        return this.scale(x, x, x);
    }

    get position(): Vec3 { return [...this.transform].slice(12, 15) }

    lerp(target: Vec3, amount: number) {
        // Todo: terrible implementation
        let tmp = this.position;
        const newPos = vec3.lerp(tmp, target, amount);
        vec3.sub(newPos, tmp, tmp) as number[];
        this.translate(...tmp as [number, number, number]);
    }
}


export class ForwardingModelInstance implements IModelInstance {
    get transform(): Mat4 { return this._getTransform(); }
    private _getTransform: () => Mat4;
    constructor(public name: string, public asset: ModelAsset, getTransform: () => Mat4) {
        this._getTransform = getTransform;
    }
}