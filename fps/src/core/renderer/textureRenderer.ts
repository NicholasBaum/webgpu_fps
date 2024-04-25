import { VertexBufferObject } from "../primitives/vertexBufferObject";
import { NextRendererBase } from "./nextRenderer";
import BindGroupBuilder, * as BGB from "./bindGroupBuilder";
import { Texture } from "../primitives/texture";
import { NewPipeBuilder } from "./newPipeBuilder";

export async function createTextureRenderer(device: GPUDevice, texture: Texture, canvasWidth: number, canvasHeight: number, sampler?: GPUSampler): Promise<TextureRenderer> {
    let renderer = new TextureRenderer(texture, canvasWidth, canvasHeight, sampler);
    await renderer.buildAsync(device);
    return renderer;
}

export class TextureRenderer extends NextRendererBase {

    get newPipeBuilder(): NewPipeBuilder { return this._newPipeBuilder; }
    private _newPipeBuilder: NewPipeBuilder;
    private vbo: VertexBufferObject;
    private textureBinding: BGB.TextureBinding;

    constructor(texture: Texture, canvasWidth: number, canvasHeight: number, sampler?: GPUSampler) {
        super(1);

        let fragmentConstants: Record<string, number> = {
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
        };

        this.vbo = createQuadVertexBuffer();

        let bindGroup01 = new BindGroupBuilder();
        this.textureBinding = BGB.createTexture(texture);
        let samplerBinding = BGB.createSampler(sampler ?? {
            addressModeU: 'repeat',
            addressModeV: 'repeat',
            magFilter: 'nearest',
            minFilter: 'nearest',
        });
        bindGroup01.addRange(...[this.textureBinding, samplerBinding])

        const label = `Texture Renderer`;
        let newPipe = new NewPipeBuilder(SHADER, { fragmentConstants, label });
        newPipe.addVertexBuffer(this.vbo);
        newPipe.addBindGroup(bindGroup01);
        this._newPipeBuilder = newPipe
    }

    async buildAsync(device: GPUDevice) {
        this.vbo.writeToGpu(device);
        await this._newPipeBuilder.buildAsync(device);
    }

    setTexture(texture: Texture) {
        let newBinding = BGB.createTexture(texture)
        this.bindGroups[0].replace(this.textureBinding, newBinding);
        this.textureBinding = newBinding;
    }
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