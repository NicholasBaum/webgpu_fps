import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { ModelInstance } from "../core/modelInstance";
import { BASEPATH, addCheckBox, createRow } from "../helper/htmlBuilder";
import { CREATE_CUBE, CREATE_CUBE_w_NORMALS, CREATE_CYLINDER_w_NORMALS } from "../meshes/assetFactory";
import { UiScene } from "./uiScene";

export class ShadowMapScene extends UiScene {

    constructor() {
        super();

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [0, 10, 50], movementSpeed: 100, target: [0, 0, 0] })
        this.lights[0] = new Light({ type: LightType.Point, positionOrDirection: [100, 50, 0] });
        // before using a direct light i have to figure out how to handle the position of a direct light        

        let floor_asset = CREATE_CUBE(new BlinnPhongMaterial({ diffuseColor: [20, 20, 20, 1] }));
        let floor = new ModelInstance(`Floor`, floor_asset)
            .translate(0, -1, 0)
            .scale(100, 1, 100);
        this.models.push(floor);

        let cube_asset = CREATE_CUBE(new BlinnPhongMaterial({ diffuseColor: [235 / 255, 201 / 255, 52 / 255, 1] }));
        let cube = new ModelInstance(`Cube01`, cube_asset)
            .rotate(0, 45, 0)
            .translate(0, 10, 0)
            .scale(10, 10, 10);

        this.models.push(cube);
    }
}