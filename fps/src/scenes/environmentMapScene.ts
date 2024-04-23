import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { EnvironmentMap } from "../core/environment/environmentMap";
import { BASEPATH } from "../helper/htmlBuilder";
import { Scene } from "../core/scene";
import { createCube, createSphere } from "../meshes/modelFactory";


export class EnvironmentMapScene extends Scene {

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

        const skymap = [`../${BASEPATH}/assets/hdr/vestibule_1k.png`];
        this.environmentMap = new EnvironmentMap(skymap);

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [-30, 50, 80], movementSpeed: 100, target: [0, 0, 0] })
        this.lights = [];
        this.lights.push(new Light({ type: LightType.Direct, direction: [-1, -1, 0], intensity: 0.7 }));
        this.lights.push(new Light({ type: LightType.Target, position: [50, 50, 0], target: [50, 30, 0], coneAngleDeg: 80 }));
        this.lights.forEach(x => {
            x.intensity /= this.lights.length;
        });

        let mat1 = new BlinnPhongMaterial({ diffuseColor: [20, 20, 20, 1] });
        let floor = createCube(`Floor`, mat1)
            .translate(0, -1, 0)
            .scale(100, 1, 100);
        this.models.push(floor);

        let mat2 = new BlinnPhongMaterial({ diffuseColor: [1, 1, 0, 0], reflectivness: 0.2 });
        let sphere = createSphere("Sphere01", mat2)
            .translate(0, 15, 0)
            .scale(10);

        this.models.push(sphere);

        let mat3 = new BlinnPhongMaterial({ diffuseColor: [235 / 255, 201 / 255, 52 / 255, 1], reflectivness: 0.71 });
        let cube = createCube(`Cube01`, mat3)
            .rotate(0, 30, 0)
            .translate(25, 8, 0)
            .scale(8);
        this.models.push(cube);
    }
}