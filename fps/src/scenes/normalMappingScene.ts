import { Vec4 } from "wgpu-matrix";
import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { ModelInstance } from "../core/modelInstance";
import { BASEPATH, addCheckBox, createRow } from "../helper/htmlBuilder";
import { CREATE_CUBE, CREATE_CUBE_w_NORMALS, CREATE_CYLINDER_w_NORMALS } from "../meshes/assetFactory";
import { UiScene } from "./uiScene";

export class NormalMappingScene extends UiScene {

    constructor() {
        super();

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [0, 10, 50], movementSpeed: 100, target: [0, 0, 0] })
        this.lights[0] = new Light({ type: LightType.Point, positionOrDirection: [-30, 5, 0] });
        this.lights[1] = new Light({ type: LightType.Point, positionOrDirection: [30, 5, 0] });;
        this.lights[2] = new Light({ type: LightType.Direct, positionOrDirection: [-1, -1, -1] });
        this.lights.forEach(l => l.intensity = 0.4);

        let cube_asset = CREATE_CUBE_w_NORMALS(new BlinnPhongMaterial({
            diffuseMapPath: `../${BASEPATH}/assets/Sci-fi_Metal_Plate_003_SD/basecolor.jpg`,
            normalMapPath: `../${BASEPATH}/assets/Sci-fi_Metal_Plate_003_SD/normal.jpg`,
        }));

        let cube = new ModelInstance(`Cube01`, cube_asset)
            .translate(-30, 0, 0)
            .scale(10, 10, 10);
        this.models.push(cube);

        let cylinder_asset = CREATE_CYLINDER_w_NORMALS(100, true, new BlinnPhongMaterial({
            diffuseMapPath: `../${BASEPATH}/assets/Sci-fi_Metal_Plate_003_SD/basecolor.jpg`,
            normalMapPath: `../${BASEPATH}/assets/Sci-fi_Metal_Plate_003_SD/normal.jpg`,
            tiling: { u: 2.25, v: 2 }
        }));

        let cylinder = new ModelInstance(`Cube01`, cylinder_asset)
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
            this.lights.forEach(x => this.startPositions.push(x.positionOrDirection));
        }
        this.currentTime += deltaTime;
        for (let i = 0; i < this.lights.length - 1; i++) {
            this.lights[i].positionOrDirection = [this.startPositions[i][0] + 25 * Math.sin(this.currentTime),
            this.startPositions[i][1], this.startPositions[i][2] + 25 * Math.cos(this.currentTime)];
        }
    }

    public override attachUi(canvas: HTMLCanvasElement): void {
        super.attachUi(canvas);

        const row = createRow();
        this.uiContainer.appendChild(row);

        addCheckBox(row, 'normal_mapping', (checkbox) => {
            for (let m of this.models)
                m.asset.material.disableNormalMap = !checkbox.checked;
        });
    }
}