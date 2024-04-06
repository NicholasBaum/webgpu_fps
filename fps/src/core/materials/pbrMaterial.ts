import { Vec4 } from "wgpu-matrix";
import { createTexture } from "../../helper/io";
import { BlinnPhongMaterial } from "./blinnPhongMaterial";

export type Material = BlinnPhongMaterial | PbrMaterial;

export class PbrMaterial {

    ambientOcclussion: number | Vec4 | string = 1;
    albedo: number | Vec4 | string = 0.3;
    metallic: number | Vec4 | string = 0.1;
    roughness: number | Vec4 | string = 0.3;

    normalMapPath: string | null = null;

    tiling: { u: number, v: number } = { u: 1, v: 1 };
    disableNormalMap: boolean = false;

    constructor(options?: {
        ambientOcclussion?: number | Vec4 | string,
        albedo?: number | Vec4 | string,
        metallic?: number | Vec4 | string,
        roughness?: number | Vec4 | string,
        normalMapPath?: string,
        tiling?: { u: number, v: number },
        disableNormalMap?: boolean,
    }) {
        if (options) {
            this.ambientOcclussion = options.ambientOcclussion ?? this.ambientOcclussion;
            this.albedo = options.albedo ?? this.albedo;
            this.metallic = options.metallic ?? this.metallic;
            this.roughness = options.roughness ?? this.roughness;
            this.normalMapPath = options.normalMapPath ?? this.normalMapPath;
            this.tiling = options.tiling ?? this.tiling;
            this.disableNormalMap = options.disableNormalMap ?? this.disableNormalMap;
        }
    }

    private _gpuBuffer: GPUBuffer | null = null;
    get gpuBuffer(): GPUBuffer {
        if (!this._gpuBuffer)
            throw new Error("buffer wasn't initialized");
        return this._gpuBuffer;
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

    private getBytes(): Float32Array {
        return new Float32Array([
            0, this.disableNormalMap ? 1 : 0, this.tiling.u, this.tiling.v,
        ]);
    }

    writeToGpu(device: GPUDevice) {
        const bytes = this.getBytes();
        if (!this._gpuBuffer) {
            this._gpuBuffer = device.createBuffer({
                label: "pbr material",
                size: Math.max(bytes.byteLength, 80),
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
        }
        device.queue.writeBuffer(this._gpuBuffer, 0, bytes);
    }

    async writeTexturesToGpuAsync(device: GPUDevice, useMipMaps: boolean) {
        // loading them in this format converts them to linear space for the shader
        // if written to this format a srgb transform will be applied
        const format = 'rgba8unorm-srgb';
        this._ambientOcclussionTexture = await createTexture(device, this.ambientOcclussion, useMipMaps);
        this._albedoTexture = await createTexture(device, this.albedo, useMipMaps, format);
        this._metalTexture = await createTexture(device, this.metallic, useMipMaps, format);
        this._roughnessTexture = await createTexture(device, this.roughness, useMipMaps, format);
        this._normalTexture = await createTexture(device, this.normalMapPath ? this.normalMapPath : [0, 0, 1, 1], useMipMaps, format);
    }
}