import { Mat4, mat4 } from "wgpu-matrix";
import { ICamera } from "../camera/camera";
import { Light } from "../light";
import { EnvironmentMap } from "../environment/environmentMap";
import { BufferObjectBase } from "./bufferObjectBase";

export class CameraAndLightsBufferWriter extends BufferObjectBase {

    get device(): GPUDevice | null { return this.device }
    private _device: GPUDevice | undefined;
    override get buffer() {
        if (!this._buffer)
            throw new Error("buffer wasn't initialized yet");
        return this._buffer;
    }
    private _buffer: GPUBuffer | null = null;

    private viewProjectionMatrix: Mat4 = mat4.identity();
    private settings: Float32Array;

    constructor(private camera: ICamera, private lights: Light[], environmentMap?: EnvironmentMap) {
        super(`Scene Settings Buffer`)
        this.settings = new Float32Array(environmentMap ? [1, 0, 0, 0] : [0, 0, 0, 0]);
    }

    async buildAsync(device: GPUDevice): Promise<void> {
        if (this._device == device && this._buffer)
            this._device = device;
    }

    writeToGpu(device: GPUDevice) {
        let lightSize = this.lights[0]?.byteLength ?? 0;
        // camera_mat, camera_pos,
        const camSize = 64 + 16;
        const settingsSize = this.settings.byteLength;
        if (!this._buffer) {
            const bufferSize = camSize + settingsSize + this.lights.length * lightSize;
            this._buffer = device.createBuffer({
                label: "scene uniforms buffer",
                // camera_mat, camera_pos, settings, light[]
                size: Math.max(bufferSize, 256),
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });
        }

        mat4.multiply(this.camera.projectionMatrix, this.camera.view, this.viewProjectionMatrix);
        device.queue.writeBuffer(this._buffer, 0, this.viewProjectionMatrix as Float32Array);
        device.queue.writeBuffer(this._buffer, 64, this.camera.position as Float32Array);
        device.queue.writeBuffer(this._buffer, camSize, this.settings);
        for (let [i, l] of this.lights.entries()) {
            device.queue.writeBuffer(this._buffer, camSize + settingsSize + i * lightSize, l.getBytes());
        }
    }
}