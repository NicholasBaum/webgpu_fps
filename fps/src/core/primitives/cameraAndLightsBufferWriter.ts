import { Mat4, Vec4, mat4 } from "wgpu-matrix";
import { ICamera } from "../camera/camera";
import { Light } from "../light";
import { EnvironmentMap } from "../environment/environmentMap";

export class CameraAndLightsBufferWriter {

    private viewProjectionMatrix: Mat4 = mat4.identity();
    private settings: Float32Array;
    constructor(private camera: ICamera, private lights: Light[], private environmentMap?: EnvironmentMap) {
        this.settings = new Float32Array(environmentMap ? [1, 0, 0, 0] : [0, 0, 0, 0]);
    }

    private _gpuBuffer: GPUBuffer | null = null;

    get gpuBuffer(): GPUBuffer {
        if (!this._gpuBuffer)
            throw new Error("buffer wasn't initialized yet");
        return this._gpuBuffer;
    }

    writeToGpu(device: GPUDevice) {
        let lightSize = this.lights[0]?.byteLength ?? 0;
        // camera_mat, camera_pos,
        const camSize = 64 + 16;
        const settingsSize = this.settings.byteLength;
        if (!this._gpuBuffer) {
            const bufferSize = camSize + settingsSize + this.lights.length * lightSize;
            this._gpuBuffer = device.createBuffer({
                label: "scene uniforms buffer",
                // camera_mat, camera_pos, settings, light[]
                size: Math.max(bufferSize, 256),
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });
        }

        mat4.multiply(this.camera.projectionMatrix, this.camera.view, this.viewProjectionMatrix);
        device.queue.writeBuffer(this._gpuBuffer, 0, this.viewProjectionMatrix as Float32Array);
        device.queue.writeBuffer(this._gpuBuffer, 64, this.camera.position as Float32Array);
        device.queue.writeBuffer(this._gpuBuffer, camSize, this.settings);
        for (let [i, l] of this.lights.entries()) {
            device.queue.writeBuffer(this._gpuBuffer, camSize + settingsSize + i * lightSize, l.getBytes());
        }
    }
}