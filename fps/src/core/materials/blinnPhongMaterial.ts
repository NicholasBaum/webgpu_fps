import { createTextureFromImage } from "webgpu-utils";
import { Vec4 } from "wgpu-matrix";
import { createSolidColorTexture } from "../../helper/io";
import { BufferObjectBase } from "../primitives/bufferObjectBase";

export enum RenderMode {
    Default,
    SolidColor, // no lights
    VertexNormal,
}

export class BlinnPhongMaterial extends BufferObjectBase {

    get hasNormalMap() { return !!this.normalMapPath }

    mode: RenderMode = RenderMode.Default;
    reflectivness: number = 0.0;
    tiling: { u: number, v: number } = { u: 1, v: 1 };
    ambientColor: Vec4 = [0.3, 0.3, 0.3, 1];
    diffuseColor: Vec4 = [0.3, 0.3, 0.3, 1];
    specularColor: Vec4 = [1, 1, 1, 1];
    shininess: number = 30;
    ambientMapPath: string | null = null;
    diffuseMapPath: string | null = null;
    specularMapPath: string | null = null;
    normalMapPath: string | null = null;
    disableNormalMap: boolean = false;

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
        reflectivness?: number,
        diffuseColor?: Vec4,
        specularColor?: Vec4
        shininess?: number,
        diffuseMapPath?: string,
        specularMapPath?: string,
        normalMapPath?: string,
        tiling?: { u: number, v: number },
        disableNormalMap?: boolean,
    }) {
        super('Blinn Phong Material Buffer');
        if (options) {
            this.mode = options.mode ?? this.mode;
            this.reflectivness = options.reflectivness ?? this.reflectivness;
            this.diffuseColor = options.diffuseColor ?? this.diffuseColor;
            this.ambientColor = this.diffuseColor;
            this.specularColor = options.specularColor ?? this.specularColor;
            this.shininess = options.shininess ?? this.shininess;
            this.diffuseMapPath = options.diffuseMapPath ?? this.diffuseMapPath;
            this.ambientMapPath = this.diffuseMapPath;
            this.specularMapPath = options.specularMapPath ?? this.specularMapPath;
            this.normalMapPath = options.normalMapPath ?? this.normalMapPath;
            this.tiling = options.tiling ?? this.tiling;
            this.disableNormalMap = options.disableNormalMap ?? this.disableNormalMap;
        }
    }

    static solidColor(color: Vec4) {
        return new BlinnPhongMaterial({ mode: RenderMode.SolidColor, diffuseColor: color });
    }

    get device(): GPUDevice | undefined {
        return this._device;
    }
    private _device: GPUDevice | undefined;

    private _buffer: GPUBuffer | null = null;
    get buffer(): GPUBuffer {
        if (!this._buffer)
            throw new Error("buffer wasn't initialized");
        return this._buffer;
    }

    private getFloatArray(): Float32Array {
        return new Float32Array([
            this.mode, this.disableNormalMap ? 1 : 0, this.tiling.u, this.tiling.v,
            ...this.ambientColor,
            ...this.specularColor,
            this.shininess, this.reflectivness, 0, 0,
        ]);
    }

    writeToGpu(device: GPUDevice) {
        this._device = device;
        const bytes = this.getFloatArray();
        if (!this._buffer) {
            this._buffer = device.createBuffer({
                label: "material",
                size: Math.max(bytes.byteLength, 80),
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
        }
        device.queue.writeBuffer(this._buffer, 0, bytes);
    }

    async writeTexturesToGpuAsync(device: GPUDevice, useMipMaps: boolean) {
        if (this._ambientTexture && this._device == device) {
            console.log("texture maps are already loaded.");
            return;
        }
        this._device = device;

        const ambientPromise = this.ambientMapPath ?
            createTextureFromImage(device, this.ambientMapPath, { mips: useMipMaps }) :
            Promise.resolve(createSolidColorTexture(device, this.ambientColor));

        const diffusePromise = this.diffuseMapPath ?
            createTextureFromImage(device, this.diffuseMapPath, { mips: useMipMaps }) :
            Promise.resolve(createSolidColorTexture(device, this.diffuseColor));

        const specularPromise = this.specularMapPath ?
            createTextureFromImage(device, this.specularMapPath, { mips: useMipMaps }) :
            Promise.resolve(createSolidColorTexture(device, this.specularColor));

        const normalPromise = this.normalMapPath ?
            createTextureFromImage(device, this.normalMapPath, { mips: useMipMaps }) :
            Promise.resolve(createSolidColorTexture(device, [0, 0, 1, 1]));

        [this._ambientTexture, this._diffuseTexture, this._specularTexture, this._normalTexture] =
            await Promise.all([
                ambientPromise,
                diffusePromise,
                specularPromise,
                normalPromise
            ]);
    }
}