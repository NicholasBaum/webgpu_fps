import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { ModelInstance } from "../core/modelInstance";
import { CREATE_CUBE_w_NORMALS, CREATE_CYLINDER_w_NORMALS, CREATE_SPHERE_w_NORMALS } from "../meshes/assetFactory";
import { PbrMaterial, getPbrMaterial } from "../core/materials/pbrMaterial";
import { Scene } from "../core/scene";
import { BASEPATH } from "../helper/htmlBuilder";
import { EnvironmentMap } from "../core/environment/environmentMap";


export class PbrSamplesScene extends Scene {

    constructor() {
        super();

        let envmap = `../${BASEPATH}/assets/hdr/brown_photostudio_02_1k.png`;
        //envmap = `../${BASEPATH}/assets/hdr/vestibule_1k.png`
        this.environmentMap = new EnvironmentMap(envmap);

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
        this.lights.push(new Light({ type: LightType.Point, position: [100, 250, 100], diffuseColor: [1, 1, 1, 1], intensity, useFalloff }));
        this.lights.push(new Light({ type: LightType.Point, position: [-100, 250, 100], diffuseColor: [1, 1, 1, 1], intensity, useFalloff }));
        this.lights.push(new Light({ type: LightType.Point, position: [-100, 50, 100], diffuseColor: [1, 1, 1, 1], intensity, useFalloff }));
        this.lights.push(new Light({ type: LightType.Point, position: [100, 50, 100], diffuseColor: [1, 1, 1, 1], intensity, useFalloff }));

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
        let s1 = new ModelInstance("Sphere01", CREATE_SPHERE_w_NORMALS(128, true, stoneMat))
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
            .scale(10, 10, 10);
        this.models.push(cube);

        let cylinder_asset = CREATE_CYLINDER_w_NORMALS(100, true, metal_plate_cyl);
        let cylinder = new ModelInstance(`Cylinder01`, cylinder_asset)
            .translate(25, 50, 0)
            .scale(10, 10 / (2.25 / 2), 10);
        this.models.push(cylinder);
    }
}