import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { ModelInstance } from "../core/modelInstance";
import { BASEPATH } from "../helper/htmlBuilder";
import { CREATE_CUBE, CREATE_CUBE_w_NORMALS, CREATE_CYLINDER, CREATE_CYLINDER_w_NORMALS } from "../meshes/assetFactory";
import { UiScene } from "./uiScene";

export class ShadowMapScene extends UiScene {

    constructor() {
        super();

        this.isAnimated = false;

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [0, 10, 50], movementSpeed: 100, target: [0, 0, 0] })
        this.lights[0] = new Light({ type: LightType.Direct, positionOrDirection: [-2, -1, 0] });
        this.lights[1] = new Light({ type: LightType.Direct, positionOrDirection: [0, -1, 1] });
        this.lights.forEach(x => {
            //x.useShadowMap = false;
            x.intensity = 0.5;
        });

        let floor_asset = CREATE_CUBE(new BlinnPhongMaterial({ diffuseColor: [20, 20, 20, 1] }));
        let floor = new ModelInstance(`Floor`, floor_asset)
            .translate(0, -1, 0)
            .scale(100, 1, 100);
        this.models.push(floor);

        let cube_asset = CREATE_CUBE(new BlinnPhongMaterial({ diffuseColor: [235 / 255, 201 / 255, 52 / 255, 1] }));
        let cube = new ModelInstance(`Cube01`, cube_asset)
            .rotate(0, 45, 0)
            .translate(0, 10, 0)
            .scaleBy(10);

        this.models.push(cube);

        let cylinder_asset = CREATE_CYLINDER(5, false, new BlinnPhongMaterial({ diffuseColor: [0, 0, 0.8, 1] }));
        let cylinder = new ModelInstance(`Cylinder01`, cylinder_asset)
            .translate(0, 10, -30)
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

    private currentTime: number = 0;
    private dist = 0;
    private dir = 2;
    public override update(deltaTime: number): void {
        if (!this.isAnimated)
            return;
        this.currentTime += deltaTime;
        if (Math.abs(this.dist) > 5)
            this.dir *= -1;
        let d = deltaTime * this.dir;
        this.dist += d;

        this.models[1].translate(d, 0, 0);
        this.models[2].translate(0, d, 0);
        this.models[3].translate(0, 0, d);
    }
}