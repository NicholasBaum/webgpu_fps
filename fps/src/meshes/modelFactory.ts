import { Material } from "../core/materials/pbrMaterial";
import { ModelInstance } from "../core/modelInstance"
import { BoundingBox } from "../core/primitives/boundingBox";
import { VertexBufferObject } from "../core/primitives/VertexBufferObject";
import { CUBE_TOPOLOGY, CUBE_VERTEX_ARRAY, CUBE_VERTEX_BUFFER_LAYOUT, CUBE_VERTEX_COUNT } from "./cube_mesh";
import { CYLINDER_TOPOLOGY, CYLINDER_VERTEX_ARRAY, CYLINDER_VERTEX_BUFFER_LAYOUT } from "./cylinder_mesh";
import { NORMAL_VERTEX_BUFFER_LAYOUT, createTangents } from "./normalDataBuilder";
import { createSphereVertexData } from "./sphere";

export type ModelData = { vertexBuffer: VertexBufferObject, bb: BoundingBox, normalBuffer: VertexBufferObject | undefined }

////////////
// sphere //
////////////
export function getSphereModelData(): ModelData
export function getSphereModelData(numSegments: number, smooth: boolean): ModelData
export function getSphereModelData(numSegments?: number, smooth?: boolean): ModelData {
    return numSegments ? createSphereModelData(numSegments, smooth) : defaultSphereModelData();
}
export function createSphere(name: string, material: Material, withNormals?: boolean): ModelInstance
export function createSphere(name: string, material: Material, withNormals: boolean, numSegments: number, smooth: boolean): ModelInstance
export function createSphere(name: string, material: Material, withNormals?: boolean, numSegments?: number, smooth?: boolean): ModelInstance {
    let data = numSegments ? createSphereModelData(numSegments, smooth, withNormals) : defaultSphereModelData();
    return new ModelInstance(name, data.vertexBuffer, material, data.bb, withNormals ? data.normalBuffer : undefined)
}

function defaultSphereModelData(): ModelData {
    return _defaultSphereModelData ?? (_defaultSphereModelData = createSphereModelData())
}
let _defaultSphereModelData: ModelData | undefined = undefined;

function createSphereModelData(numSegments: number = 128, smooth = true, withNormals = true): ModelData {
    const sphereBB = { min: [-1, -1, -1], max: [1, 1, 1] };
    const sphereVertCount = 6 * numSegments ** 2;
    const sphereVertexData = createSphereVertexData(numSegments, smooth);
    const sphereVbo = new VertexBufferObject(
        sphereVertexData,
        sphereVertCount,
        CUBE_VERTEX_BUFFER_LAYOUT,
        CUBE_TOPOLOGY,
        "Sphere Vertex Data (default)"
    );

    let sphereN_Vbo: VertexBufferObject | undefined = undefined;
    if (withNormals) {
        const sphereNormalData = createTangents(sphereVertexData, sphereVertCount);
        sphereN_Vbo = new VertexBufferObject(
            sphereNormalData,
            sphereVertCount,
            NORMAL_VERTEX_BUFFER_LAYOUT,
            CUBE_TOPOLOGY,
            "Sphere Normal Data (default)"
        )
    }
    return { vertexBuffer: sphereVbo, bb: sphereBB, normalBuffer: sphereN_Vbo };
}

//////////
// cube //
//////////
const cubeBB = { min: [-1, -1, -1], max: [1, 1, 1] };
const cubeVbo = new VertexBufferObject(
    CUBE_VERTEX_ARRAY,
    CUBE_VERTEX_COUNT,
    CUBE_VERTEX_BUFFER_LAYOUT,
    CUBE_TOPOLOGY,
    "Cube Vertex Data (default)"
);
const cubeNormalData = createTangents(CUBE_VERTEX_ARRAY, CUBE_VERTEX_COUNT);
const cubeN_Vbo = new VertexBufferObject(
    cubeNormalData,
    CUBE_VERTEX_COUNT,
    NORMAL_VERTEX_BUFFER_LAYOUT,
    CUBE_TOPOLOGY,
    "Cube Normal Data (default)"
)
const cubeModelData: ModelData = { vertexBuffer: cubeVbo, bb: cubeBB, normalBuffer: undefined }
export function getCubeModelData() { return cubeModelData; }

export function createCube(name: string, material: Material, withNormals = true): ModelInstance {
    return new ModelInstance(name, cubeVbo, material, cubeBB, withNormals ? cubeN_Vbo : undefined)
}


//////////////
// cylinder //
//////////////
export function getCylinderModelData(): ModelData
export function getCylinderModelData(n_sides?: number, smooth?: boolean): ModelData
export function getCylinderModelData(n_sides?: number, smooth?: boolean): ModelData {
    if (n_sides)
        return createCylinderModelData(n_sides, smooth);
    else
        return defaultCylinderData();
}

export function createCylinder(name: string, material: Material): ModelInstance
export function createCylinder(name: string, material: Material, n_sides: number, smooth: boolean, withNormals?: boolean): ModelInstance
export function createCylinder(name: string, material: Material, n_sides?: number, smooth?: boolean, withNormals?: boolean): ModelInstance {
    let data = n_sides ? createCylinderModelData(n_sides, smooth, withNormals) : defaultCylinderData();
    return new ModelInstance(name, data.vertexBuffer, material, data.bb, withNormals ? data.normalBuffer : undefined);
}

function defaultCylinderData(): ModelData {
    return _defaultCylinderData ?? (_defaultCylinderData = createCylinderModelData())
}
let _defaultCylinderData: ModelData | undefined = undefined;

function createCylinderModelData(n_sides: number = 100, smooth: boolean = true, withNormals = true): ModelData {
    const [rin, rout, height] = [0.7, 1.5, 3.0];
    const cylindereBB = { min: [-1, -1, -1], max: [1, 1, 1] };
    const cylinderVertCount = 3 * 2 * 4 * n_sides;
    const cylinderVertices = CYLINDER_VERTEX_ARRAY(n_sides, smooth, rin, rout, height);
    const cylinderVbo = new VertexBufferObject(
        cylinderVertices,
        cylinderVertCount,
        CYLINDER_VERTEX_BUFFER_LAYOUT,
        CYLINDER_TOPOLOGY,
        "Cylinder Vertex Data (default)"
    );

    let cylinderN_Vbo: VertexBufferObject | undefined = undefined;
    if (withNormals) {
        const cylinderNormalData = createTangents(cylinderVertices, cylinderVertCount);
        cylinderN_Vbo = new VertexBufferObject(
            cylinderNormalData,
            cylinderVertCount,
            NORMAL_VERTEX_BUFFER_LAYOUT,
            CYLINDER_TOPOLOGY,
            "Cylinder Normal Data (default)"
        )
    }
    return { vertexBuffer: cylinderVbo, bb: cylindereBB, normalBuffer: cylinderN_Vbo }
}