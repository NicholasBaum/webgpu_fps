import { createTextureFromImage } from "webgpu-utils";
import { Vec4 } from "wgpu-matrix";
import { createSolidColorTexture } from "../io";

export class BlinnPhongMaterial {

    mode: number = 0; // use textures, use constant values without lightning, use normals
    ambientColor: Vec4 = [0.3, 0.3, 0.3, 0];
    diffuseColor: Vec4 = [0.3, 0.3, 0.3, 0];
    specularColor: Vec4 = [1, 1, 1, 0];
    shininess: number = 30;
    diffuseMapPath: string | null = null;

    private _gpuBuffer: GPUBuffer | null = null;
    get gpuBuffer(): GPUBuffer {
        if (!this._gpuBuffer)
            throw new Error("buffer wasn't initialized yet");
        return this._gpuBuffer;
    }

    private _diffuseTexture: GPUTexture | null = null;
    get diffuseTexture(): GPUTexture {
        if (!this._diffuseTexture)
            throw new Error("diffuse texture wasn't loaded yet");
        return this._diffuseTexture;
    }

    constructor(options?: {
        mode?: number,
        ambientColor?: Vec4,
        diffuseColor?: Vec4,
        specularColor?: Vec4
        shininess?: number,
        diffuseMap?: string,
    }) {
        if (options) {
            this.mode = options.mode ?? this.mode;
            this.diffuseColor = options.diffuseColor ?? this.diffuseColor;
            this.ambientColor = options.ambientColor ?? this.diffuseColor;
            this.specularColor = options.specularColor ?? this.specularColor;
            this.shininess = options.shininess ?? this.shininess;
            this.diffuseMapPath = options.diffuseMap ?? this.diffuseMapPath;
        }
    }

    static flatColor(color: Vec4) {
        return new BlinnPhongMaterial({ mode: 1, diffuseColor: color });
    }

    private getBytes(): Float32Array {
        return new Float32Array([
            this.mode, 0, 0, 0,
            ...this.ambientColor,
            ...this.diffuseColor,
            ...this.specularColor,
            this.shininess, 0, 0, 0,
        ]);
    }

    writeToGpu(device: GPUDevice) {
        const bytes = this.getBytes();
        this._gpuBuffer = device.createBuffer({
            label: "material",
            size: Math.max(bytes.byteLength, 80),
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this._gpuBuffer, 0, bytes);
    }

    async writeTextureToGpuAsync(device: GPUDevice, useMipMaps: boolean) {
        if (this.diffuseMapPath)
            this._diffuseTexture = await createTextureFromImage(device, this.diffuseMapPath, { mips: useMipMaps });
        else
            this._diffuseTexture = createSolidColorTexture(device, this.diffuseColor);
    }
}