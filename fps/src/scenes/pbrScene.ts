import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { BlinnPhongMaterial, RenderMode } from "../core/materials/blinnPhongMaterial";
import { ModelInstance } from "../core/modelInstance";
import { CREATE_CUBE, CREATE_SPHERE } from "../meshes/assetFactory";
import { UiScene } from "./uiScene";
import { EnvironmentMap } from "../core/environmentMap";
import { BASEPATH } from "../helper/htmlBuilder";
import { PbrMaterial } from "../core/materials/pbrMaterial";


export class PbrScene extends UiScene {

    constructor() {
        super();

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [-30, 50, 80], movementSpeed: 100, target: [0, 0, 0] })
        this.lights = [];
        this.lights.push(new Light({ type: LightType.Direct, direction: [-1, -1, 0], intensity: 0.7 }));

        let floor_asset = CREATE_CUBE(new BlinnPhongMaterial({ diffuseColor: [20, 20, 20, 1] }));
        let floor = new ModelInstance(`Floor`, floor_asset)
            .translate(0, -1, 0)
            .scale(100, 1, 100);
        this.models.push(floor);

        let sphere_asset = CREATE_SPHERE(128, true, new PbrMaterial({ albedo: [1, 1, 0, 0] }));
        let sphere = new ModelInstance("Sphere01", sphere_asset)
            .translate(0, 15, 0)
            .scaleBy(10);

        this.models.push(sphere);
    }
}