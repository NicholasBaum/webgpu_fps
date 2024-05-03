import { WASDCamera } from "../core/camera/wasdCamera";
import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { BASEPATH } from "../helper/htmlBuilder";
import { Scene } from "../core/scene";
import { PbrMaterial } from "../core/materials/pbrMaterial";
import { EnvironmentMap } from "../core/environment/environmentMap";
import { createCube } from "../meshes/modelFactory";

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
        envmap = `../${BASEPATH}/assets/hdr/brown_photostudio_02_1k.hdr`;
        //envmap = `../${BASEPATH}/assets/hdr/brown_photostudio_02_8k.hdr`;
        
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
            metal: 0.1,
            roughness: 0.1,
            normalMapPath: normalMap
        });

        this.models.push(createCube(`Cube01`, pmat).translate(-30, 0, 0).scale(10));
        this.models.push(createCube(`Cube02`, mat).translate(30, 0, 0).scale(10));
    }
}