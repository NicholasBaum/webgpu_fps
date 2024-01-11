import { Vec4 } from "wgpu-matrix";
import { ModelInstance } from "../core/modelInstance";
import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { CREATE_CUBE, CREATE_CYLINDER } from "../meshes/assetFactory";
import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { BASEPATH } from "../helper/htmlBuilder";
import { UiScene } from "./uiScene";

export class SimpleScene extends UiScene {

    constructor(public isAnimated: boolean = true) {
        super();

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [0, 60, 10], movementSpeed: 100, target: [0, 40, 0] })
        this.lights[0] = new Light({ type: LightType.Point, positionOrDirection: [0, 20, -25] });
        this.lights[1] = new Light({ type: LightType.Direct, positionOrDirection: [-1, -1, 0] });
        this.lights.forEach(l => l.intensity = 0.7);

        let cube_asset = CREATE_CUBE(new BlinnPhongMaterial({ diffuseColor: [0, 1, 0, 1], specularColor: [1, 0, 0, 1] }));
        let cylinder_asset = CREATE_CYLINDER(100, true, new BlinnPhongMaterial({ diffuseMapPath: `../${BASEPATH}/assets/uv_dist.jpg`, shininess: 50 }));
        let cylinder_asset2 = CREATE_CYLINDER(5, false, new BlinnPhongMaterial({ diffuseColor: [0, 0, 0.8, 1] }));

        let cube = new ModelInstance(`Cube01`, cube_asset)
            .translate(0, 0, -50)
            .rotate(0, 30, 0)
            .scale(10, 10, 10);
        this.models.push(cube);

        let floor = new ModelInstance(`Floor`, cube_asset)
            .translate(0, -25, 0)
            .scale(100, 1, 100);
        this.models.push(floor);

        let cylinder = new ModelInstance(`Cylinder01`, cylinder_asset)
            .translate(20, 0, -20)
            .rotate(0, 0, 45)
            .scale(10, 10, 10);
        this.models.push(cylinder);

        let cylinder2 = new ModelInstance(`Cylinder02`, cylinder_asset2)
            .translate(-20, 0, -20)
            .scale(10, 10, 10);
        this.models.push(cylinder2);
    }

    private currentTime: number = 0;
    private centerPos!: Vec4;
    public override update(deltaTime: number): void {
        if (!this.isAnimated)
            return;
        this.centerPos = this.centerPos ?? this.lights[0].positionOrDirection;
        this.currentTime += deltaTime;
        this.lights[0].positionOrDirection = [this.centerPos[0] + 25 * Math.sin(this.currentTime),
        this.centerPos[1], this.centerPos[2] + 25 * Math.cos(this.currentTime)];
    }
}