import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { BlinnPhongMaterial, RenderMode } from "../core/materials/blinnPhongMaterial";
import { ModelInstance } from "../core/modelInstance";
import { CREATE_CUBE, CREATE_SPHERE } from "../meshes/assetFactory";
import { UiScene } from "./uiScene";
import { EnvironmentMap } from "../core/environmentMap";
import { BASEPATH } from "../helper/htmlBuilder";


export class ReflectionMapScene extends UiScene {

    constructor() {
        super();

        this.isAnimated = false;

        const cubeMaps = [
            `../${BASEPATH}/assets/cubemap/posx.jpg`,
            `../${BASEPATH}/assets/cubemap/negx.jpg`,
            `../${BASEPATH}/assets/cubemap/posy.jpg`,
            `../${BASEPATH}/assets/cubemap/negy.jpg`,
            `../${BASEPATH}/assets/cubemap/posz.jpg`,
            `../${BASEPATH}/assets/cubemap/negz.jpg`,
        ];

        const skymap = [`../${BASEPATH}/assets/hdr/vestibule_8k.png`];        
        this.environmentMap = new EnvironmentMap(skymap);

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [-30, 50, 80], movementSpeed: 100, target: [0, 0, 0] })
        this.lights = [];
        this.lights.push(new Light({ type: LightType.Direct, direction: [-1, -1, 0], intensity: 0.7 }));
        this.lights.push(new Light({ type: LightType.Target, position: [50, 50, 0], target: [50, 30, 0], coneAngleDeg: 80 }));
        this.lights.forEach(x => {
            x.intensity /= this.lights.length;
        });

        let floor_asset = CREATE_CUBE(new BlinnPhongMaterial({ diffuseColor: [20, 20, 20, 1] }));
        let floor = new ModelInstance(`Floor`, floor_asset)
            .translate(0, -1, 0)
            .scale(100, 1, 100);
        this.models.push(floor);

        let sphere_asset = CREATE_SPHERE(128, true, new BlinnPhongMaterial({ diffuseColor: [1, 1, 0, 0], reflectivness: 0.2 }));
        let sphere = new ModelInstance("Sphere01", sphere_asset)
            .translate(0, 15, 0)
            .scaleBy(10);

        this.models.push(sphere);

        let cube_asset = CREATE_CUBE(new BlinnPhongMaterial({ diffuseColor: [235 / 255, 201 / 255, 52 / 255, 1], reflectivness: 0.71 }));
        let cube = new ModelInstance(`Cube01`, cube_asset)
            .rotate(0, 30, 0)
            .translate(25, 8, 0)
            .scaleBy(8);
        this.models.push(cube);
    }
}