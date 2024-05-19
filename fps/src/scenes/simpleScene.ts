import { Vec4 } from "wgpu-matrix";
import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { BASEPATH } from "../helper/htmlBuilder";
import { Scene } from "../core/scene";
import { createCube, createCylinder } from "../meshes/modelFactory";

export class SimpleScene extends Scene {

    constructor(public isAnimated: boolean = true) {
        super();

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [0, 60, 10], movementSpeed: 100, target: [0, 40, 0] })
        this.lights[0] = new Light({ type: LightType.Point, position: [0, 20, -25], useShadowMap: false });
        this.lights[1] = new Light({ type: LightType.Direct, direction: [-1, -1, 0], useShadowMap: false });
        this.lights.forEach(l => l.intensity = 0.7);

        let mat1 = new BlinnPhongMaterial({ diffuseColor: [0, 1, 0, 1], specularColor: [1, 0, 0, 1] });
        let mat2 = new BlinnPhongMaterial({ diffuseMapPath: `../${BASEPATH}/assets/uv_dist.jpg`, shininess: 50 });
        let mat3 = new BlinnPhongMaterial({ diffuseColor: [0, 0, 0.8, 1] });

        let cube = createCube(`Cube01`, mat1)
            .translate(0, 0, -50)
            .rotateDeg(0, 30, 0)
            .scale(10, 10, 10);
        this.models.push(cube);

        let floor = createCube(`Floor`, mat1)
            .translate(0, -25, 0)
            .scale(100, 1, 100);
        this.models.push(floor);

        let cylinder = createCylinder(`Cylinder01`, mat2)
            .translate(20, 0, -20)
            .rotateDeg(0, 0, 45)
            .scale(10, 10, 10);
        this.models.push(cylinder);

        let cylinder2 = createCylinder(`Cylinder02`, mat3, 5, false)
            .translate(-20, 0, -20)
            .scale(10, 10, 10);
        this.models.push(cylinder2);
    }

    private currentTime: number = 0;
    private centerPos!: Vec4;
    public override update(deltaTime: number): void {
        if (!this.isAnimated)
            return;
        this.centerPos = this.centerPos ?? this.lights[0].position;
        this.currentTime += deltaTime;
        this.lights[0].position = [this.centerPos[0] + 25 * Math.sin(this.currentTime),
        this.centerPos[1], this.centerPos[2] + 25 * Math.cos(this.currentTime)];
    }
}