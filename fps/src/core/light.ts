import { Vec3, Vec4, mat4 } from "wgpu-matrix";
import { ModelInstance } from "./modelInstance";
import { BlinnPhongMaterial } from "./materials/blinnPhongMaterial";
import { CREATE_CUBE } from "../meshes/assetFactory";

export class DirectLight {

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
        let cube_asset = CREATE_CUBE(new BlinnPhongMaterial({ diffuseColor: [1, 1, 1, 0] }));
        cube_asset.material = BlinnPhongMaterial.flatColor([1, 1, 1, 0]);
        this._model = new ModelInstance("light", cube_asset)
            // you can use spread to pass the elements as parameters but typescript does some array length checks
            .translate(...this.positionOrDirection as [number, number, number])
            .scale(0.5, 0.5, 0.5);
    }

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
                ...this.ambientColor,
                ...this.diffuseColor,
                ...this.specularColor,
            ]
        )
    };

    writeToGpu(device: GPUDevice) {
        const bytes = this.getBytes();
        if (!this._gpuBuffer) {
            this._gpuBuffer = device.createBuffer({
                label: "lights",
                size: Math.max(bytes.byteLength, 80),
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
        }
        device.queue.writeBuffer(this._gpuBuffer, 0, bytes);
    }
}