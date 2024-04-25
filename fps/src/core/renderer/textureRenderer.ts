import { VertexBufferObject } from "../primitives/vertexBufferObject";
import { NextRenderer } from "./nextRenderer";
import BindGroupBuilder, * as BGB from "../pipeline/bindGroupBuilder";
import { Texture } from "../primitives/texture";

export async function createTextureRenderer(device: GPUDevice, texture: Texture, canvasWidth: number, canvasHeight: number, sampler?: GPUSampler): Promise<NextRenderer> {

    let constants: Record<string, number> = {
        canvasWidth: canvasWidth,
        canvasHeight: canvasHeight,
    };

    let vbo = createQuadVertexBuffer();
    vbo.writeToGpu(device);

    let bindGroup01 = new BindGroupBuilder();
    let textureEl = BGB.createTexture(texture);
    let samplerEl = BGB.createSampler(sampler ?? device.createSampler({
        addressModeU: 'repeat',
        addressModeV: 'repeat',
        magFilter: 'nearest',
        minFilter: 'nearest',
    }));
    bindGroup01.addRange(...[textureEl, samplerEl])

    let renderer = new NextRenderer(SHADER, 1, { constants });
    renderer.addVertexBuffer(vbo);
    renderer.addBindGroup(bindGroup01);
    await renderer.buildAsync(device);

    return renderer;
}

function createQuadVertexBuffer() {
    const vertices = new Float32Array([
        -1.0, -1.0, 0.0, 1.0,
        1.0, -1.0, 0.0, 1.0,
        -1.0, 1.0, 0.0, 1.0,
        -1.0, 1.0, 0.0, 1.0,
        1.0, -1.0, 0.0, 1.0,
        1.0, 1.0, 0.0, 1.0,
    ]);

    let vertexBufferLayout: GPUVertexBufferLayout = {
        arrayStride: 16,
        attributes: [
            {
                format: "float32x4",
                offset: 0,
                shaderLocation: 0,
            },
        ]
    };

    return new VertexBufferObject(vertices, 6, vertexBufferLayout, 'triangle-list', `Quad VBO`);
}

const SHADER = `
override canvasWidth : f32 = 1920.0;
override canvasHeight : f32 = 1080.0;

@group(0) @binding(0) var texture : texture_2d<f32>;
@group(0) @binding(1) var textureSampler : sampler;

@vertex
fn vertexMain(@location(0) position : vec4f) -> @builtin(position) vec4f {
    return position;
}

@fragment
fn fragmentMain(@builtin(position) fragCoord : vec4f)
-> @location(0) vec4f {
    return textureSample(texture, textureSampler, fragCoord.xy  / vec2<f32>(canvasWidth, canvasHeight));
}
`;