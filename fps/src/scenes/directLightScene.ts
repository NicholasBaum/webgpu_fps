import { mat4, vec3 } from "wgpu-matrix";
import { CUBE_TOPOLOGY, CUBE_VERTEX_ARRAY, CUBE_VERTEX_BUFFER_LAYOUT, CUBE_VERTEX_COUNT } from "../meshes/cube_mesh";
import { Scene } from "../core/scene";
import { ModelAsset } from "../core/modelAsset";
import { ModelInstance } from "../core/modelInstance";
import { WASDCamera } from "../core/camera/wasdCamera";
import { CYLINDER_VERTEX_ARRAY } from "../meshes/cylinder_mesh";
import { DirectLight } from "../core/light";

import light_shader from '../shaders/directlight_shader.wgsl'

export class DirectLightScene extends Scene {

    constructor(public isAnimated: boolean = true) {
        super();

        this.camera = new WASDCamera({ position: [0, 0, 40], movementSpeed: 100 })

        this.light = new DirectLight(1, [50, 30, -25], [0.5, 0.5, 0.5, 0]);

        let cube_asset = new ModelAsset(
            "cube_asset_01",
            CUBE_VERTEX_ARRAY,
            CUBE_VERTEX_COUNT,
            { label: "Direct Light Shader", code: light_shader },
            CUBE_VERTEX_BUFFER_LAYOUT,
            CUBE_TOPOLOGY,
            '../assets/uv_dist.jpg'
        );

        const n1 = 100;
        let cylinder_asset = new ModelAsset(
            "cube_asset_01",
            CYLINDER_VERTEX_ARRAY(n1),
            3 * 2 * 4 * n1,
            { label: "Shader", code: light_shader },
            CUBE_VERTEX_BUFFER_LAYOUT,
            CUBE_TOPOLOGY,
            '../assets/uv_dist.jpg',
        );

        const n2 = 5;
        let cylinder_asset2 = new ModelAsset(
            "cube_asset_01",
            CYLINDER_VERTEX_ARRAY(n2),
            3 * 2 * 4 * n2,
            { label: "Shader", code: light_shader },
            CUBE_VERTEX_BUFFER_LAYOUT,
            CUBE_TOPOLOGY,
            '../assets/uv_dist.jpg'
        );

        let cube = new ModelInstance(`Cube01`, cube_asset, mat4.rotateY(mat4.translation([0, 0, -50]), 0.0 * Math.PI));
        mat4.scale(cube.transform, [10, 10, 10], cube.transform);
        this.models.push(cube);

        let cylinder = new ModelInstance(`Cylinder01`, cylinder_asset, mat4.rotateZ(mat4.translation([20, 0, -20]), 0.25 * Math.PI));
        mat4.scale(cylinder.transform, [10, 10, 10], cylinder.transform);
        this.models.push(cylinder);

        let cylinder2 = new ModelInstance(`Cylinder01`, cylinder_asset2, mat4.translation([-20, 0, -20]));
        mat4.scale(cylinder2.transform, [10, 10, 10], cylinder2.transform);
        this.models.push(cylinder2);

        this.models.push(this.light.model);
    }

    private currentTime: number = 0;
    public override update(deltaTime: number): void {
        if (!this.isAnimated)
            return;
        this.currentTime += deltaTime;
        this.light.positionOrDirection = [50 * Math.sin(this.currentTime), 30, -25];
    }
}
