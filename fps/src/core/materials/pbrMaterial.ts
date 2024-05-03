import { Vec4 } from "wgpu-matrix";
import { createTexture } from "../../helper/io";
import { BlinnPhongMaterial } from "./blinnPhongMaterial";
import { BufferObjectBase } from "../primitives/bufferObjectBase";

export type Material = BlinnPhongMaterial | PbrMaterial;

export class PbrMaterial extends BufferObjectBase {

    get hasNormalMap() { return !!this.normalMapPath }

    ambientOcclussion: number | Vec4 | string = 1;
    albedo: number | Vec4 | string = 0.3;
    metal: number | Vec4 | string = 0.1;
    roughness: number | Vec4 | string = 0.3;

    normalMapPath: string | null = null;

    tiling: { u: number, v: number } = { u: 1, v: 1 };
    disableNormalMap: boolean = false;

    constructor(options?: {
        ambientOcclussion?: number | Vec4 | string,
        albedo?: number | Vec4 | string,
        metal?: number | Vec4 | string,
        roughness?: number | Vec4 | string,
        normalMapPath?: string,
        tiling?: { u: number, v: number },
        disableNormalMap?: boolean,
    }) {
        super("Pbr Shader Buffer");
        if (options) {
            this.ambientOcclussion = options.ambientOcclussion ?? this.ambientOcclussion;
            this.albedo = options.albedo ?? this.albedo;
            this.metal = options.metal ?? this.metal;
            this.roughness = options.roughness ?? this.roughness;
            this.normalMapPath = options.normalMapPath ?? this.normalMapPath;
            this.tiling = options.tiling ?? this.tiling;
            this.disableNormalMap = options.disableNormalMap ?? this.disableNormalMap;
        }
    }

    private _albedoTexture: GPUTexture | null = null;
    get albedoTexture(): GPUTexture {
        if (!this._albedoTexture)
            throw new Error("albedo texture wasn't loaded");
        return this._albedoTexture;
    }

    private _ambientOcclussionTexture: GPUTexture | null = null;
    get ambientOcclussionTexture(): GPUTexture {
        if (!this._ambientOcclussionTexture)
            throw new Error("ambient occlussion texture wasn't loaded");
        return this._ambientOcclussionTexture;
    }

    private _metalTexture: GPUTexture | null = null;
    get metalTexture(): GPUTexture {
        if (!this._metalTexture)
            throw new Error("specular texture wasn't loaded");
        return this._metalTexture;
    }

    private _roughnessTexture: GPUTexture | null = null;
    get roughnessTexture(): GPUTexture {
        if (!this._roughnessTexture)
            throw new Error("normal texture wasn't loaded");
        return this._roughnessTexture;
    }

    private _normalTexture: GPUTexture | null = null;
    get normalTexture(): GPUTexture {
        if (!this._normalTexture)
            throw new Error("normal texture wasn't loaded");
        return this._normalTexture;
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
            0, this.disableNormalMap ? 1 : 0, this.tiling.u, this.tiling.v,
        ]);
    }

    writeToGpu(device: GPUDevice) {
        this._device = device;
        const bytes = this.getFloatArray();
        if (!this._buffer) {
            this._buffer = device.createBuffer({
                label: "pbr material",
                size: Math.max(bytes.byteLength, 80),
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
        }
        device.queue.writeBuffer(this._buffer, 0, bytes);
    }

    async writeTexturesToGpuAsync(device: GPUDevice, useMipMaps: boolean) {
        if (this._ambientOcclussionTexture && this._device == device) {
            console.log("texture maps are already loaded.");
            return;
        }
        this._device = device;
        // the pbr render pipeline requires textures in linear space
        // rgba8unorm tranforms 0-255 to [0,1] floats
        // texture assumed in srgb (=gamma encoded), using will convert it to linear space when loaded
        // (and back to linear space when written to)
        const srgb = 'rgba8unorm-srgb';
        // texture assumed in linear space 
        const linear = 'rgba8unorm';

        const ambientOcclusionPromise = createTexture(device, this.ambientOcclussion, useMipMaps, linear);
        const albedoPromise = createTexture(device, this.albedo, useMipMaps, srgb);
        const metalPromise = createTexture(device, this.metal, useMipMaps, linear);
        const roughnessPromise = createTexture(device, this.roughness, useMipMaps, linear);
        const normalPromise = createTexture(device, this.normalMapPath ? this.normalMapPath : [0, 0, 1, 1], useMipMaps, linear);

        [this._ambientOcclussionTexture, this._albedoTexture, this._metalTexture, this._roughnessTexture, this._normalTexture]
            = await Promise.all([
                ambientOcclusionPromise,
                albedoPromise,
                metalPromise,
                roughnessPromise,
                normalPromise
            ]);
    }
}


export function getPbrMaterial(folderPath: string, hasAo: boolean = false, fileType: 'png' | 'jpg' = 'png') {
    return new PbrMaterial({
        ambientOcclussion: hasAo ? folderPath + `ao.${fileType}` : 1,
        albedo: folderPath + `albedo.${fileType}`,
        metal: folderPath + `metallic.${fileType}`,
        roughness: folderPath + `roughness.${fileType}`,
        normalMapPath: folderPath + `normal.${fileType}`
    });;
}