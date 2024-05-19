import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { PbrMaterial } from "../core/materials/pbrMaterial";
import { Scene } from "../core/scene";
import { BASEPATH } from "../helper/htmlBuilder";
import { EnvironmentMap } from "../core/environment/environmentMap";
import { createCube, createSphere } from "../meshes/modelFactory";

export class PbrScene extends Scene {

    constructor() {
        super();

        let envTex: any = [
            `../${BASEPATH}/assets/cubemap/posx.jpg`,
            `../${BASEPATH}/assets/cubemap/negx.jpg`,
            `../${BASEPATH}/assets/cubemap/posy.jpg`,
            `../${BASEPATH}/assets/cubemap/negy.jpg`,
            `../${BASEPATH}/assets/cubemap/posz.jpg`,
            `../${BASEPATH}/assets/cubemap/negz.jpg`,
        ];
        envTex = `../${BASEPATH}/assets/hdr/vestibule_1k.png`;
        envTex = `../${BASEPATH}/assets/hdr/brown_photostudio_02_1k.hdr`;

        this.environmentMap = new EnvironmentMap(envTex, Math.PI);

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [0, 100, 150], movementSpeed: 100, target: [0, 100, 0] })
        this.lights = [];

        let intensity = 6000;
        this.lights.push(new Light({ type: LightType.Point, position: [100, 200, 100], diffuseColor: [1, 1, 1, 1], intensity: intensity, useFalloff: true }));
        this.lights.push(new Light({ type: LightType.Point, position: [-100, 200, 100], diffuseColor: [1, 1, 1, 1], intensity: intensity, useFalloff: true }));
        this.lights.push(new Light({ type: LightType.Point, position: [-100, 0, 100], diffuseColor: [1, 1, 1, 1], intensity: intensity, useFalloff: true }));
        this.lights.push(new Light({ type: LightType.Point, position: [100, 0, 100], diffuseColor: [1, 1, 1, 1], intensity: intensity, useFalloff: true }));

        let floor_asset = new PbrMaterial({ albedo: 0.3, metal: 0.2, roughness: 0.3 });
        let floor = createCube(`Floor`, floor_asset)
            .translate(0, -1, 0)
            .scale(200, 1, 100);
        this.models.push(floor);

        let back_asset = new PbrMaterial({ albedo: 0.3, metal: 0.2, roughness: 0.3 });
        let back = createCube(`Back`, back_asset)
            .translate(0, 98, -100)
            .scale(200, 150, 1);
        this.models.push(back);

        let rowCount = 7;
        let step = 0.8 / rowCount;
        let gap = 25.0;

        for (let i = 0; i < rowCount; i++) {
            for (let j = 0; j < rowCount; j++) {
                let mat = new PbrMaterial({ ambientOcclussion: 1, albedo: [0.8, 0, 0, 1], metal: 0.1 + i * step, roughness: 0.1 + j * step });
                let sphere = createSphere("Sphere01", mat)
                    .translate((j - (rowCount / 2)) * gap, (i - (rowCount / 2)) * gap + 100, 0)
                    .scale(10);

                this.models.push(sphere);
            }
        }
    }
}