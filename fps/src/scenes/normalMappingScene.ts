import { Vec4 } from "wgpu-matrix";
import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { ModelInstance } from "../core/modelInstance";
import { BASEPATH } from "../helper/htmlBuilder";
import { CREATE_CUBE } from "../meshes/assetFactory";
import { UiScene } from "./uiScene";

export class NormalMappingScene extends UiScene {
  
    constructor() {
        super();

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [0, 10, 50], movementSpeed: 100, target: [0, 0, 0] })
        this.lights[0] = new Light({ positionOrDirection: [0, 5, 0] });
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