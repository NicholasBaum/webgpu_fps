import { vec3 } from "wgpu-matrix";
import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { ModelInstance } from "../core/modelInstance";
import { BASEPATH } from "../helper/htmlBuilder";
import { Scene } from "../core/scene";
import { createCube, createCylinder } from "../meshes/modelFactory";

export class ShadowMapScene extends Scene {

    constructor() {
        super();

        this.isAnimated = false;

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [-30, 50, 80], movementSpeed: 100, target: [0, 0, 0] })
        this.lights = [];
        this.lights.push(new Light({ type: LightType.Direct, direction: [-2, -1, 0] }));
        this.lights.push(new Light({ type: LightType.Direct, direction: [0, -1, 1] }));
        this.lights.push(new Light({ type: LightType.Point, position: [50, 16, 0] }));
        this.lights.forEach(x => {
            x.intensity = 1 / this.lights.length;
        });

        let mat1 = new BlinnPhongMaterial({ diffuseColor: [20, 20, 20, 1] });
        let floor = createCube(`Floor`, mat1)
            .translate(0, -1, 0)
            .scale(100, 1, 100);
        this.models.push(floor);

        let mat2 = new BlinnPhongMaterial({ diffuseColor: [235 / 255, 201 / 255, 52 / 255, 1] });
        let cube = createCube(`Cube01`, mat2)
            .rotate(0, 45, 0)
            .translate(0, 10, 0)
            .scale(10);

        this.models.push(cube);

        let mat3 = new BlinnPhongMaterial({ diffuseColor: [0, 0, 0.8, 1] });
        let cylinder = createCylinder(`Cylinder01`, mat3, 5, false)
            .translate(0, 10, -30)
            .scale(20 / 3);
        this.models.push(cylinder);

        let mat4 = new BlinnPhongMaterial({
            diffuseColor: [0.4, 0.6, 0.5, 1],
            normalMapPath: `../${BASEPATH}/assets/spiral_normal.png`,
        });

        let cube2 = createCube(`Cube01`, mat4)
            .rotate(0, 30, 0)
            .translate(25, 8, 0)
            .scale(8);
        this.models.push(cube2);

        let cube3 = createCube(`Cube01`, mat2)
            .translate(50, 7, 0)
            .scale(7);

        this.models.push(cube3);
    }

    public override update(deltaTime: number): void {
        if (!this.isAnimated)
            return;
        this.lights[0].direction = vec3.lerp(this.lights[0].direction, [0, -1, 2], deltaTime * 0.2);
    }
}