import { Mat4, Vec3, mat4, vec3 } from "wgpu-matrix";
import { BoundingBox, transformBoundingBox } from "./primitives/boundingBox";
import { VertexBufferObject } from "./primitives/gpuMemoryObject";
import { Material } from "./materials/pbrMaterial";

export class ModelInstance {

    get hasNormals(): boolean { return this.normalBuffer != undefined }

    constructor(
        public name: string,
        public readonly vertexBuffer: VertexBufferObject,
        public readonly material: Material,
        private readonly boundingBox: BoundingBox,
        public readonly normalBuffer?: VertexBufferObject,
        public transform: Mat4 = mat4.identity()
    ) {

    }

    getBoundingBox() {
        return transformBoundingBox(this.boundingBox, this.transform);
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

    scale(x: number): ModelInstance
    scale(x: number, y: number, z: number): ModelInstance
    scale(x: number, y?: number, z?: number): ModelInstance {
        {
            if (!y || !z)
                z = y = x;
            mat4.scale(this.transform, [x, y, z], this.transform)
            return this;
        }
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