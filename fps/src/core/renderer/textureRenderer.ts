import { VertexBufferObject } from "../primitives/vertexBufferObject";
import BindGroupBuilder, { NearestSamplerBinding, TextureBinding } from "./bindGroupBuilder";
import { NewPipeBuilder, nearest_sampler_descriptor } from "./newPipeBuilder";

export async function createTextureRenderer(device: GPUDevice, canvasWidth: number, canvasHeight: number): Promise<TextureRenderer> {
    let renderer = new TextureRenderer(device, canvasWidth, canvasHeight);
    await renderer.buildAsync(device);
    return renderer;
}

export type TexRenderMode = '2d' | '2d-array-l6' | 'depth';

export class TextureRenderer {

    private tex2dRenderer: TextureRenderer2d;
    private cube2dArraydRenderer: TextureRendererCube2DArray;
    private depthRenderer: TextureRendererDepth;

    constructor(device: GPUDevice, canvasWidth: number, canvasHeight: number) {
        this.tex2dRenderer = new TextureRenderer2d(device, canvasWidth, canvasHeight);
        this.cube2dArraydRenderer = new TextureRendererCube2DArray(device, canvasWidth, canvasHeight);
        this.depthRenderer = new TextureRendererDepth(device, canvasWidth, canvasHeight);
    }

    render(pass: GPURenderPassEncoder, view: GPUTexture): void
    render(pass: GPURenderPassEncoder, view: GPUTextureView, mode: TexRenderMode): void
    render(pass: GPURenderPassEncoder, view: GPUTextureView | GPUTexture, mode?: TexRenderMode): void {
        if (view instanceof GPUTexture)
            [view, mode] = detect(view)
        switch (mode) {
            case '2d':
                this.tex2dRenderer.render(pass, view);
                break;
            case '2d-array-l6':
                this.cube2dArraydRenderer.render(pass, view);
                break;
            case 'depth':
                this.depthRenderer.render(pass, view);
                break;
            default:
                throw new Error(`${mode} isn't supported.`);
        }
    }

    async buildAsync(device: GPUDevice) {
        await Promise.all([
            this.tex2dRenderer.buildAsync(device),
            this.cube2dArraydRenderer.buildAsync(device),
            this.depthRenderer.buildAsync(device),
        ]);
    }
}

function detect(texture: GPUTexture): [GPUTextureView, TexRenderMode] {
    if (texture.dimension == '2d' && texture.depthOrArrayLayers == 6)
        return [texture.createView(), '2d-array-l6'];
    else
        return [texture.createView(), '2d'];
}

abstract class TextureRendererBase {

    constructor(
        protected device: GPUDevice,
        protected _vbo: VertexBufferObject,
        protected _textureBinding: TextureBinding,
        protected _pipeBuilder: NewPipeBuilder
    ) { }

    async buildAsync(device: GPUDevice) {
        this._vbo.writeToGpu(device);
        await this._pipeBuilder.buildAsync(device);
    }

    render(pass: GPURenderPassEncoder, view: GPUTextureView): void {
        if (!this._pipeBuilder?.pipeline)
            throw new Error(`Pipeline hasn't been built.`);
        
        this._textureBinding.setEntry(view);

        pass.setVertexBuffer(0, this._pipeBuilder.vbos[0].buffer);
        pass.setBindGroup(0, this._pipeBuilder.bindGroups[0].createBindGroup(this.device, this._pipeBuilder.pipeline));
        pass.setPipeline(this._pipeBuilder.pipeline);
        pass.draw(this._pipeBuilder.vbos[0].vertexCount);
    }
}

export class TextureRenderer2d extends TextureRendererBase {

    constructor(device: GPUDevice, canvasWidth: number, canvasHeight: number) {
        let fragmentConstants: Record<string, number> = {
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
        };

        let textureBinding = new TextureBinding({ sampleType: 'float', viewDimension: '2d' }, `TextureRenderer2d TextureBinding`);

        let vbo = createQuadVertexBuffer();
        let samplerBinding = new NearestSamplerBinding();

        let pipeBuilder = new NewPipeBuilder(SHADER_2D, { fragmentConstants, label: `2d Texture Renderer` })
            .addVertexBuffer(vbo)
            .addBindGroup(new BindGroupBuilder(textureBinding, samplerBinding));

        super(device, vbo, textureBinding, pipeBuilder);
    }
}

