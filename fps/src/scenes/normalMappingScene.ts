import { Vec4 } from "wgpu-matrix";
import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { BlinnPhongMaterial, RenderMode } from "../core/materials/blinnPhongMaterial";
import { ModelInstance } from "../core/modelInstance";
import { BASEPATH, addCheckBox, createRow } from "../helper/htmlBuilder";
import { CREATE_CUBE, CREATE_CUBE_w_NORAMLS } from "../meshes/assetFactory";
import { UiScene } from "./uiScene";

export class NormalMappingScene extends UiScene {

    constructor() {
        super();

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [0, 10, 50], movementSpeed: 100, target: [0, 0, 0] })
        this.lights[0] = new Light({ positionOrDirection: [0, 5, 0] });
        this.lights[1] = new Light({ type: LightType.Direct, positionOrDirection: [-1, -1, -1] });
        this.lights.forEach(l => l.intensity = 0.7);

        let cube_asset = CREATE_CUBE_w_NORAMLS(new BlinnPhongMaterial({
            diffuseMapPath: `../${BASEPATH}/assets/Sci-fi_Metal_Plate_003_SD/basecolor.jpg`,
            normalMapPath: `../${BASEPATH}/assets/Sci-fi_Metal_Plate_003_SD/normal.jpg`,
        }));

        let cube = new ModelInstance(`Cube01`, cube_asset)
            .scale(10, 10, 10);
        this.models.push(cube);
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