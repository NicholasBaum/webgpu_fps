import { Mat4, Vec3, Vec4, mat4, vec3, vec4 } from "wgpu-matrix";
import { ModelInstance } from "./modelInstance";
import { BlinnPhongMaterial, RenderMode } from "./materials/blinnPhongMaterial";
import { CREATE_CUBE, CREATE_CUBE_w_NORMALS } from "../meshes/assetFactory";
import { ShadowMap } from "./renderers/shadowMapRenderer";

export enum LightType {
    Direct,
    Point,
}

export class Light {

    private static _CUBEASSET = CREATE_CUBE(new BlinnPhongMaterial({ mode: RenderMode.SolidColor, diffuseColor: [1, 1, 1, 0] }));
    private _model: ModelInstance = new ModelInstance("light", Light._CUBEASSET);
    get model(): ModelInstance { return this._model; }

    public intensity: number = 1;
    public type: LightType = LightType.Point;
    public ambientColor: Vec4 = [0.2, 0.2, 0.2, 0];
    public diffuseColor: Vec4 = [0.5, 0.5, 0.5, 0];
    public specularColor: Vec4 = [0.8, 0.8, 0.8, 0];

    public disableAmbientColor = false;
    public disableDiffuseColor = false;
    public disableSpecularColor = false;
    public useFalloff = false;

    private _positionOrDirection: Vec3 = [0, 30, 0];
    get positionOrDirection(): Vec3 { return this._positionOrDirection; }
    set positionOrDirection(val: Vec3) {
        this._positionOrDirection = val;
        let modelPos = this.type == LightType.Point ? this._positionOrDirection : vec3.mulScalar(vec3.normalize(this._positionOrDirection), -100);
        this._model.transform = mat4.uniformScale(mat4.translation([...modelPos, 0], this._model.transform), 0.5, this._model.transform);
    }

    constructor(options?: {
        type?: LightType,
        positionOrDirection?: Vec3,
        ambientColor?: Vec4,
        diffuseColor?: Vec4,
        specularColor?: Vec4,
        intensity?: number,
        useFalloff?: boolean,
        renderShadowMap?: boolean,
    }
    ) {
        this._model = new ModelInstance("light", Light._CUBEASSET)
            // you can use spread to pass an arrays elements as parameters but typescript does also check the length
            // that's why we'll have to map it to this fixed length "thingy"
            .translate(...this.positionOrDirection as [number, number, number])
            .scale(0.5, 0.5, 0.5);
        if (options) {
            this.type = options.type ?? this.type;
            this.positionOrDirection = options.positionOrDirection ?? this.positionOrDirection;
            this.ambientColor = options.ambientColor ?? this.ambientColor;
            this.diffuseColor = options.diffuseColor ?? this.diffuseColor;
            this.specularColor = options.specularColor ?? this.specularColor;
            this.intensity = options.intensity ?? this.intensity;
            this.useFalloff = options.useFalloff ?? this.useFalloff;
            this._renderShadowMap = options.renderShadowMap ?? true;
        }

        // force model transform update
        this.positionOrDirection = this._positionOrDirection;
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
                this.type, this.useFalloff ? 1 : 0, this.shadowMap && this.showShadows ? this.shadowMap.id : -1, 0,
                ...this.positionOrDirection, 0,
                ...this.disableAmbientColor ? [0, 0, 0, 1] : vec4.mulScalar(this.ambientColor, this.intensity),
                ...this.disableDiffuseColor ? [0, 0, 0, 1] : vec4.mulScalar(this.diffuseColor, this.intensity),
                ...this.disableSpecularColor ? [0, 0, 0, 1] : vec4.mulScalar(this.specularColor, this.intensity),
                ...this.shadowMap ? this.shadowMap.light_mat : this.dummy
            ]
        )
    };

    public showShadows = true;
    public get renderShadowMap() { return this.type != LightType.Point && this._renderShadowMap; }
    private _renderShadowMap = true;
    public shadowMap?: ShadowMap;
    private dummy = mat4.create();

    get byteLength() {
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