export class TextureRendererCube2DArray extends TextureRendererBase {
    constructor(device: GPUDevice, canvasWidth: number, canvasHeight: number) {
        let fragmentConstants: Record<string, number> = {
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
        };

        let textureBinding = new TextureBinding({ sampleType: 'float', viewDimension: '2d-array' }, `TextureRendererCube2DArray TextureBinding`);

        let vbo = createQuadVertexBuffer();
        let samplerBinding = new NearestSamplerBinding();

        let pipeBuilder = new NewPipeBuilder(SHADER_CUBE, { fragmentConstants, label: `Cube Texture as 2d Array Renderer` })
            .addVertexBuffer(vbo)
            .addBindGroup(new BindGroupBuilder(textureBinding, samplerBinding));

        super(device, vbo, textureBinding, pipeBuilder);
    }
}

export class TextureRendererDepth extends TextureRendererBase {
    constructor(device: GPUDevice, canvasWidth: number, canvasHeight: number) {
        let fragmentConstants: Record<string, number> = {
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
        };

        let textureBinding = new TextureBinding({ sampleType: 'depth', viewDimension: '2d' }, `TextureRendererDepth TextureBinding`);

        let vbo = createQuadVertexBuffer();

        let pipeBuilder = new NewPipeBuilder(SHADER_DEPTH, { fragmentConstants, label: `Depth Texture Renderer` })
            .addVertexBuffer(vbo)
            .addBindGroup(new BindGroupBuilder(textureBinding));

        super(device, vbo, textureBinding, pipeBuilder);
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

const SHADER_2D = `
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


const SHADER_CUBE = `
override canvasWidth : f32 = 1920.0;
override canvasHeight : f32 = 1080.0;

struct VOut
{
    @builtin(position) pixelPos : vec4f,
    @location(0) fragPos : vec4f,
}

@group(0) @binding(0) var texture : texture_2d_array  < f32>;
@group(0) @binding(1) var textureSampler : sampler;

@vertex
fn vertexMain(@location(0) position : vec4f) -> VOut {
    return VOut(position, position);
}

@fragment
fn fragmentMain(@builtin(position) pixelPos : vec4f, @location(0) f : vec4f)
-> @location(0) vec4f {
    let scale = vec2f(4.0/canvasWidth,3.0/canvasHeight);    
    const h = 1.0/3.0;    
    var layer = -1;

    // layer 0 => positive x
    // layer 1 => negative x
    // layer 2 => positive y
    // layer 3 => negative y
    // layer 4 => positive z
    // layer 5 => negative z

    if(f.y > h)
    {
        if(f.x > -0.5 && f.x < 0)
        {
            layer = 2;
        }     
    }
    else if(f.y < -h)
    {
        if(f.x > -0.5 && f.x < 0)
        {
            layer = 3;
        }
    }
    else
    {
        if(f.x < -0.5)
        {
            layer = 1;
        }
        else if(f.x < 0.0)
        {
            layer = 4;
        }
        else if(f.x < 0.5)
        {
            layer = 0;
        }
        else
        {
            layer = 5;
        }        
    }
    var uv = pixelPos.xy*scale;
    return  select(textureSample(texture, textureSampler, uv, layer), vec4f(0,0,0,1), layer<0);
}
`;


const SHADER_DEPTH = `
override canvasWidth : f32 = 1920.0;
override canvasHeight : f32 = 1080.0;

@group(0) @binding(0) var textureMap : texture_depth_2d;

@vertex
fn vertexMain(@location(0) position : vec4f) -> @builtin(position) vec4f {
    return position;
}

@fragment
fn fragmentMain(@builtin(position) fragCoord : vec4f)
-> @location(0) vec4f {
    //can't use sampler_comparison as they only return 0 or 1
    //other sampler don't seem to work
    //got to calculate pixel indices manually
    let dim = textureDimensions(textureMap, 0);
    let textureScreenRatio = vec2f(f32(dim.x) / canvasWidth, f32(dim.y) / canvasHeight);
    let depthValue = textureLoad(textureMap, vec2 < i32 > (floor(fragCoord.xy * textureScreenRatio)), 0);
    return vec4 < f32 > (depthValue, depthValue, depthValue, 1.0);


    //transformation to make depth values distingushable
    //const zFar = 100.0;
    //const zNear = 0.1;
    //let d = (2 * zNear) / (zFar + zNear - depthValue * (zFar - zNear));
    //return vec4 < f32 > (d, d, d, 1.0);
}
`;