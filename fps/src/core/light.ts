import { Vec3, Vec4, mat4 } from "wgpu-matrix";
import { ModelInstance } from "./modelInstance";
import { ModelAsset } from "./modelAsset";
import { CUBE_TOPOLOGY, CUBE_VERTEX_ARRAY, CUBE_VERTEX_BUFFER_LAYOUT, CUBE_VERTEX_COUNT } from "../meshes/cube_mesh";

import light_shader from '../shaders/directlight_shader.wgsl'
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";

export class DirectLight {

    constructor(
        public type: number = 0,
        public positionOrDirection: Vec3 = [0, 30, 0],
        public color: Vec4 = [0.5, 0.5, 0.5],
        public ambientColor: Vec4 = [1, 1, 1, 0],
        public ambientFactor: number = 1,
        public diffuseFactor: number = 1,
        public spectralFactor: number = 1,
    ) { }

    private _gpuBuffer: GPUBuffer | null = null;
    get gpuBuffer(): GPUBuffer {
        if (!this._gpuBuffer)
            throw new Error("buffer wasn't initialized yet");
        return this._gpuBuffer;
    }

    private getBytes(): Float32Array {
        return new Float32Array(
            [
                this.type, 0, 0, 0,
                ...this.positionOrDirection, 0,
                ...this.color,
                ...this.ambientColor,
                ...[this.ambientFactor, this.diffuseFactor, this.spectralFactor, 0],
            ]
        )
    };

    writeToGpu(device: GPUDevice) {
        const bytes = this.getBytes();
        this._gpuBuffer = device.createBuffer({
            label: "lights",
            size: Math.max(bytes.byteLength, 80),
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this._gpuBuffer, 0, bytes);
    }

    getModel(): ModelInstance {
        let cube_asset = new ModelAsset(
            "cube_asset_01",
            CUBE_VERTEX_ARRAY,
            CUBE_VERTEX_COUNT,
            { label: "Direct Light Shader", code: light_shader },
            CUBE_VERTEX_BUFFER_LAYOUT,
            CUBE_TOPOLOGY,
            '../assets/uv_dist.jpg',
            BlinnPhongMaterial.flatColor([1, 1, 1, 0]),
        );
        return new ModelInstance("light", cube_asset, mat4.uniformScale(mat4.translation([...this.positionOrDirection, 0]), 0.5));
    }
}