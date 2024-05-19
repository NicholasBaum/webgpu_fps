import { WASDCamera } from "../core/camera/wasdCamera";
import { EnvironmentMap } from "../core/environment/environmentMap";
import { PbrMaterial, getPbrMaterial } from "../core/materials/pbrMaterial";
import { Scene } from "../core/scene";
import { BASEPATH } from "../helper/htmlBuilder";
import { createSphere, load } from "../meshes/modelFactory";

export async function buildObjTestSceneAsync(): Promise<Scene> {

    let scene = new Scene();

    scene.camera = new WASDCamera({ position: [0, 0, 100], movementSpeed: 100, target: [0, 0, 0] })

    scene.environmentMap = new EnvironmentMap(`../${BASEPATH}/assets/hdr/brown_photostudio_02_1k.hdr`, Math.PI);

    let mat = new PbrMaterial({ albedo: [0.7, 0, 0.3, 1], roughness: 0.8, metal: 0.9 });
    let sphere = createSphere("", mat).translate(50, 0, 0,).scale(10);
    scene.models.push(sphere);

    let bunnyMat = new PbrMaterial({ albedo: [0.7, 0, 0.3, 1], roughness: 0.3 });
    let bunny = (await load(`../${BASEPATH}/assets/models/stanford-bunny.obj`, bunnyMat)).scale(20);
    scene.models.push(bunny);

    let goldMat = getPbrMaterial(`../${BASEPATH}/assets/pbr/light-gold/`);
    let pyramid = (await load(`../${BASEPATH}/assets/models/pyramid.obj`, goldMat)).translate(-50, 0, 0).scale(20);
    scene.models.push(pyramid);

    return scene;
}