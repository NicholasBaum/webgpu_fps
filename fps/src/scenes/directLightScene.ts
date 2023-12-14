import { mat4, vec3 } from "wgpu-matrix";
import { CUBE_TOPOLOGY, CUBE_VERTEX_ARRAY, CUBE_VERTEX_BUFFER_LAYOUT, CUBE_VERTEX_COUNT } from "../meshes/cube_mesh";
import { Scene } from "../core/scene";
import { ModelAsset } from "../core/modelAsset";
import { ModelInstance } from "../core/modelInstance";

import shader from '../shaders/directlight_shader.wgsl'
import simple_shader from '../shaders/vcolor_shader.wgsl'
import normal_shader from '../shaders/normal_shader.wgsl'
import { WASDCamera } from "../core/camera/wasdCamera";
import { CYLINDER_VERTEX_ARRAY } from "../meshes/cylinder_mesh";

export class DirectLightScene extends Scene {

    constructor(public isAnimated: boolean = true) {
        super();

        this.camera = new WASDCamera({ position: [0, 0, -10] })

        let cube_asset = new ModelAsset(
            "cube_asset_01",
            CUBE_VERTEX_ARRAY,
            CUBE_VERTEX_COUNT,
            { label: "Direct Light Shader", code: shader },
            CUBE_VERTEX_BUFFER_LAYOUT,
            CUBE_TOPOLOGY,
            '../assets/uv_dist.jpg'
        );

        let n = 100;
        let cylinder_asset = new ModelAsset(
            "cube_asset_01",
            CYLINDER_VERTEX_ARRAY(n),
            3 * 2 * 4 * (n - 1),
            { label: "Simple Shader", code: normal_shader },
            CUBE_VERTEX_BUFFER_LAYOUT,
            CUBE_TOPOLOGY,
        );

        // let cube = new ModelInstance(`Cube01`, cube_asset, mat4.translation([0, 0, 20]));
        // mat4.scale(cube.transform, [10, 10, 10], cube.transform);
        // this.models.push(cube);

        let cylinder = new ModelInstance(`Cylinder01`, cylinder_asset, mat4.translation([0, 0, 20]));
        mat4.scale(cylinder.transform, [10, 10, 10], cylinder.transform);
        this.models.push(cylinder);

    }

    public override update(deltaTime: number): void {
        if (!this.isAnimated)
            return;
    }
}
