import { createTextureFromImage } from "webgpu-utils";
import { Vec4 } from "wgpu-matrix";
import { createSolidColorTexture } from "../io";

export enum RenderMode {
    Default,
    SolidColor, // no lights
    VertexNormal,
    NormalMap,
}

export class BlinnPhongMaterial {

    mode: RenderMode = RenderMode.Default;
    ambientColor: Vec4 = [0.3, 0.3, 0.3, 1];
    diffuseColor: Vec4 = [0.3, 0.3, 0.3, 1];
    specularColor: Vec4 = [1, 1, 1, 1];
    shininess: number = 30;
    ambientMapPath: string | null = null;
    diffuseMapPath: string | null = null;
    specularMapPath: string | null = null;
    normalMapPath: string | null = null;
    disableNormalMap: boolean = false;

    private _gpuBuffer: GPUBuffer | null = null;
    get gpuBuffer(): GPUBuffer {
        if (!this._gpuBuffer)
            throw new Error("buffer wasn't initialized");
        return this._gpuBuffer;
    }

    private _ambientTexture: GPUTexture | null = null;
    get ambientTexture(): GPUTexture {
        if (!this._ambientTexture)
            throw new Error("ambient texture wasn't loaded");
        return this._ambientTexture;
    }

    private _diffuseTexture: GPUTexture | null = null;
    get diffuseTexture(): GPUTexture {
        if (!this._diffuseTexture)
            throw new Error("diffuse texture wasn't loaded");
        return this._diffuseTexture;
    }

    private _specularTexture: GPUTexture | null = null;
    get specularTexture(): GPUTexture {
        if (!this._specularTexture)
            throw new Error("specular texture wasn't loaded");
        return this._specularTexture;
    }

    private _normalTexture: GPUTexture | null = null;
    get normalTexture(): GPUTexture {
        if (!this._normalTexture)
            throw new Error("normal texture wasn't loaded");
        return this._normalTexture;
    }

    constructor(options?: {
        mode?: RenderMode,
        diffuseColor?: Vec4,
        specularColor?: Vec4
        shininess?: number,
        diffuseMapPath?: string,
        specularMapPath?: string,
        normalMapPath?: string,
        disableNormalMap?: boolean,
    }) {
        if (options) {
            this.mode = options.mode ?? this.mode;
            this.diffuseColor = options.diffuseColor ?? this.diffuseColor;
            this.ambientColor = this.diffuseColor;
            this.specularColor = options.specularColor ?? this.specularColor;
            this.shininess = options.shininess ?? this.shininess;
            this.diffuseMapPath = options.diffuseMapPath ?? this.diffuseMapPath;
            this.ambientMapPath = this.diffuseMapPath;
            this.specularMapPath = options.specularMapPath ?? this.specularMapPath;
            this.normalMapPath = options.normalMapPath ?? this.normalMapPath;
            this.disableNormalMap = options.disableNormalMap ?? this.disableNormalMap;
        }
    }

    static solidColor(color: Vec4) {
        return new BlinnPhongMaterial({ mode: RenderMode.SolidColor, diffuseColor: color });
    }

    private getBytes(): Float32Array {
        return new Float32Array([
            this.mode, this.disableNormalMap ? 1 : 0, 0, 0,
            ...this.ambientColor,
            ...this.specularColor,
            this.shininess, 0, 0, 0,
        ]);
    }

    writeToGpu(device: GPUDevice) {
        const bytes = this.getBytes();
        if (!this._gpuBuffer) {
            this._gpuBuffer = device.createBuffer({
                label: "material",
                size: Math.max(bytes.byteLength, 80),
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
        }
        device.queue.writeBuffer(this._gpuBuffer, 0, bytes);
    }

    async writeTexturesToGpuAsync(device: GPUDevice, useMipMaps: boolean) {
        if (this.ambientMapPath)
            this._ambientTexture = await createTextureFromImage(device, this.ambientMapPath, { mips: useMipMaps });
        else
            this._ambientTexture = createSolidColorTexture(device, this.ambientColor);

        if (this.diffuseMapPath)
            this._diffuseTexture = await createTextureFromImage(device, this.diffuseMapPath, { mips: useMipMaps });
        else
            this._diffuseTexture = createSolidColorTexture(device, this.diffuseColor);

        if (this.specularMapPath)
            this._specularTexture = await createTextureFromImage(device, this.specularMapPath, { mips: useMipMaps });
        else
            this._specularTexture = createSolidColorTexture(device, this.specularColor);

        if (this.normalMapPath)
            this._normalTexture = await createTextureFromImage(device, this.normalMapPath, { mips: useMipMaps });
        else
            this._normalTexture = createSolidColorTexture(device, [0, 0, 1, 1]);
    }
}