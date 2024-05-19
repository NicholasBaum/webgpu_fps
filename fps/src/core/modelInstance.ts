import { Mat4, Vec3, mat4, vec3 } from "wgpu-matrix";
import { BoundingBox, transformBoundingBox } from "./primitives/boundingBox";
import { VertexBufferObject } from "./primitives/vertexBufferObject";
import { Material } from "./materials/pbrMaterial";

export interface IModelInstance {
    get name(): string;
    get vertexBuffer(): VertexBufferObject;
    get material(): Material;
    get normalBuffer(): VertexBufferObject | undefined;
    get transform(): Mat4;
}

type TransformProvider = () => Mat4;

export class ModelInstance implements IModelInstance {

    get hasNormals(): boolean { return this.normalBuffer != undefined }

    get transform() { return this._transform; }
    private _transform: Mat4 = mat4.identity();

    constructor(
        public name: string,
        public readonly vertexBuffer: VertexBufferObject,
        public readonly material: Material,
        private readonly boundingBox: BoundingBox,
        public readonly normalBuffer: VertexBufferObject | undefined = undefined,
        transform: Mat4 = mat4.identity()
    ) {
        this._transform = transform;
    }

    getBoundingBox() {
        return transformBoundingBox(this.boundingBox, this._transform);
    }

    translate(x: number, y: number, z: number): ModelInstance {
        mat4.translate(this._transform, [x, y, z], this._transform)
        return this;
    }

    rotateDeg(x: number, y: number, z: number): ModelInstance {
        mat4.rotateX(this._transform, x / 180 * Math.PI, this._transform);
        mat4.rotateY(this._transform, y / 180 * Math.PI, this._transform);
        mat4.rotateZ(this._transform, z / 180 * Math.PI, this._transform);
        return this;
    }

    scale(x: number): ModelInstance
    scale(x: number, y: number, z: number): ModelInstance
    scale(x: number, y?: number, z?: number): ModelInstance {
        {
            if (!y || !z)
                z = y = x;
            mat4.scale(this._transform, [x, y, z], this._transform)
            return this;
        }
    }

    get position(): Vec3 { return [...this._transform].slice(12, 15) }

    lerp(target: Vec3, amount: number) {
        // Todo: terrible implementation
        let tmp = this.position;
        const newPos = vec3.lerp(tmp, target, amount);
        vec3.sub(newPos, tmp, tmp) as number[];
        this.translate(...tmp as [number, number, number]);
    }
}

export class Transformable extends ModelInstance {

    override get transform() { return this.transformProvider(); }
    private transformProvider: TransformProvider;

    constructor(
        name: string,
        vertexBuffer: VertexBufferObject,
        material: Material,
        boundingBox: BoundingBox,
        normalBuffer: VertexBufferObject | undefined = undefined,
        transformProvider: TransformProvider
    ) {
        super(name, vertexBuffer, material, boundingBox, normalBuffer);
        this.transformProvider = transformProvider;
    }
}