import { Material } from "../core/materials/pbrMaterial";
import { ModelInstance } from "../core/modelInstance"
import { BoundingBox } from "../core/primitives/boundingBox";
import { VertexBufferObject } from "../core/primitives/gpuMemoryObject";
import { CUBE_TOPOLOGY, CUBE_VERTEX_ARRAY, CUBE_VERTEX_BUFFER_LAYOUT, CUBE_VERTEX_COUNT } from "./cube_mesh";
import { CYLINDER_TOPOLOGY, CYLINDER_VERTEX_ARRAY, CYLINDER_VERTEX_BUFFER_LAYOUT } from "./cylinder_mesh";
import { NORMAL_VERTEX_BUFFER_LAYOUT, createTangents } from "./normalDataBuilder";
import { createSphere } from "./sphere";

const numSegments = 128;
const sphereBB = { min: [-1, -1, -1], max: [1, 1, 1] };
const sphereVertCount = 6 * numSegments ** 2;
const sphereVertexData = createSphere(numSegments, true);
const sphereVbo = new VertexBufferObject(
    sphereVertexData,
    sphereVertCount,
    CUBE_VERTEX_BUFFER_LAYOUT,
    CUBE_TOPOLOGY,
    "Sphere Vertex Data (default)"
);

const sphereNormalData = createTangents(sphereVertexData, sphereVertCount);
const sphereN_Vbo = new VertexBufferObject(
    sphereNormalData,
    sphereVertCount,
    NORMAL_VERTEX_BUFFER_LAYOUT,
    CUBE_TOPOLOGY,
    "Sphere Normal Data (default)"
)

export function createSphere2(name: string, material: Material): ModelInstance {
    return new ModelInstance(name, sphereVbo, material, sphereBB, sphereN_Vbo)
}

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
export function createCube(name: string, material: Material): ModelInstance {
    return new ModelInstance(name, cubeVbo, material, cubeBB, cubeN_Vbo)
}




type ModelInstanceInitData = { vertexBuffer: VertexBufferObject, bb: BoundingBox, normalBuffer: VertexBufferObject }
let defaultCylinderData: ModelInstanceInitData | undefined = undefined;

export function createCylinder(name: string, material: Material): ModelInstance
export function createCylinder(name: string, material: Material, n_sides: number, smooth: boolean): ModelInstance
export function createCylinder(name: string, material: Material, n_sides?: number, smooth?: boolean): ModelInstance {
    if (n_sides) {
        let data = createCylinderData(n_sides, smooth);
        return new ModelInstance(name, data.vertexBuffer, material, data.bb, data.normalBuffer);
    }
    else {
        defaultCylinderData = defaultCylinderData ?? createCylinderData();
        return new ModelInstance(name, defaultCylinderData.vertexBuffer, material, defaultCylinderData.bb, defaultCylinderData.normalBuffer)
    }
}


function createCylinderData(n_sides: number = 100, smooth: boolean = true): ModelInstanceInitData {
    const [rin, rout, height] = [0.7, 1.5, 3.0];
    const cylindereBB = { min: [-1, -1, -1], max: [1, 1, 1] };
    const cylinderVertCount = 3 * 2 * 4 * n_sides;
    const cylinderVertices = CYLINDER_VERTEX_ARRAY(n_sides, true, rin, rout, height);
    const cylinderVbo = new VertexBufferObject(
        cylinderVertices,
        cylinderVertCount,
        CYLINDER_VERTEX_BUFFER_LAYOUT,
        CYLINDER_TOPOLOGY,
        "Cylinder Vertex Data (default)"
    );

    const cylinderNormalData = createTangents(cylinderVertices, cylinderVertCount);
    const cylinderN_Vbo = new VertexBufferObject(
        cylinderNormalData,
        cylinderVertCount,
        NORMAL_VERTEX_BUFFER_LAYOUT,
        CYLINDER_TOPOLOGY,
        "Cylinder Normal Data (default)"
    )
    return { vertexBuffer: cylinderVbo, bb: cylindereBB, normalBuffer: cylinderN_Vbo }
}