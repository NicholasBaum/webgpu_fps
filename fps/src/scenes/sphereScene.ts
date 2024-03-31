import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { BlinnPhongMaterial, RenderMode } from "../core/materials/blinnPhongMaterial";
import { ModelInstance } from "../core/modelInstance";
import { CREATE_CUBE, CREATE_SPHERE } from "../meshes/assetFactory";
import { Scene } from "../core/scene";


export class SphereScene extends Scene {

    constructor() {
        super();

        this.isAnimated = false;

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [-30, 50, 80], movementSpeed: 100, target: [0, 0, 0] })
        this.lights = [];
        this.lights.push(new Light({ type: LightType.Target, position: [50, 50, 0], target: [50, 30, 0], coneAngleDeg: 80 }));
        this.lights.push(new Light({ type: LightType.Target, position: [-50, 30, -180], target: [-50, 0, 0], coneAngleDeg: 40 }));
        this.lights.push(new Light({ type: LightType.Direct, direction: [1, -1, 0] }));
        this.lights.forEach(x => {
            x.intensity = 1 / this.lights.length;
        });

        let floor_asset = CREATE_CUBE(new BlinnPhongMaterial({ diffuseColor: [20, 20, 20, 1] }));
        let floor = new ModelInstance(`Floor`, floor_asset)
            .translate(0, -1, 0)
            .scale(100, 1, 100);
        this.models.push(floor);

        //let sphere_asset = createSphere(8);
        let sphere_asset = CREATE_SPHERE(128, true, new BlinnPhongMaterial({ mode: RenderMode.Default, diffuseColor: [1, 1, 0, 0] }));
        let sphere = new ModelInstance("Sphere01", sphere_asset)
            .translate(0, 15, 0)
            .scaleBy(10);

        this.models.push(sphere);
    }

    start = [0, 15, 0];
    throttle = 0;
    public override update(deltaTime: number): void {
        if (!this.isAnimated)
            return;
        this.models[1].lerp([80, 15, 0], deltaTime * 0.05);
    }
}