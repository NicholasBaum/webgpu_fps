import { Vec4, mat4 } from "wgpu-matrix";
import { Scene } from "../core/scene";
import { ModelInstance } from "../core/modelInstance";
import { WASDCamera } from "../core/camera/wasdCamera";
import { DirectLight } from "../core/light";

import { CREATE_CUBE, CREATE_CYLINDER } from "../meshes/assetFactory";

export class SimpleScene extends Scene {

    constructor(public isAnimated: boolean = true) {
        super();

        this.camera = new WASDCamera({ position: [0, 60, 10], movementSpeed: 100, target: [0, 40, 0] })
        this.light = new DirectLight(1, [0, 20, -25]);

        let cube_asset = CREATE_CUBE([0, 1, 0, 1], [1, 0, 0, 1]);
        let cylinder_asset = CREATE_CYLINDER(100, true, [0, 0, 0.5, 1], [1, 1, 1, 1], 50);
        let cylinder_asset2 = CREATE_CYLINDER(5, false, [0, 0.5, 0, 1]);

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
    private centerPos!: Vec4;
    public override update(deltaTime: number): void {
        if (!this.isAnimated)
            return;
        this.centerPos = this.centerPos ?? this.light.positionOrDirection;
        this.currentTime += deltaTime;
        this.light.positionOrDirection = [this.centerPos[0] + 25 * Math.sin(this.currentTime),
        this.centerPos[1], this.centerPos[2] + 25 * Math.cos(this.currentTime)];
    }
}
