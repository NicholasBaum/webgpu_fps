import { Vec2, Vec3, Vec4, vec3 } from "wgpu-matrix";

export function createSphereVertexData(numSegments: number, smooth: boolean = true, radius: number = 1): Float32Array {
    const data = createSphereVertices(numSegments, smooth, radius);
    const appendedData = zipFlattenArrays(data.positions, 1, data.uvs, data.normals, 1);
    return new Float32Array(appendedData);
}

function zipFlattenArrays(...datasets: Array<number | Vec2[] | Vec3[] | Vec4[]>) {
    const arrays = datasets
        .filter(x => typeof x != 'number')
        .map(x => x as Vec2[] | Vec3[] | Vec4[]);
    if (!arrays.every(x => x.length == arrays[0].length))
        throw new Error(`The datasets arrays don't have the same length.`);
    let flattened: number[] = [];
    for (let i = 0; i < arrays[0].length; i++) {
        for (let j = 0; j < datasets.length; j++) {
            let constantOrArray = datasets[j];
            if (typeof constantOrArray == 'number')
                flattened.push(constantOrArray);
            else
                flattened.push(...constantOrArray[i]);
        }
    }
    return flattened;
}

function createSphereVertices(numSegments: number, smooth: boolean = true, radius: number = 1) {
    const positions: Vec3[] = [];
    const normals: Vec3[] = [];
    const uvs: Vec2[] = [];

    for (let i = 0; i < numSegments; i++) {
        const theta1 = (i / numSegments) * 2 * Math.PI;
        const theta2 = ((i + 1) / numSegments) * 2 * Math.PI;

        for (let j = 0; j < numSegments; j++) {
            const phi1 = (j / numSegments) * Math.PI;
            const phi2 = ((j + 1) / numSegments) * Math.PI;

            // Define the vertices for each face      
            const v1: Vec3 = [radius * Math.sin(phi1) * Math.cos(theta1), radius * Math.cos(phi1), -radius * Math.sin(phi1) * Math.sin(theta1)];
            const v2 = [radius * Math.sin(phi1) * Math.cos(theta2), radius * Math.cos(phi1), -radius * Math.sin(phi1) * Math.sin(theta2)];
            const v3: Vec3 = [radius * Math.sin(phi2) * Math.cos(theta2), radius * Math.cos(phi2), -radius * Math.sin(phi2) * Math.sin(theta2)];
            const v4 = [radius * Math.sin(phi2) * Math.cos(theta1), radius * Math.cos(phi2), -radius * Math.sin(phi2) * Math.sin(theta1)];
            // Push the vertices for each face
            positions.push(v3, v2, v1);
            positions.push(v1, v4, v3);

            const norm = vec3.normalize;
            // Calculate normals
            if (smooth) {
                normals.push(norm(v3), norm(v2), norm(v1));
                normals.push(norm(v1), norm(v4), norm(v3));
            } else {
                // calc face average
                let t1 = norm(vec3.mulScalar(vec3.add(vec3.add(v3, v2), v1), 1 / 3));
                let t2 = norm(vec3.mulScalar(vec3.add(vec3.add(v1, v4), v3), 1 / 3));
                normals.push(t1, t1, t1);
                normals.push(t2, t2, t2);
            }
            // Calculate UV coordinates
            const uv_u1 = i / numSegments;
            const uv_u2 = (i + 1) / numSegments;
            const uv_v1 = j / numSegments;
            const uv_v2 = (j + 1) / numSegments;

            // Push the UV coordinates for each face
            uvs.push([uv_u2, uv_v2], [uv_u2, uv_v1], [uv_u1, uv_v1]);
            uvs.push([uv_u1, uv_v1], [uv_u1, uv_v2], [uv_u2, uv_v2]);
        }
    }

    return {
        positions,
        normals,
        uvs,
    };
}
