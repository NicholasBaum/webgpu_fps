import { Vec3, Vec4, mat4 } from "wgpu-matrix";
import { ModelInstance } from "./modelInstance";
import { BlinnPhongMaterial, RenderMode } from "./materials/blinnPhongMaterial";
import { CREATE_CUBE } from "../meshes/assetFactory";

export class DirectLight {

    private static _CUBEASSET = CREATE_CUBE(new BlinnPhongMaterial({ mode: RenderMode.SolidColor, diffuseColor: [1, 1, 1, 0] }));
    private _model: ModelInstance;
    get model(): ModelInstance { return this._model; }

    private _positionOrDirection: Vec3;
    get positionOrDirection(): Vec3 { return this._positionOrDirection; }
    set positionOrDirection(val: Vec3) {
        this._positionOrDirection = val;
        this._model.transform = mat4.uniformScale(mat4.translation([...this.positionOrDirection, 0], this._model.transform), 0.5, this._model.transform);
    }

    constructor(
        public type: number = 0,
        positionOrDirection: Vec3 = [0, 30, 0],
        public ambientColor: Vec4 = [0.2, 0.2, 0.2, 0],
        public diffuseColor: Vec4 = [0.5, 0.5, 0.5, 0],
        public specularColor: Vec4 = [0.8, 0.8, 0.8, 0],
    ) {
        this._positionOrDirection = positionOrDirection;
        this._model = new ModelInstance("light", DirectLight._CUBEASSET)
            // you can use spread to pass an arrays elements as parameters but typescript does also check the length
            // that's why we'll have to map it to this fixed length "thingy"
            .translate(...this.positionOrDirection as [number, number, number])
            .scale(0.5, 0.5, 0.5);
    }

    private _gpuBuffer: GPUBuffer | null = null;
    get gpuBuffer(): GPUBuffer {
        if (!this._gpuBuffer)
            throw new Error("buffer wasn't initialized yet");
        return this._gpuBuffer;
    }

    getBytes(): Float32Array {
        return new Float32Array(
            [
                this.type, 0, 0, 0,
                ...this.positionOrDirection, 0,
                ...this.ambientColor,
                ...this.diffuseColor,
                ...this.specularColor,
            ]
        )
    };

    get size() {
        return Math.max(this.getBytes().byteLength, 80)
    }

    writeToGpu(device: GPUDevice) {
        const bytes = this.getBytes();
        if (!this._gpuBuffer) {
            this._gpuBuffer = device.createBuffer({
                label: "direct light",
                size: Math.max(bytes.byteLength, 80),
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
        }
        device.queue.writeBuffer(this._gpuBuffer, 0, bytes);
    }
}

export class LightsArray {

    constructor(public items: DirectLight[]) { }

    private _gpuBuffer: GPUBuffer | null = null;
    get gpuBuffer(): GPUBuffer {
        if (!this._gpuBuffer)
            throw new Error("buffer wasn't initialized yet");
        return this._gpuBuffer;
    }

    writeToGpu(device: GPUDevice) {
        let size = this.items[0].size;
        if (!this._gpuBuffer) {
            this._gpuBuffer = device.createBuffer({
                label: "lights",
                size: Math.max(this.items.length * size, 80),
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });
        }
        for (let [i, l] of this.items.entries()) {
            device.queue.writeBuffer(this._gpuBuffer, i * size, l.getBytes());
        }
    }
}