import { IModelInstance } from "../modelInstance";
import { mat4 } from "wgpu-matrix";
import { BufferObject } from "./bufferObject";


export class InstancesBuffer extends BufferObject {

    get length() { return this.instances.length; }
    get vertexBuffer() { return this.instances[0].vertexBuffer; }

    constructor(private instances: ReadonlyArray<IModelInstance>, label?: string) {
        if (instances.length < 0)
            throw new Error(`instances lenght can't be 0.`);
        const dataProvider = () => {
            let data: Float32Array[] = [];
            for (let i = 0; i < this.instances.length; i++) {
                let modelMatrix = this.instances[i].transform;
                let normalMatrix = mat4.transpose(mat4.invert(this.instances[i].transform));
                data.push(modelMatrix as Float32Array);
                data.push(normalMatrix as Float32Array);
            }
            return data;
        };

        super(dataProvider, GPUBufferUsage.STORAGE, label ?? `Models Instances Buffer`, instances.length * 64 * 2)
    }
}
