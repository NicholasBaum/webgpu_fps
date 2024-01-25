import { vec2, vec3 } from "wgpu-matrix";
import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { ModelInstance } from "../core/modelInstance";
import { BASEPATH } from "../helper/htmlBuilder";
import { CREATE_CUBE, CREATE_CUBE_w_NORMALS, CREATE_CYLINDER, CREATE_CYLINDER_w_NORMALS } from "../meshes/assetFactory";
import { UiScene } from "./uiScene";
import { lerp } from "wgpu-matrix/dist/2.x/vec2-impl";

export class TargetLightScene extends UiScene {

    constructor() {
        super();

        this.isAnimated = true;

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [-30, 50, 80], movementSpeed: 100, target: [0, 0, 0] })
        this.lights = [];
        this.lights.push(new Light({ type: LightType.Target, position: [50, 50, 0], target: [50, 30, 0], coneAngleDeg: 80 }));
        this.lights.push(new Light({ type: LightType.Target, position: [-50, 30, -180], target: [-50, 0, 0], coneAngleDeg: 40 }));
        this.lights.forEach(x => {
            x.intensity = 1 / this.lights.length;
        });

        let floor_asset = CREATE_CUBE(new BlinnPhongMaterial({ diffuseColor: [20, 20, 20, 1] }));
        let floor = new ModelInstance(`Floor`, floor_asset)
            .translate(0, -1, 0)
            .scale(100, 1, 100);
        this.models.push(floor);

        let cube_asset = CREATE_CUBE(new BlinnPhongMaterial({ diffuseColor: [235 / 255, 201 / 255, 52 / 255, 1] }));
        let cube = new ModelInstance(`Cube01`, cube_asset)
            .rotate(0, 45, 0)
            .translate(-50, 10, 0)
            .scaleBy(10);

        this.models.push(cube);

        let cylinder_asset = CREATE_CYLINDER(5, false, new BlinnPhongMaterial({ diffuseColor: [0, 0, 0.8, 1] }));
        let cylinder = new ModelInstance(`Cylinder01`, cylinder_asset)
            .translate(-50, 10, -30)
            .scaleBy(20 / 3);
        this.models.push(cylinder);

        let cube_asset2 = CREATE_CUBE_w_NORMALS(new BlinnPhongMaterial({
            diffuseColor: [0.4, 0.6, 0.5, 1],
            normalMapPath: `../${BASEPATH}/assets/spiral_normal.png`,
        }));

        let cube2 = new ModelInstance(`Cube01`, cube_asset2)
            .rotate(0, 30, 0)
            .translate(25, 8, 0)
            .scaleBy(8);
        this.models.push(cube2);

        let cube3 = new ModelInstance(`Cube01`, cube_asset)
            .translate(50, 7, 0)
            .scaleBy(7);

        this.models.push(cube3);
    }

    public override update(deltaTime: number): void {
        if (!this.isAnimated)
            return;
        this.lights[0].position = vec3.lerp(this.lights[0].position, [50, 40, -70], deltaTime * 0.2);
        this.lights[1].coneAngleDeg = vec2.lerp(vec2.fromValues(this.lights[1].coneAngleDeg, 0), vec2.fromValues(20, 0), deltaTime * 0.1)[0];
    }
}