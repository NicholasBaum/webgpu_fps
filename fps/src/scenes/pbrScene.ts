import { WASDCamera } from "../core/camera/wasdCamera";
import { Light, LightType } from "../core/light";
import { ModelInstance } from "../core/modelInstance";
import { CREATE_CUBE, CREATE_CUBE_w_NORMALS } from "../meshes/assetFactory";
import { PbrMaterial } from "../core/materials/pbrMaterial";
import { ModelAsset } from "../core/modelAsset";
import { createSphere } from "../meshes/sphere";
import { CUBE_TOPOLOGY, CUBE_VERTEX_BUFFER_LAYOUT } from "../meshes/cube_mesh";
import { Scene } from "../core/scene";
import { BASEPATH } from "../helper/htmlBuilder";
import { EnvironmentMap } from "../core/environment/environmentMap";
import { NORMAL_VERTEX_BUFFER_LAYOUT, createTangents } from "../meshes/normalDataBuilder";
import { fetchImage } from "../helper/io";


export class PbrScene extends Scene {

    constructor() {
        super();

        const cubeMaps = [
            `../${BASEPATH}/assets/cubemap/posx.jpg`,
            `../${BASEPATH}/assets/cubemap/negx.jpg`,
            `../${BASEPATH}/assets/cubemap/posy.jpg`,
            `../${BASEPATH}/assets/cubemap/negy.jpg`,
            `../${BASEPATH}/assets/cubemap/posz.jpg`,
            `../${BASEPATH}/assets/cubemap/negz.jpg`,
        ];

        let skymap = `../${BASEPATH}/assets/hdr/vestibule_1k.png`;
        skymap = `../${BASEPATH}/assets/hdr/brown_photostudio_02_1k.png`;
        this.environmentMap = new EnvironmentMap(skymap);

        // positive Z-Axis is pointing towards you
        this.camera = new WASDCamera({ position: [0, 100, 150], movementSpeed: 100, target: [0, 100, 0] })
        this.lights = [];
        
        let intensity = 6000;
        this.lights.push(new Light({ type: LightType.Point, position: [100, 200, 100], diffuseColor: [1, 1, 1, 1], intensity: intensity, useFalloff: true }));
        this.lights.push(new Light({ type: LightType.Point, position: [-100, 200, 100], diffuseColor: [1, 1, 1, 1], intensity: intensity, useFalloff: true }));
        this.lights.push(new Light({ type: LightType.Point, position: [-100, 0, 100], diffuseColor: [1, 1, 1, 1], intensity: intensity, useFalloff: true }));
        this.lights.push(new Light({ type: LightType.Point, position: [100, 0, 100], diffuseColor: [1, 1, 1, 1], intensity: intensity, useFalloff: true }));

        let floor_asset = CREATE_CUBE(new PbrMaterial({ albedo: 0.3, metallic: 0.2, roughness: 0.3 }));
        let floor = new ModelInstance(`Floor`, floor_asset)
            .translate(0, -1, 0)
            .scale(200, 1, 100);
        this.models.push(floor);

        let back_asset = CREATE_CUBE(new PbrMaterial({ albedo: 0.3, metallic: 0.2, roughness: 0.3 }));        
        let back = new ModelInstance(`Back`, back_asset)
            .translate(0, 98, -100)
            .scale(200, 150, 1);
        this.models.push(back);

        let rowCount = 7;
        let step = 0.8 / rowCount;
        let gap = 25.0;
        let numSegs = 128;
        let sphere_data = createSphere(numSegs, true);
        const count = 6 * numSegs ** 2;
        const normalData = createTangents(sphere_data, count);

        for (let i = 0; i < rowCount; i++) {
            for (let j = 0; j < rowCount; j++) {
                let mat = new PbrMaterial({ ambientOcclussion: 1, albedo: [0.8, 0, 0, 1], metallic: 0.1 + i * step, roughness: 0.1 + j * step });
                let asset = new ModelAsset(
                    "sphere_asset",
                    sphere_data,
                    6 * numSegs ** 2,
                    CUBE_VERTEX_BUFFER_LAYOUT,
                    CUBE_TOPOLOGY,
                    mat,
                    { min: [-1, -1, -1], max: [1, 1, 1] },
                    normalData,
                    NORMAL_VERTEX_BUFFER_LAYOUT
                );
                let sphere = new ModelInstance("Sphere01", asset)
                    .translate((j - (rowCount / 2)) * gap, (i - (rowCount / 2)) * gap + 100, 0)
                    .scaleBy(10);

                this.models.push(sphere);
            }
        }
    } 
}