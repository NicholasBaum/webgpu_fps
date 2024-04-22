import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { ModelInstance } from "../core/modelInstance";
import { CREATE_CUBE_w_NORMALS, CREATE_CYLINDER_w_NORMALS, CREATE_SPHERE_w_NORMALS } from "../meshes/assetFactory";
import { PbrMaterial, getPbrMaterial } from "../core/materials/pbrMaterial";
import { Scene } from "../core/scene";
import { BASEPATH } from "../helper/htmlBuilder";
import { EnvironmentMap } from "../core/environment/environmentMap";
import { Vec4 } from "wgpu-matrix";


export class PbrSamplesScene extends Scene {

    constructor() {
        super();

        this.isAnimated = false;

        this.environmentMap = new EnvironmentMap(`../${BASEPATH}/assets/hdr/brown_photostudio_02_2k.hdr`);

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [0, 100, 100], movementSpeed: 100, target: [0, 100, 0] })
        this.lights = [];

        let goldMat = getPbrMaterial(`../${BASEPATH}/assets/pbr/light-gold/`);
        let streakMetalMat = getPbrMaterial(`../${BASEPATH}/assets/pbr/streaked-metal1/`, true);
        let oxidizedCopperMat = getPbrMaterial(`../${BASEPATH}/assets/pbr/oxidized-copper/`);
        let stoneMat = getPbrMaterial(`../${BASEPATH}/assets/pbr/dirty-flat-stonework/`, true);
        let copperMat = getPbrMaterial(`../${BASEPATH}/assets/pbr/dull-copper/`, true);
        let goldScuffedMat = getPbrMaterial(`../${BASEPATH}/assets/pbr/gold-scuffed/`);
        let brassMat = getPbrMaterial(`../${BASEPATH}/assets/pbr/dull-brass/`, true);
        let woodfloor = getPbrMaterial(`../${BASEPATH}/assets/pbr/wood-floor/`, true, 'jpg');
        let metal_plate = getPbrMaterial(`../${BASEPATH}/assets/pbr/Sci-fi_Metal_Plate_003_SD/`, true, 'jpg');
        let metal_plate_cyl = getPbrMaterial(`../${BASEPATH}/assets/pbr/Sci-fi_Metal_Plate_003_SD/`, true, 'jpg');
        metal_plate_cyl.tiling = { u: 2.25, v: 2 };

        let intensity = 20000;
        let useFalloff = true;
        this.lights.push(new Light({ type: LightType.Direct, direction: [0, -1, 0], diffuseColor: [1, 1, 1, 1], intensity: 1, useFalloff: false }));
        this.lights.push(new Light({ type: LightType.Point, position: [0, 100, 100], diffuseColor: [1, 1, 1, 1], intensity, useFalloff }));
        this.lights.push(new Light({ type: LightType.Target, position: [0, 130, 0], direction: [0.5, -1, 0], diffuseColor: [1, 1, 1, 1], intensity: 1, useFalloff: useFalloff }));

        // this.lights.push(new Light({ type: LightType.Point, position: [100, 250, 100], diffuseColor: [1, 1, 1, 1], intensity, useFalloff }));
        // this.lights.push(new Light({ type: LightType.Point, position: [-100, 250, 100], diffuseColor: [1, 1, 1, 1], intensity, useFalloff }));
        // this.lights.push(new Light({ type: LightType.Point, position: [-100, 50, 100], diffuseColor: [1, 1, 1, 1], intensity, useFalloff }));
        // this.lights.push(new Light({ type: LightType.Point, position: [100, 50, 100], diffuseColor: [1, 1, 1, 1], intensity, useFalloff }));

        let floor_asset = CREATE_CUBE_w_NORMALS(woodfloor);
        let floor = new ModelInstance(`Floor`, floor_asset)
            .translate(0, -1, 0)
            .scale(100, 1, 100);
        this.models.push(floor);

        let back_asset = CREATE_CUBE_w_NORMALS(new PbrMaterial({ albedo: 0.1, metallic: 0.9, roughness: 0.1 }));
        let back = new ModelInstance(`Back`, back_asset)
            .translate(0, 98, -100)
            .scale(100, 100, 1);
        this.models.push(back);

        let i = -2;
        const gap = 25;
        const h = 100;
        let s1 = new ModelInstance("Sphere01", CREATE_CUBE_w_NORMALS(stoneMat))
            .translate(i++ * gap, h, 0)
            .scale(10);
        this.models.push(s1);

        let s2 = new ModelInstance("Sphere02", CREATE_SPHERE_w_NORMALS(128, true, streakMetalMat))
            .translate(i++ * gap, h, 0)
            .scale(10);
        this.models.push(s2);

        let s3 = new ModelInstance("Sphere03", CREATE_SPHERE_w_NORMALS(128, true, copperMat))
            .translate(i++ * gap, h, 0)
            .scale(10);
        this.models.push(s3);

        let s4 = new ModelInstance("Sphere04", CREATE_SPHERE_w_NORMALS(128, true, goldMat))
            .translate(i++ * gap, h, 0)
            .scale(10);
        this.models.push(s4);

        let s5 = new ModelInstance("Sphere04", CREATE_SPHERE_w_NORMALS(128, true, oxidizedCopperMat))
            .translate(i++ * gap, h, 0)
            .scale(10);
        this.models.push(s5);

        let cube_asset = CREATE_CUBE_w_NORMALS(metal_plate);
        let cube = new ModelInstance(`Cube01`, cube_asset)
            .translate(-25, 50, 0)
            .scale(10);
        this.models.push(cube);
        this.rotatingBoxLight = new Light({ type: LightType.Point, position: [-25, 50, 0], diffuseColor: [1, 0, 0, 1], intensity: 10, useFalloff: false });
        this.rotatingBoxLight.isOn = false;
        this.lights.push(this.rotatingBoxLight);

        let cylinder_asset = CREATE_CYLINDER_w_NORMALS(100, true, metal_plate_cyl);
        let cylinder = new ModelInstance(`Cylinder01`, cylinder_asset)
            .translate(25, 50, 0)
            .scale(10, 10 / (2.25 / 2), 10);
        this.models.push(cylinder);
        this.rotatingBoxLight2 = new Light({ type: LightType.Point, position: [25, 50, 0], diffuseColor: [0, 1, 1, 1], intensity: 10, useFalloff: false });
        this.rotatingBoxLight2.isOn = false;
        this.lights.push(this.rotatingBoxLight2);
    }

    private rotatingBoxLight;
    private rotatingBoxLight2;
    private currentTime: number = 0;
    private startPositions: Vec4[] = [];
    public override update(deltaTime: number): void {
        if (!this.isAnimated) {
            return;
        }

        if (this.startPositions.length == 0) {
            this.startPositions = this.lights.map(x => x.position);
            this.rotatingBoxLight.isOn = this.rotatingBoxLight2.isOn = true;
        }

        this.currentTime += deltaTime;
        for (let i = 0; i < this.lights.length; i++) {
            this.lights[i].position = [this.startPositions[i][0] + 25 * Math.sin(this.currentTime),
            this.startPositions[i][1], this.startPositions[i][2] + 25 * Math.cos(this.currentTime)];
        }
    }
}