import { Vec2, Vec3 } from "wgpu-matrix";
import { calcBoundingBoxFromPoints } from "../core/primitives/boundingBox";
import { VertexBufferObject } from "../core/primitives/vertexBufferObject";
import { CUBE_VERTEX_BUFFER_LAYOUT } from "../meshes/cube";
import { TANGENTS_BUFFER_LAYOUT, createTangents } from "../meshes/tangents";
import { ModelData } from "../meshes/modelFactory";

interface VertexObj {
    position: Vec3,
    normal: Vec3,
    uv: Vec3
}

export async function loadOBJ(path: string): Promise<ModelData> {
    const data = await loadOBJ_Vertex(path);
    let flattened = data.flatMap(x => {
        return [
            ...x.position, 1,
            ...x.uv.slice(0, 2),
            ...x.normal, 1,
        ]
    });

    let floats = new Float32Array(flattened);
    let vertexBuffer = new VertexBufferObject(floats, data.length, CUBE_VERTEX_BUFFER_LAYOUT, 'triangle-list');
    let tangents = createTangents(data.map(x => x.position), data.map(x => x.uv.slice(0, 2)));
    let tangentsBuffer = new VertexBufferObject(tangents, data.length, TANGENTS_BUFFER_LAYOUT, 'triangle-list');
    let bb = calcBoundingBoxFromPoints(data.map(x => x.position));

    return { vBuffer: vertexBuffer, bb, tBuffer: tangentsBuffer };
}

async function loadOBJ_Vertex(path: string): Promise<VertexObj[]> {
    const rawObj = await ((await fetch(path)).text());

    const positions: Vec3[] = [];
    const normals: Vec3[] = [];
    const uvs: Vec2[] = [];
    const vertices: VertexObj[] = [];

    for (const line of rawObj.split("\n")) {
        if (line.startsWith("v ")) {
            positions.push(parseLine(line));
        } else if (line.startsWith("vn ")) {
            normals.push(parseLine(line));
        } else if (line.startsWith("vt ")) {
            uvs.push(parseLine(line));
        } else if (line.startsWith("f ")) {
            vertices.push(..._parseIndexLine(line, positions, normals, uvs));
        }
    }
    return vertices;
}

function parseLine(line: string): number[] {
    // e.g. vn 0.89442718 0.44721359 -0.00000000
    // as NaNs are filtered only the actual numbers will be returned
    return line.split(" ").map(parseFloat).filter(x => !isNaN(x));
}

function _parseIndexLine(line: string, positions: Vec3[], normals: Vec3[], uvs: Vec2[]): VertexObj[] {

    const extractPositionIndex = (vertex: string): number => {
        return Number(vertex.split("/")[0]) - 1;
    }

    const extractTextureIndex = (vertex: string): number => {
        return Number(vertex.split("/")[1]) - 1;
    }

    const extractNormalIndex = (vertex: string): number => {
        return Number(vertex.split("/")[2]) - 1;
    }
    // e.g. line = f 1/1/1 2/2/1 3/3/1 
    const indices = line.trim().split(" ").splice(1);
    if (indices.length > 3)
        throw new Error(`Not implemented yet. The Obj file seems to use quads not triangles.`);
    return indices.map((vertex: string) => {
        return {
            position: positions[extractPositionIndex(vertex)],
            normal: normals[extractNormalIndex(vertex)],
            uv: uvs[extractTextureIndex(vertex)]
        }
    })
}