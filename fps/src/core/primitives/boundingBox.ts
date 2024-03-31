import { Mat4, Vec3, vec3 } from "wgpu-matrix";

export type BoundingBox = { min: Vec3, max: Vec3 }


export function calcBBUnion(boxes: BoundingBox[]): BoundingBox {
    let min = [0, 0, 0];
    let max = [0, 0, 0];

    for (let b of boxes) {
        vec3.min(min, b.min, min);
        vec3.max(max, b.max, max);
    }

    return { min, max };
}

export function transformBoundingBox(boundingBox: BoundingBox, transform: Mat4): BoundingBox {
    const min = vec3.clone(boundingBox.min);
    const max = vec3.clone(boundingBox.max);

    // Transform the eight corner points of the bounding box
    const corners = [
        vec3.fromValues(min[0], min[1], min[2]),
        vec3.fromValues(min[0], min[1], max[2]),
        vec3.fromValues(min[0], max[1], min[2]),
        vec3.fromValues(min[0], max[1], max[2]),
        vec3.fromValues(max[0], min[1], min[2]),
        vec3.fromValues(max[0], min[1], max[2]),
        vec3.fromValues(max[0], max[1], min[2]),
        vec3.fromValues(max[0], max[1], max[2]),
    ];

    for (const corner of corners) {
        vec3.transformMat4(corner, transform, corner);
    }

    // Recalculate the transformed bounding box
    const transformedBoundingBox = calcBoundingBoxFromPoints(corners);

    return transformedBoundingBox;
}

export function calcBoundingBoxFromPoints(points: Vec3[]): BoundingBox {
    const min = vec3.clone(points[0]);
    const max = vec3.clone(points[0]);

    for (const point of points) {
        vec3.min(min, point, min);
        vec3.max(max, point, max);
    }

    return { min, max };
}

export function calcBBCenter(boundingBox: BoundingBox) {
    const center = vec3.create();
    vec3.add(boundingBox.min, boundingBox.max, center);
    vec3.scale(center, 0.5, center);
    return center;
}

export function calcBBRadius(boundingBox: BoundingBox) {
    const radius = vec3.create();
    vec3.sub(boundingBox.max, boundingBox.min, radius);
    vec3.scale(radius, 0.5, radius);
    return radius;
}