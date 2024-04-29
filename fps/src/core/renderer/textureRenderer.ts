import { BindGroupProvider } from "./bindGroupProvider";
import { VertexBufferObject } from "../primitives/vertexBufferObject";
import { BindGroupDefinition, NearestSamplerDefinition, TextureDefinition } from "./bindGroupDefinition";
import { NewPipeBuilder } from "./newPipeBuilder";

export async function createTextureRenderer(device: GPUDevice, canvasWidth: number, canvasHeight: number): Promise<TextureRenderer> {
    let renderer = new TextureRenderer(canvasWidth, canvasHeight);
    await renderer.buildAsync(device);
    return renderer;
}

export type TexRenderMode = '2d' | '2d-array-l6' | 'depth';

export class TextureRenderer {

    private tex2dRenderer: TextureRenderer2d;
    private cube2dArraydRenderer: TextureRendererCube2DArray;
    private depthRenderer: TextureRendererDepth;

    constructor(canvasWidth: number, canvasHeight: number) {
        this.tex2dRenderer = new TextureRenderer2d(canvasWidth, canvasHeight);
        this.cube2dArraydRenderer = new TextureRendererCube2DArray(canvasWidth, canvasHeight);
        this.depthRenderer = new TextureRendererDepth(canvasWidth, canvasHeight);
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

    private _vbo;
    private _pipeBuilder;
    constructor(
        canvasWidth: number,
        canvasHeight: number,
        shader: string,
        viewDimension: GPUTextureViewDimension,
        sampleType: GPUTextureSampleType,
        private useSampler: boolean,
        label?: string
    ) {
        let fragmentConstants: Record<string, number> = {
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
        };
        this._vbo = createQuadVertexBuffer();
        let textureBinding = new TextureDefinition({ sampleType: sampleType, viewDimension: viewDimension });
        let bg = new BindGroupDefinition(textureBinding);
        if (useSampler)
            bg.add(new NearestSamplerDefinition());
        this._pipeBuilder = new NewPipeBuilder(shader, { fragmentConstants, label: label })
            .setVertexBufferLayouts(this._vbo.layout, this._vbo.topology)
            .addBindGroup(bg);
    }

    private device: GPUDevice | undefined;

    async buildAsync(device: GPUDevice) {
        this.device = device;
        this._vbo.writeToGpu(device);
        await this._pipeBuilder.buildAsync(device);
    }

    render(pass: GPURenderPassEncoder, view: GPUTextureView): void {
        if (!this._pipeBuilder?.actualPipeline || !this.device)
            throw new Error(`Pipeline hasn't been built.`);
        let builder = new BindGroupProvider(this.device, this._pipeBuilder.actualPipeline!)
            .addTexture(view);
        if (this.useSampler)
            builder.addNearestSampler();

        pass.setVertexBuffer(0, this._vbo.buffer);
        pass.setBindGroup(0, builder.getBindGroups()[0]);
        pass.setPipeline(this._pipeBuilder.actualPipeline);
        pass.draw(this._vbo.vertexCount);
    }
}

export class TextureRenderer2d extends TextureRendererBase {
    constructor(canvasWidth: number, canvasHeight: number) {
        super(canvasWidth, canvasHeight, SHADER_2D, '2d', 'float', true, `Texture Renderer 2d`);
    }
}

export class TextureRendererCube2DArray extends TextureRendererBase {
    constructor(canvasWidth: number, canvasHeight: number) {
        super(canvasWidth, canvasHeight, SHADER_CUBE, '2d-array', 'float', true, `Texture Renderer Cube2DArray`);
    }
}

export class TextureRendererDepth extends TextureRendererBase {
    constructor(canvasWidth: number, canvasHeight: number) {
        super(canvasWidth, canvasHeight, SHADER_DEPTH, '2d', 'depth', false, `Texture Renderer Depth`);
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