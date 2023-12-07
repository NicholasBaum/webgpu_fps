import { mat4, vec3 } from "wgpu-matrix";
import { CUBE_TOPOLOGY, CUBE_VERTEX_ARRAY, CUBE_VERTEX_BUFFER_LAYOUT, CUBE_VERTEX_COUNT } from "../meshes/cube_mesh";
import { Scene } from "../core/scene";
import { ModelAsset } from "../core/modelAsset";
import { ModelInstance } from "../core/modelInstance";

import shader from '../shaders/directlight_shader.wgsl'
import { WASDCamera } from "../core/camera/wasdCamera";

export class BoxesScene extends Scene {

    constructor(public isAnimated: boolean = true) {
        super();

        this.camera = new WASDCamera({ position: [0, 0, -10] })

        let cube_asset = new ModelAsset(
            "cube_asset_01",
            CUBE_VERTEX_ARRAY,
            CUBE_VERTEX_COUNT,
            { label: "Simple Shader", code: shader },
            CUBE_VERTEX_BUFFER_LAYOUT,
            CUBE_TOPOLOGY,
            '../assets/uv_dist.jpg'
        );

        let gap = 4;
        for (let i = 0; i < 16; i++) {
            let t = mat4.identity();
            let x = (i % 4) * gap;
            let y = Math.floor(i / 4) * gap;
            mat4.translate(t, [x - 6, y - 6, 0], t);
            let instance = new ModelInstance(`Cube01${i.toString().padStart(3, '0')}`, cube_asset, t);
            this.models.push(instance);
        }
    }

    public override update(deltaTime: number): void {
        if (!this.isAnimated)
            return;
    }
}
