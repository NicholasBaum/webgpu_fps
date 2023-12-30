import { Mat4, mat4 } from "wgpu-matrix";
import { Camera } from "./camera/camera";
import { ModelInstance } from "./MmodelInstance";

export class MeshRendererUniforms {

    private viewProjectionMatrix: Mat4 = mat4.identity();
    
    private _gpuBuffer: GPUBuffer | null = null;
    get gpuBuffer(): GPUBuffer {
        if (!this._gpuBuffer)
            throw new Error("buffer wasn't initialized yet");
        return this._gpuBuffer;
    }

    constructor(private camera: Camera, private models: ModelInstance[]) {

    }

    writeToGpu(device: GPUDevice) {
        
        if (!this._gpuBuffer) {
            this._gpuBuffer = device.createBuffer({
                label: "scene uniforms buffer",
                // camera_mat, camera_pos, [model_mat, normal_mat]
                size: 64 + 16 + this.models.length * 64 * 2,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });
        }

        mat4.multiply(this.camera.projectionMatrix, this.camera.view, this.viewProjectionMatrix);
        device.queue.writeBuffer(this._gpuBuffer, 0, this.viewProjectionMatrix as Float32Array);
        device.queue.writeBuffer(this._gpuBuffer, 64, this.camera.position as Float32Array);
        for (let i = 0; i < this.models.length; i++) {
            let modelMatrix = this.models[i].transform;
            let normalMatrix = mat4.transpose(mat4.invert(this.models[i].transform));
            device.queue.writeBuffer(this._gpuBuffer, 64 + 16 + i * 128, modelMatrix as Float32Array);
            device.queue.writeBuffer(this._gpuBuffer, 64 + 16 + i * 128 + 64, normalMatrix as Float32Array);
        }
    }
}