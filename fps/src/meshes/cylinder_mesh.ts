import { Vec3, vec3 } from "wgpu-matrix";

// actually a pipe aka cylinder shell...
export function CYLINDER_VERTEX_ARRAY(n = 30, rin = 0.7, rout = 1.5, height = 3, center: Vec3 = [0, 0, 0]): Float32Array {
    if (n < 2 || rin >= rout)
        throw new RangeError("arguments not valid");

    let pts = [] as Vec3[][], h = height / 2;

    for (let i = 0; i < n; i++) {
        pts.push([
            CylinderPosition(rout, i * 360 / (n - 1), h, center), // top outer point
            CylinderPosition(rout, i * 360 / (n - 1), -h, center), // bottom outer point
            CylinderPosition(rin, i * 360 / (n - 1), -h, center),
            CylinderPosition(rin, i * 360 / (n - 1), h, center)]
        );
    }

    let vertices = [] as number[], normals = [] as number[];
    let p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, p4: Vec3, p5: Vec3, p6: Vec3, p7: Vec3;
    for (let i = 0; i < n - 1; i++) {
        p0 = pts[i][0];
        p1 = pts[i][1];
        p2 = pts[i][2];
        p3 = pts[i][3];
        p4 = pts[i + 1][0];
        p5 = pts[i + 1][1];
        p6 = pts[i + 1][2];
        p7 = pts[i + 1][3];

        //vertex data
        vertices.push(...[
            //top face
            p0[0], p0[1], p0[2], p4[0], p4[1], p4[2], p7[0], p7[1], p7[2],
            p7[0], p7[1], p7[2], p3[0], p3[1], p3[2], p0[0], p0[1], p0[2],

            //bottom face
            p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p6[0], p6[1], p6[2],
            p6[0], p6[1], p6[2], p5[0], p5[1], p5[2], p1[0], p1[1], p1[2],

            //outer face
            p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p5[0], p5[1], p5[2],
            p5[0], p5[1], p5[2], p4[0], p4[1], p4[2], p0[0], p0[1], p0[2],

            //inner face
            p2[0], p2[1], p2[2], p3[0], p3[1], p3[2], p7[0], p7[1], p7[2],
            p7[0], p7[1], p7[2], p6[0], p6[1], p6[2], p2[0], p2[1], p2[2]
        ]);

        //normal data


        normals.push(...[
            //top face
            0, 1, 0, 0, 1, 0, 0, 1, 0,
            0, 1, 0, 0, 1, 0, 0, 1, 0,

            //bottom face
            0, -1, 0, 0, -1, 0, 0, -1, 0,
            0, -1, 0, 0, -1, 0, 0, -1, 0,          
        ]);
        
        let outerTangent = [p0[0] - p4[0], 0, p0[2] - p4[2]];
        let outerNormal = vec3.normalize([-outerTangent[2], 0, outerTangent[0]]);
        let innerNormal = vec3.mulScalar(outerNormal, -1);
        for (let i = 0; i < 6; i++) {
            normals.push(...outerNormal);
        }
        for (let i = 0; i < 6; i++) {
            normals.push(...innerNormal);
        }
    }

    const chunkSize = 3;
    let data: number[] = [];
    for (let i = 0; i < vertices.length; i = i + chunkSize) {
        data.push(...vertices.slice(i, i + chunkSize));
        data.push(...[1, 1, 0, 0, 1, 0, 1]); // appending for float32x4, float32x4 ,float32x2, ...
        data.push(...normals.slice(i, i + chunkSize));
        data.push(...[1]); // ... float32x4 format 
    }
    return new Float32Array(data);
}

function CylinderPosition(radius: number, theta: number, y: number, center: Vec3 = [0, 0, 0]): Vec3 {
    let sn = Math.sin(theta * Math.PI / 180);
    let cn = Math.cos(theta * Math.PI / 180);
    return vec3.fromValues(radius * cn + center[0], y + center[1], -radius * sn + center[2]);
}