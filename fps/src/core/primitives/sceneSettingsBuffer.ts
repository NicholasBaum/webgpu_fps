import { Mat4, mat4 } from "wgpu-matrix";
import { ICamera } from "../camera/camera";
import { Light } from "../light";
import { EnvironmentMap } from "../environment/environmentMap";
import { BufferObject } from "./bufferObject";

export class SceneSettingsBuffer extends BufferObject {

    private viewProjectionMatrix: Mat4 = mat4.identity();

    constructor(private camera: ICamera, private lights: Light[], private showEnvironment: boolean) {
        const dataProvider = () => {
            let data: Float32Array[] = [];
            mat4.multiply(this.camera.projectionMatrix, this.camera.view, this.viewProjectionMatrix);
            data.push(this.viewProjectionMatrix as Float32Array);
            data.push(this.camera.position as Float32Array);
            data.push(new Float32Array(this.showEnvironment ? [1, 0, 0, 0] : [0, 0, 0, 0]));
            data.push(...this.lights.map(x => x.getBytes()))
            return data;
        };
        super(dataProvider, GPUBufferUsage.STORAGE, `Scene Settings Buffer`)
    }
}