import { Vec4 } from "wgpu-matrix";
import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { ModelAsset } from "../core/modelAsset";
import { CUBE_TOPOLOGY, CUBE_VERTEX_ARRAY, CUBE_VERTEX_BUFFER_LAYOUT, CUBE_VERTEX_COUNT } from "./cube_mesh";
import { CYLINDER_TOPOLOGY, CYLINDER_VERTEX_ARRAY, CYLINDER_VERTEX_BUFFER_LAYOUT } from "./cylinder_mesh";

export function CREATE_CUBE(diffuseColor: Vec4 = [0.3, 0.3, 0.3, 1], specularColor: Vec4 = [1, 1, 1, 1], shininess: number = 32): ModelAsset {
    return new ModelAsset(
        "cube_asset",
        CUBE_VERTEX_ARRAY,
        CUBE_VERTEX_COUNT,
        CUBE_VERTEX_BUFFER_LAYOUT,
        CUBE_TOPOLOGY,
        new BlinnPhongMaterial({ diffuseColor: diffuseColor, specularColor: specularColor, shininess: shininess, diffuseMap: '../assets/uv_dist.jpg' })
    );
}



export function CREATE_CYLINDER(n_sides: number = 5, smoothNormals: boolean = false,
    diffuseColor: Vec4 = [0.3, 0.3, 0.3, 1], specularColor: Vec4 = [1, 1, 1, 1], shininess: number = 32): ModelAsset {

    return new ModelAsset(
        "cylinder_asset",
        CYLINDER_VERTEX_ARRAY(n_sides, smoothNormals),
        3 * 2 * 4 * n_sides,
        CYLINDER_VERTEX_BUFFER_LAYOUT,
        CYLINDER_TOPOLOGY,
        new BlinnPhongMaterial({ diffuseColor: diffuseColor, specularColor: specularColor, shininess: shininess, diffuseMap: '../assets/uv_dist.jpg' })
    );
}