import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { BlinnPhongMaterial, RenderMode } from "../core/materials/blinnPhongMaterial";
import { Scene } from "../core/scene";
import { createSphere } from "../meshes/modelFactory";


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

        let mat1 = new BlinnPhongMaterial({ diffuseColor: [20, 20, 20, 1] });
        let floor = createSphere(`Floor`, mat1)
            .translate(0, -1, 0)
            .scale(100, 1, 100);
        this.models.push(floor);

        //let sphere_asset = createSphere(8);
        let mat2 = new BlinnPhongMaterial({ mode: RenderMode.Default, diffuseColor: [1, 1, 0, 0] });
        let sphere = createSphere("Sphere01", mat2)
            .translate(0, 15, 0)
            .scale(10);

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