import { Vec4 } from "wgpu-matrix";
import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { ModelInstance } from "../core/modelInstance";
import { BASEPATH } from "../helper/htmlBuilder";
import { CREATE_CUBE_w_NORMALS, CREATE_CYLINDER_w_NORMALS } from "../meshes/assetFactory";
import { Scene } from "../core/scene";
import { PbrMaterial } from "../core/materials/pbrMaterial";
import { EnvironmentMap } from "../core/environment/environmentMap";

export class NormalMappingDebugScene extends Scene {

    constructor() {
        super();

        // positive Z-Axis is pointing towards you
        let envmap: string[] | string = [
            `../${BASEPATH}/assets/white.png`, // x
            `../${BASEPATH}/assets/white.png`, // -x
            `../${BASEPATH}/assets/white.png`, // y            
            `../${BASEPATH}/assets/white.png`, // -y
            `../${BASEPATH}/assets/white.png`, // z           
            `../${BASEPATH}/assets/blue.png`, // -z
        ];

        //envmap = `../${BASEPATH}/assets/hdr/brown_photostudio_02_1k.png`;
        //envmap = `../${BASEPATH}/assets/hdr/test.avif`;
        envmap = `../${BASEPATH}/assets/hdr/brown_photostudio_02_8k.hdr`;
        //envmap = `../${BASEPATH}/assets/hdr/brown_photostudio_02_1k_12bit.avif`;
        this.environmentMap = new EnvironmentMap(envmap);
        this.lights = [];
        this.camera = new WASDCamera({ position: [0, 10, 50], movementSpeed: 100, target: [0, 0, 0] })
        //this.lights[0] = new Light({ type: LightType.Direct, direction: [0, 1, 0], intensity: 0.4 });

        let normalMap = `../${BASEPATH}/assets/normal.png`;
        let mat = new BlinnPhongMaterial({
            diffuseColor: [1, 1, 1, 1],
            normalMapPath: normalMap
        });
        let pmat = new PbrMaterial({
            albedo: 1,
            metallic: 0.1,
            roughness: 0.1,
            normalMapPath: normalMap
        });

        let cube_asset = CREATE_CUBE_w_NORMALS(pmat);
        this.models.push(new ModelInstance(`Cube01`, cube_asset).translate(-30, 0, 0).scale(10));
        let cube_asset2 = CREATE_CUBE_w_NORMALS(mat);
        this.models.push(new ModelInstance(`Cube02`, cube_asset2).translate(30, 0, 0).scale(10));
    }
}