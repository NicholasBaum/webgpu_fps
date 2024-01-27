import { BlinnPhongMaterial } from "../core/materials/blinnPhongMaterial";
import { ModelAsset } from "../core/modelAsset";
import { CUBE_TOPOLOGY, CUBE_VERTEX_ARRAY, CUBE_VERTEX_BUFFER_LAYOUT, CUBE_VERTEX_COUNT } from "./cube_mesh";
import { CYLINDER_TOPOLOGY, CYLINDER_VERTEX_ARRAY, CYLINDER_VERTEX_BUFFER_LAYOUT } from "./cylinder_mesh";
import { NORMAL_VERTEX_BUFFER_LAYOUT, createTangents } from "./normalDataBuilder";
import { createSphere } from "./sphere";

export function CREATE_CUBE_w_NORMALS(material?: BlinnPhongMaterial): ModelAsset {
    const vertices = CUBE_VERTEX_ARRAY;
    const count = CUBE_VERTEX_COUNT;
    const normalData = createTangents(vertices, count);
    return new ModelAsset(
        "cube_asset",
        vertices,
        count,
        CUBE_VERTEX_BUFFER_LAYOUT,
        CUBE_TOPOLOGY,
        material ?? new BlinnPhongMaterial(),
        { min: [-1, -1, -1], max: [1, 1, 1] },
        normalData,
        NORMAL_VERTEX_BUFFER_LAYOUT,
    );
}

export function CREATE_CUBE(material?: BlinnPhongMaterial): ModelAsset {
    return new ModelAsset(
        "cube_asset",
        CUBE_VERTEX_ARRAY,
        CUBE_VERTEX_COUNT,
        CUBE_VERTEX_BUFFER_LAYOUT,
        CUBE_TOPOLOGY,
        material ?? new BlinnPhongMaterial(),
        { min: [-1, -1, -1], max: [1, 1, 1] }
    );
}

export function CREATE_SPHERE(numSegments: number, smoothNormals: boolean = true, material?: BlinnPhongMaterial): ModelAsset {
    return new ModelAsset(
        "sphere_asset",
        createSphere(numSegments, smoothNormals),
        6 * numSegments ** 2,
        CUBE_VERTEX_BUFFER_LAYOUT,
        CUBE_TOPOLOGY,
        material ?? new BlinnPhongMaterial(),
        { min: [-1, -1, -1], max: [1, 1, 1] }
    );
}

export function CREATE_CYLINDER_w_NORMALS(n_sides: number = 5, smoothNormals: boolean = false, material?: BlinnPhongMaterial): ModelAsset {
    const [rin, rout, height] = [0.7, 1.5, 3.0];
    const vertices = CYLINDER_VERTEX_ARRAY(n_sides, smoothNormals, rin, rout, height);
    const count = 3 * 2 * 4 * n_sides;
    const normalData = createTangents(vertices, count);
    return new ModelAsset(
        "cylinder_asset",
        vertices,
        count,
        CYLINDER_VERTEX_BUFFER_LAYOUT,
        CUBE_TOPOLOGY,
        material ?? new BlinnPhongMaterial(),
        { min: [-1, -1, -1], max: [1, 1, 1] },
        normalData,
        NORMAL_VERTEX_BUFFER_LAYOUT,
    );
}

export function CREATE_CYLINDER(n_sides: number = 5, smoothNormals: boolean = false, material?: BlinnPhongMaterial): ModelAsset {
    const [rin, rout, height] = [0.7, 1.5, 3.0];
    return new ModelAsset(
        "cylinder_asset",
        CYLINDER_VERTEX_ARRAY(n_sides, smoothNormals, rin, rout, height),
        3 * 2 * 4 * n_sides,
        CYLINDER_VERTEX_BUFFER_LAYOUT,
        CYLINDER_TOPOLOGY,
        material ?? new BlinnPhongMaterial(),
        { min: [-rout, -height / 2, -rout], max: [rout, height / 2, rout] },
    );
}