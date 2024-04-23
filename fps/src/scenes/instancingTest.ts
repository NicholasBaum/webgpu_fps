import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { PbrMaterial } from "../core/materials/pbrMaterial";
import { Scene } from "../core/scene";
import { BASEPATH } from "../helper/htmlBuilder";
import { createSphere } from "../meshes/modelFactory";

export class InstancingTest extends Scene {
    constructor() {
        super();

        // the following samples should lead to 7 rendergroups
        // one group is the lights group        
        // 3 are blinn groups and 3 are pbr groups of the following kind
        //      size 2 group with working normals
        //      size 2 group with normal texture but not wokring because missing normals (but this is still a unique texture although not working)
        //      size 4 group no normal texture but 2 with normals and 2 without

        let blinn = new BlinnPhongMaterial({ diffuseColor: [0, 0, 1, 1] });
        this.models.push(createSphere("blinn", blinn).translate(2, 0, 0));
        this.models.push(createSphere("blinn", blinn).translate(4, 0, 0));

        let blinnNormal = new BlinnPhongMaterial({ diffuseColor: [0, 1, 0, 1], normalMapPath: `../${BASEPATH}/assets/spiral_normal.png`, });
        this.models.push(createSphere("blinn", blinnNormal).translate(2, 2, 0));
        this.models.push(createSphere("blinn", blinnNormal).translate(4, 2, 0));

        //blinn = new BlinnPhongMaterial({ diffuseColor: [0, 1, 1, 1] });
        this.models.push(createSphere("blinn", blinn, false).translate(2, 0, 2));
        this.models.push(createSphere("blinn", blinn, false).translate(4, 0, 2));

        //blinnNormal = new BlinnPhongMaterial({ diffuseColor: [1, 0, 0, 1], normalMapPath: `../${BASEPATH}/assets/spiral_normal.png`, });
        this.models.push(createSphere("blinn", blinnNormal, false).translate(2, 2, 2));
        this.models.push(createSphere("blinn", blinnNormal, false).translate(4, 2, 2));




        let pbr = new PbrMaterial({ albedo: [0, 0, 1, 1] });
        this.models.push(createSphere("pbr", pbr).translate(-2, 0, 0));
        this.models.push(createSphere("pbr", pbr).translate(-4, 0, 0));

        let pbrNormal = new PbrMaterial({ albedo: [0, 1, 0, 1], normalMapPath: `../${BASEPATH}/assets/spiral_normal.png`, });
        this.models.push(createSphere("pbr", pbrNormal).translate(-2, -2, 0));
        this.models.push(createSphere("pbr", pbrNormal).translate(-4, -2, 0));

        //pbr = new PbrMaterial({ albedo: [0, 1, 1, 1] });
        this.models.push(createSphere("pbr", pbr, false).translate(-2, 0, -2));
        this.models.push(createSphere("blinn", pbr, false).translate(-4, 0, -2));

        //pbrNormal = new PbrMaterial({ albedo: [1, 0, 0, 1], normalMapPath: `../${BASEPATH}/assets/spiral_normal.png`, });
        this.models.push(createSphere("pbr", pbrNormal, false).translate(-2, -2, -2));
        this.models.push(createSphere("pbr", pbrNormal, false).translate(-4, -2, -2));
    }
}