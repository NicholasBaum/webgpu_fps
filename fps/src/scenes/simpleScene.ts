import { Vec4 } from "wgpu-matrix";
import { Scene } from "../core/scene";
import { ModelInstance } from "../core/modelInstance";
import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { CREATE_CUBE, CREATE_CYLINDER } from "../meshes/assetFactory";
import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { addCheckBox, createCheckBox, createContainer, createRow } from "../helper/htmlBuilder";

export class SimpleScene extends Scene {

    constructor(public isAnimated: boolean = true) {
        super();

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [0, 60, 10], movementSpeed: 100, target: [0, 40, 0] })
        this.lights[0] = new Light({ positionOrDirection: [0, 20, -25] });
        this.lights[1] = new Light({ type: LightType.Direct, positionOrDirection: [-1, -1, 0] });
        this.lights.forEach(l => l.intensity = 0.7);

        let cube_asset = CREATE_CUBE(new BlinnPhongMaterial({ diffuseColor: [0, 1, 0, 1], specularColor: [1, 0, 0, 1] }));
        let cylinder_asset = CREATE_CYLINDER(100, true, new BlinnPhongMaterial({ diffuseMapPath: '../assets/uv_dist.jpg', shininess: 50 }));
        let cylinder_asset2 = CREATE_CYLINDER(5, false, new BlinnPhongMaterial({ diffuseColor: [0, 0, 0.8, 1] }));

        let cube = new ModelInstance(`Cube01`, cube_asset)
            .translate(0, 0, -50)
            .rotate(0, 30, 0)
            .scale(10, 10, 10);
        this.models.push(cube);

        let cylinder = new ModelInstance(`Cylinder01`, cylinder_asset)
            .translate(20, 0, -20)
            .rotate(0, 0, 45)
            .scale(10, 10, 10);
        this.models.push(cylinder);

        let cylinder2 = new ModelInstance(`Cylinder02`, cylinder_asset2)
            .translate(-20, 0, -20)
            .scale(10, 10, 10);
        this.models.push(cylinder2);

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

    public override attachUi(canvas: HTMLCanvasElement): void {
        const ui = createContainer();
        const row = createRow();
        ui.appendChild(row);

        for (let [i, l] of this.lights.entries()) {
            addCheckBox(row, `${LightType[l.type]}Light_${i.toString().padStart(2, '0')}`, (checkbox) => {
                l.intensity = checkbox.checked ? 1 : 0;
            });
        }

        const row2 = createRow();
        ui.appendChild(row2);

        addCheckBox(row2, 'ambient', (checkbox) => {
            for (let l of this.lights.values())
                l.disableAmbientColor = !checkbox.checked;
        });

        addCheckBox(row2, 'diffuse', (checkbox) => {
            for (let l of this.lights.values())
                l.disableDiffuseColor = !checkbox.checked;
        });

        addCheckBox(row2, 'specular', (checkbox) => {
            for (let l of this.lights.values())
                l.disableSpecularColor = !checkbox.checked;
        });

        document.body.insertBefore(ui, canvas.nextSibling);
    }


}
