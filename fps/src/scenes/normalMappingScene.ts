import { Vec4 } from "wgpu-matrix";
import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { ModelInstance } from "../core/modelInstance";
import { BASEPATH } from "../helper/htmlBuilder";
import { Scene } from "../core/scene";
import { createCube, createCylinder } from "../meshes/modelFactory";

export class NormalMappingScene extends Scene {

    constructor() {
        super();

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [0, 10, 50], movementSpeed: 100, target: [0, 0, 0] })
        this.lights[0] = new Light({ type: LightType.Point, position: [-30, 5, 0] });
        this.lights[1] = new Light({ type: LightType.Point, position: [30, 5, 0] });;
        this.lights[2] = new Light({ type: LightType.Direct, direction: [-1, -1, -1] });
        this.lights.forEach(l => l.intensity = 0.4);

        let mat1 = new BlinnPhongMaterial({
            diffuseMapPath: `../${BASEPATH}/assets/Sci-fi_Metal_Plate_003_SD/basecolor.jpg`,
            normalMapPath: `../${BASEPATH}/assets/Sci-fi_Metal_Plate_003_SD/normal.jpg`,
        });

        let cube = createCube(`Cube01`, mat1)
            .translate(-30, 0, 0)
            .scale(10, 10, 10);
        this.models.push(cube);

        let mat2 = new BlinnPhongMaterial({
            diffuseMapPath: `../${BASEPATH}/assets/Sci-fi_Metal_Plate_003_SD/basecolor.jpg`,
            normalMapPath: `../${BASEPATH}/assets/Sci-fi_Metal_Plate_003_SD/normal.jpg`,
            tiling: { u: 2.25, v: 2 }
        });

        let cylinder = createCylinder(`Cube01`, mat2)
            .translate(30, 0, 0)
            .scale(10, 10 / (2.25 / 2), 10);
        this.models.push(cylinder);
    }

    private currentTime: number = 0;
    private startPositions: Vec4[] = [];
    public override update(deltaTime: number): void {
        if (!this.isAnimated)
            return;
        if (this.startPositions.length == 0) {
            this.lights.forEach(x => this.startPositions.push(x.position));
        }
        this.currentTime += deltaTime;
        for (let i = 0; i < this.lights.length - 1; i++) {
            this.lights[i].position = [this.startPositions[i][0] + 25 * Math.sin(this.currentTime),
            this.startPositions[i][1], this.startPositions[i][2] + 25 * Math.cos(this.currentTime)];
        }
    }
}