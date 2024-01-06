import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { ModelInstance } from "../core/modelInstance";
import { Scene } from "../core/scene";
import { BASEPATH } from "../helper/htmlBuilder";
import { CREATE_CUBE, CREATE_CYLINDER } from "../meshes/assetFactory";

export class NormalMappingScene extends Scene {
    constructor() {
        super();

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [0, 0, 50], movementSpeed: 100, target: [0, 0, 0] })
        this.lights[0] = new Light({ positionOrDirection: [0, 20, -25] });
        this.lights[1] = new Light({ type: LightType.Direct, positionOrDirection: [-1, -1, 0] });
        this.lights.forEach(l => l.intensity = 0.7);

        let cube_asset = CREATE_CUBE(new BlinnPhongMaterial({ diffuseMapPath: `../${BASEPATH}/assets/Sci-fi_Metal_Plate_003_SD/basecolor.jpg` }));

        let cube = new ModelInstance(`Cube01`, cube_asset)
            .scale(10, 10, 10);
        this.models.push(cube);


        this.lights.forEach(l => {
            this.models.push(l.model);
        });
    }
}