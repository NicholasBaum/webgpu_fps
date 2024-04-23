import { EnvironmentMap } from "../core/environment/environmentMap";
import { getPbrMaterial } from "../core/materials/pbrMaterial";
import { Scene } from "../core/scene";
import { BASEPATH } from "../helper/htmlBuilder";
import { createSphere } from "../meshes/modelFactory";

export class InstancingBenchmark extends Scene {
    constructor() {
        super();
        const n = 9;
        this.environmentMap = new EnvironmentMap(`../${BASEPATH}/assets/hdr/brown_photostudio_02_1k.hdr`);
        let gold = getPbrMaterial(`../${BASEPATH}/assets/pbr/light-gold/`);

        const gap = 4;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                for (let k = 0; k < n; k++) {
                    this.models.push(createSphere(`[${i}, ${j}]`, gold).translate(i * gap, j * gap, k * gap));
                }
            }
        }
    }
}