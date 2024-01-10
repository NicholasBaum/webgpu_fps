// functions to calculate the tangen space
// the normals of a normalmap are usually stored in tangent space
// and need to be mapped to object space first
// it's actually less work to map lights and cameras into tangent space and do the light calculations in tangent space

// tangent space is defined by the normal of a face and more or less the u (tangent) and v (bitangent) axis of the mapped texture
// visually you can place the texture in worldspace correctly aligend to the face by its uvs and calculate the borders of the texture plane
// but if the uv's are distorted this interpretation isn't really correct anymore and the tangent and bitangent won't be perpendicular
// the length of these vectors actually indicate how distorted the uv's are, see
// https://www.reedbeta.com/blog/conformal-texture-mapping/
import { Vec2, Vec3, vec2, vec3 } from "wgpu-matrix";

export function createTangents(vertexData: Float32Array, count: number): Float32Array {

    const normalData: number[] = [];
    // float4 position, float4 color, float2 uv, float4 normal
    const size = 14;
    const getPosUV = (x: Float32Array) => { return [x.slice(0, 3), x.slice(8, 10)]; };
    // cycle through sets of 3
    for (let i = 0; i < count; i++) {
        const [p0, uv0] = getPosUV(vertexData.slice(i * size, (i + 1) * size));
        i++;
        const [p1, uv1] = getPosUV(vertexData.slice(i * size, (i + 1) * size));
        i++;
        const [p2, uv2] = getPosUV(vertexData.slice(i * size, (i + 1) * size));
        const [tangent, biTangent] = biTangentsCalc(p0, p1, p2, uv0, uv1, uv2);
        // add for every vertex the same tangents
        for (let j = 0; j < 3; j++) {
            normalData.push(...tangent);
            normalData.push(...biTangent);
        }
    }
    return new Float32Array(normalData);
}

// this function is more efficient and robust than the bottom one
function biTangentsCalc(p0: Vec3, p1: Vec3, p2: Vec3, uv0: Vec2, uv1: Vec2, uv2: Vec2, flipHandedness: boolean = true): [tangent: Vec3, biTangent: Vec3] {
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
function biTangentsCalcAlternative(p0: Vec3, p1: Vec3, p2: Vec3, uv0: Vec2, uv1: Vec2, uv2: Vec2, flipHandedness: boolean = false): [tangent: Vec3, biTangent: Vec3] {
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

function runtTest() {
    // let p0 = [0, 0, 0];
    // let p1 = [1, 0, 0];
    // let p2 = [1, 1, 0];

    let uv0 = [0.3, 0];
    let uv1 = [1, 0];
    let uv2 = [1, 1];

    let p0 = [0.5, 1, 0];
    let p1 = [0, 0, 0];
    let p2 = [1, 0, 0];

    let res1 = biTangentsCalc(p0, p1, p2, uv0, uv1, uv2);
    let res2 = biTangentsCalcAlternative(p0, p1, p2, uv0, uv1, uv2);

    console.log(res1);
    console.log(res2);
    console.log(vec3.len(vec3.sub(res1[0], res2[0])));
    console.log(vec3.len(vec3.sub(res1[1], res2[1])));
}