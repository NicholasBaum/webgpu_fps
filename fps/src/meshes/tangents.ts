// functions to calculate the tangent space
// the normals of a normalmap are usually stored in tangent space
// and need to be mapped to object space first
// it's actually less work to map lights and cameras into tangent space and do the light calculations in tangent space

// tangent space is defined by the normal of a face and more or less the u (tangent) and v (bitangent) axis of the mapped texture
// visually you can place the texture in worldspace correctly aligend to the face by its uvs and calculate the borders of the texture plane
// but if the uv's are distorted this interpretation isn't really correct anymore and the tangent and bitangent won't be perpendicular
// the length of these vectors actually indicate how distorted the uv's are, see
// https://www.reedbeta.com/blog/conformal-texture-mapping/
import { Vec2, Vec3, vec2, vec3 } from "wgpu-matrix";
import { DEF_LAYOUT_SIZE_FLOAT, DEF_POSITION_INDEX_FLOAT, DEF_UV_INDEX_FLOAT } from "./defaultLayout";

export const TANGENTS_BUFFER_LAYOUT: GPUVertexBufferLayout = {
    arrayStride: 24,
    attributes: [
        {
            format: "float32x3",
            offset: 0,
            shaderLocation: 3,
        },
        {
            format: "float32x3",
            offset: 12,
            shaderLocation: 4,
        },
    ]
};

export function createTangents(positions: Vec3[], uvs: Vec2[]): Float32Array {
    if (positions.length != uvs.length)
        throw new Error(`positions and uvs length doesn't match.`);
    let flatenedTangents: number[] = [];
    // taking buckets of 3 for every face 
    // and pushing the same tangets 3 times as all 3 vertices have the same tangents
    for (let i = 0; i < positions.length; i += 3) {
        const [tangent, biTangent] = calcTangents(
            positions[i], positions[i + 1], positions[i + 2],
            uvs[i], uvs[i + 1], uvs[i + 2]
        );
        flatenedTangents.push(...tangent, ...biTangent);
        flatenedTangents.push(...tangent, ...biTangent);
        flatenedTangents.push(...tangent, ...biTangent);
    }
    return new Float32Array(flatenedTangents);
}

export function createTangentsFromFloatArray(
    floats: Float32Array,
    vertexCount: number,
    layoutSize: number = DEF_LAYOUT_SIZE_FLOAT,
    positionInLayout: number = DEF_POSITION_INDEX_FLOAT,
    uvInLayout: number = DEF_UV_INDEX_FLOAT
) {
    let [positions, uvs] = extractPositionsAndUvs(floats, vertexCount, layoutSize, positionInLayout, uvInLayout);
    let tangents = createTangents(positions, uvs)
    return new Float32Array(tangents);
}

function extractPositionsAndUvs(
    floats: Float32Array,
    vertexCount: number,
    layoutSize: number,
    positionInLayout: number,
    uvInLayout: number
): [positions: Vec3[], uvs: Vec2[]] {
    if (floats.length != layoutSize * vertexCount)
        throw new Error(`the parameters don't fit together`);

    let positions: Vec3[] = [];
    let uvs: Vec2[] = [];

    // extracting the position and uv coordinates from every "vertex"
    for (let i = 0; i < floats.length; i += layoutSize) {
        let vertexObj = floats.slice(i, i + layoutSize);
        positions.push(vertexObj.slice(positionInLayout, positionInLayout + 3));
        uvs.push(vertexObj.slice(uvInLayout, uvInLayout + 2));
    }
    return [positions, uvs]
}

// this function is more efficient and robust than the bottom one
function calcTangents(p0: Vec3, p1: Vec3, p2: Vec3, uv0: Vec2, uv1: Vec2, uv2: Vec2, flipHandedness: boolean = true): [tangent: Vec3, biTangent: Vec3] {
    const edge1 = vec3.subtract(p1, p0);
    const edge2 = vec3.subtract(p2, p0);

    const d_uv1 = vec2.subtract(uv1, uv0);
    const d_uv2 = vec2.subtract(uv2, uv0);

    const inv_det = 1 / (d_uv1[0] * d_uv2[1] - d_uv1[1] * d_uv2[0]);

    const tangent = vec3.mulScalar(vec3.add(vec3.mulScalar(edge1, d_uv2[1]), vec3.mulScalar(edge2, -d_uv1[1])), inv_det);
    const biTangent = vec3.mulScalar(vec3.add(vec3.mulScalar(edge1, -d_uv2[0]), vec3.mulScalar(edge2, d_uv1[0])), flipHandedness ? -inv_det : inv_det);

    return [tangent, biTangent];
}

// this method should! give the same results as the above one
// but is better readable as it explicitly constructs the matrices etc.
// to follow the math see 
// https://learnopengl.com/Advanced-Lighting/Normal-Mapping 
function calcTangents_alt(p0: Vec3, p1: Vec3, p2: Vec3, uv0: Vec2, uv1: Vec2, uv2: Vec2, flipHandedness: boolean = true): [tangent: Vec3, biTangent: Vec3] {
    const edge1 = vec3.subtract(p1, p0);
    const edge2 = vec3.subtract(p2, p0);

    const d_uv1 = vec2.subtract(uv1, uv0);
    const d_uv2 = vec2.subtract(uv2, uv0);

    // use determiant rule for matrix inversion 
    const inv_det = 1 / (d_uv1[0] * d_uv2[1] - d_uv1[1] * d_uv2[0]);

    const inv_uv_mat =
        [
            inv_det * d_uv2[1], -inv_det * d_uv1[1],
            -inv_det * d_uv2[0], inv_det * d_uv1[0],
        ];

    // wgpu-matrix doesn't support Mat2 or none quadric matrices
    const mat2_mult = (mat: number[], x: number[]) => {
        return [
            mat[0] * x[0] + mat[1] * x[1],
            mat[2] * x[0] + mat[3] * x[1]
        ]
    };

    const [Tx, Bx] = mat2_mult(inv_uv_mat, [edge1[0], edge2[0]]);
    const [Ty, By] = mat2_mult(inv_uv_mat, [edge1[1], edge2[1]]);
    const [Tz, Bz] = mat2_mult(inv_uv_mat, [edge1[2], edge2[2]]);

    return [[Tx, Ty, Tz], flipHandedness ? [-Bx, -By, -Bz] : [Bx, By, Bz]];
}

export function test_tangents_implementations_are_equal() {
    let uv0 = [0.3, 0];
    let uv1 = [1, 0];
    let uv2 = [1, 1];

    let p0 = [0.5, 1, 0];
    let p1 = [0, 0, 0];
    let p2 = [1, 0, 0];

    let [tangent1, bitangent1] = calcTangents(p0, p1, p2, uv0, uv1, uv2, true);
    let [tangent2, bitangent2] = calcTangents_alt(p0, p1, p2, uv0, uv1, uv2, true);

    let tangentDiff = vec3.len(vec3.sub(tangent1, tangent2));
    let biTangentDiff = vec3.len(vec3.sub(bitangent1, bitangent2));

    const tol = 1e-7;
    if (tangentDiff > tol)
        console.error(`tangents differ by ${tangentDiff}`);

    if (biTangentDiff > tol)
        console.error(`bitangents differ by ${biTangentDiff}`);

}