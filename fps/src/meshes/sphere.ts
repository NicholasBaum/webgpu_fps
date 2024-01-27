import { Vec3, Vec4, vec3 } from "wgpu-matrix";

export function createSphere(numSegments: number, smooth: boolean = true, radius: number = 1, vertexColor: Vec4 = [50, 50, 50, 0],): Float32Array {
    const data = createSphereVertices(numSegments, smooth, radius);
    let vertCount = data.vertices.length / 4;
    const colors = Array<number[]>(vertCount).fill([...vertexColor]).flat();
    const formatedData = remap([4, 4, 2, 4], data.vertices, colors, data.uvs, data.normals);
    return new Float32Array(formatedData);
}

// strides it the number of floats
function remap(strides: number[], ...data: Array<number[]>): number[] {
    // validate input
    if (strides.length != data.length)
        throw new RangeError("strides lenght has to equal the amount of datasets");
    let vertCount = data[0].length / strides[0]
    data.forEach((d, i) => {
        if (d.length != vertCount * strides[i])
            throw new Error(`dataset ${i} has size ${d.length} but should have ${vertCount * strides[i]}`);
    });

    // remap
    const mapped: number[] = [];
    for (let i = 0; i < vertCount; i++) {
        strides.forEach((stride, j) => {
            mapped.push(...(data[j].slice(i * stride, i * stride + stride)));
        })
    }

    return mapped;
}

function createSphereVertices(numSegments: number, smooth: boolean = true, radius: number = 1) {
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

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
            vertices.push(...v3, 1, ...v2, 1, ...v1, 1);
            vertices.push(...v1, 1, ...v4, 1, ...v3, 1);

            const norm = vec3.normalize;
            // Calculate normals
            if (smooth) {
                normals.push(...norm(v3), 0, ...norm(v2), 0, ...norm(v1), 0);
                normals.push(...norm(v1), 0, ...norm(v4), 0, ...norm(v3), 0);
            } else {
                // calc face average
                let t1 = norm(vec3.mulScalar(vec3.add(vec3.add(v3, v2), v1), 1 / 3));
                let t2 = norm(vec3.mulScalar(vec3.add(vec3.add(v1, v4), v3), 1 / 3));
                normals.push(...t1, 0, ...t1, 0, ...t1, 0);
                normals.push(...t2, 0, ...t2, 0, ...t2, 0);
            }
            // Calculate UV coordinates
            const uv_u1 = i / numSegments;
            const uv_u2 = (i + 1) / numSegments;
            const uv_v1 = j / numSegments;
            const uv_v2 = (j + 1) / numSegments;

            // Push the UV coordinates for each face
            uvs.push(uv_u1, uv_v1, uv_u2, uv_v1, uv_u2, uv_v2);
            uvs.push(uv_u2, uv_v2, uv_u1, uv_v2, uv_u1, uv_v1);
        }
    }

    return {
        vertices: vertices,
        normals: normals,
        uvs: uvs,
    };
}
