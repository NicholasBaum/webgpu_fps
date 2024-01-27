import { IModelInstance } from "./modelInstance";
import { mat4 } from "wgpu-matrix";


export class InstancesBufferWriter {

    constructor(public instances: ReadonlyArray<IModelInstance>) { }

    get length() { return this.instances.length; }

    get gpuBuffer(): GPUBuffer {
        if (!this._gpuBuffer)
            throw new Error("buffer wasn't initialized yet");
        return this._gpuBuffer;
    }

    private _gpuBuffer!: GPUBuffer;

    writeToGpu(device: GPUDevice) {

        if (!this._gpuBuffer) {
            this._gpuBuffer = device.createBuffer({
                label: "models uniforms buffer",
                //  [model_mat, normal_mat]
                size: this.instances.length * 64 * 2,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });
        }

        for (let i = 0; i < this.instances.length; i++) {
            let modelMatrix = this.instances[i].transform;
            let normalMatrix = mat4.transpose(mat4.invert(this.instances[i].transform));
            device.queue.writeBuffer(this._gpuBuffer, i * 128, modelMatrix as Float32Array);
            device.queue.writeBuffer(this._gpuBuffer, i * 128 + 64, normalMatrix as Float32Array);
        }
    }
}
