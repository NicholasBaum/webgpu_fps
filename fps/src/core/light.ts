import { Vec3, Vec4, mat4, vec3, vec4 } from "wgpu-matrix";
import { ShadowMap } from "./shadows/shadowMap";

export enum LightType {
    Direct,
    Point,
    Target,
}

export class Light {

    public isOn = true;
    public intensity: number = 1;
    public type: LightType = LightType.Point;
    public ambientColor: Vec4 = [0.2, 0.2, 0.2, 1];
    public diffuseColor: Vec4 = [1, 1, 1, 1];
    public specularColor: Vec4 = [0.8, 0.8, 0.8, 1];

    public disableAmbientColor = false;
    public disableDiffuseColor = false;
    public disableSpecularColor = false;
    public useFalloff = false;
    public coneAngleDeg: number = 72;

    public get position() { return this._position; }
    public set position(val: Vec3) {
        this._position = val;
        if (this.type == LightType.Target)
            this._direction = vec3.subtract(this._target, this._position);
    }
    private _position: Vec3 = [0, 30, 0];

    public get direction(): Vec3 { return this._direction; }
    public set direction(value: Vec3) {
        this._direction = value;
        if (this.type == LightType.Target)
            this._target = vec3.add(this._position, this._direction);
        else if (this.type == LightType.Direct) {
            this._position = vec3.mulScalar(vec3.normalize(this._direction), -100);
        }
    }
    private _direction: Vec3 = [0, -1, 0];

    public get target(): Vec3 { return this._target; }
    public set target(value: Vec3) {
        this._target = value;
        if (this.type == LightType.Target)
            this._direction = vec3.sub(this._target, this.position);
    }
    private _target: Vec3 = [0, 0, 0];

    constructor(options?: {
        type?: LightType,
        position?: Vec3,
        direction?: Vec3,
        target?: Vec3,
        ambientColor?: Vec4,
        diffuseColor?: Vec4,
        specularColor?: Vec4,
        intensity?: number,
        useFalloff?: boolean,
        useShadowMap?: boolean,
        coneAngleDeg?: number,
    }
    ) {
        if (options) {
            this.type = options.type ?? this.type;
            this._position = options.position ?? this._position;
            this._direction = options.direction ?? this._direction;
            this._target = options.target ?? this._target;
            this.ambientColor = options.ambientColor ?? this.ambientColor;
            this.diffuseColor = options.diffuseColor ?? this.diffuseColor;
            this.specularColor = options.specularColor ?? this.specularColor;
            this.intensity = options.intensity ?? this.intensity;
            this.useFalloff = options.useFalloff ?? this.useFalloff;
            this._useShadowMap = options.useShadowMap ?? true;
            this.coneAngleDeg = options.coneAngleDeg ?? this.coneAngleDeg;

            switch (this.type) {
                case LightType.Direct:
                    // updates position
                    this.direction = this.direction;
                    break;
                case LightType.Target:
                    // if set favor target over direction
                    if (!options.target && options.direction) {
                        // updates target
                        this.direction = this.direction;
                    }
                    else {
                        // updates direction
                        this.target = this.target;
                    }
                    break;
            }
        }
    }

    get byteLength() {
        return Math.max(this.getBytes().byteLength, 80)
    }

    getBytes(): Float32Array {
        return new Float32Array(
            [
                this.type, this.useFalloff ? 1 : 0, this.shadowMap && this.showShadows ? this.shadowMap.id : -1, Math.cos(this.coneAngleDeg / 360 * Math.PI),// half angle
                ...this._position, 0,
                ...this._direction, 0,
                ...this.disableAmbientColor || !this.isOn ? [0, 0, 0, 1] : vec4.mulScalar(this.ambientColor, this.intensity),
                ...this.disableDiffuseColor || !this.isOn ? [0, 0, 0, 1] : vec4.mulScalar(this.diffuseColor, this.intensity),
                ...this.disableSpecularColor || !this.isOn ? [0, 0, 0, 1] : vec4.mulScalar(this.specularColor, this.intensity),
                ...this.shadowMap ? this.shadowMap.light_mat : this.dummy
            ]
        )
    };

    public showShadows = true;
    public get useShadowMap() { return this.type != LightType.Point && this._useShadowMap; }
    private _useShadowMap = true;
    public shadowMap?: ShadowMap;
    private dummy = mat4.create();
}