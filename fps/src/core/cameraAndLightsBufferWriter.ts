import { Mat4, mat4 } from "wgpu-matrix";
import { Camera } from "./camera/camera";
import { Light } from "./light";

export class CameraAndLightsBufferWriter {

    private viewProjectionMatrix: Mat4 = mat4.identity();

    constructor(private camera: Camera, private lights: Light[]) {

    }

    private _gpuBuffer: GPUBuffer | null = null;

    get gpuBuffer(): GPUBuffer {
        if (!this._gpuBuffer)
            throw new Error("buffer wasn't initialized yet");
        return this._gpuBuffer;
    }   

    writeToGpu(device: GPUDevice) {
        let size = this.lights[0].byteLength;
        // camera_mat, camera_pos, 
        const camSize = 64 + 16;
        if (!this._gpuBuffer) {
            this._gpuBuffer = device.createBuffer({
                label: "scene uniforms buffer",
                // camera_mat, camera_pos, [model_mat, normal_mat]
                size: camSize + this.lights.length * size,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });
        }

        mat4.multiply(this.camera.projectionMatrix, this.camera.view, this.viewProjectionMatrix);
        device.queue.writeBuffer(this._gpuBuffer, 0, this.viewProjectionMatrix as Float32Array);
        device.queue.writeBuffer(this._gpuBuffer, 64, this.camera.position as Float32Array);
        for (let [i, l] of this.lights.entries()) {
            device.queue.writeBuffer(this._gpuBuffer, camSize + i * size, l.getBytes());
        }
    }
}