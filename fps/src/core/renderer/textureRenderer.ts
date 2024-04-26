import { VertexBufferObject } from "../primitives/vertexBufferObject";
import BindGroupBuilder, * as BGB from "./bindGroupBuilder";
import { Texture, TextureView } from "../primitives/texture";
import { NewPipeBuilder } from "./newPipeBuilder";

export async function createTextureRenderer(device: GPUDevice, canvasWidth: number, canvasHeight: number, sampler?: GPUSampler): Promise<TextureRenderer> {
    let renderer = new TextureRenderer(canvasWidth, canvasHeight, sampler);
    await renderer.buildAsync(device);
    return renderer;
}

export class TextureRenderer {

    private _currentPipeBuilder?: NewPipeBuilder;
    private _2dPipeBuilder: NewPipeBuilder;
    private _cubePipeBuilder: NewPipeBuilder;
    private _depthPipeBuilder: NewPipeBuilder;
    private _vbo: VertexBufferObject;

    constructor(canvasWidth: number, canvasHeight: number, sampler?: GPUSampler,) {
        let fragmentConstants: Record<string, number> = {
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
        };

        this._vbo = createQuadVertexBuffer();
        let samplerBinding = BGB.createSampler(sampler ?? {
            addressModeU: 'repeat',
            addressModeV: 'repeat',
            magFilter: 'nearest',
            minFilter: 'nearest',
        });

        const tex2d = new BGB.TextureBinding(GPUShaderStage.FRAGMENT, { sampleType: 'float', viewDimension: '2d' });
        this._2dPipeBuilder = new NewPipeBuilder(SHADER_2D, { fragmentConstants, label: `2d Texture Renderer` })
            .addVertexBuffer(this._vbo)
            .addBindGroup(new BindGroupBuilder(tex2d, samplerBinding));

        const texCube = new BGB.TextureBinding(GPUShaderStage.FRAGMENT, { sampleType: 'float', viewDimension: '2d-array' });
        this._cubePipeBuilder = new NewPipeBuilder(SHADER_CUBE, { fragmentConstants, label: `Cube Texture as 2d Array Renderer` })
            .addVertexBuffer(this._vbo)
            .addBindGroup(new BindGroupBuilder(texCube, samplerBinding));

        const texDepth = new BGB.TextureBinding(GPUShaderStage.FRAGMENT, { sampleType: 'depth', viewDimension: '2d' });
        this._depthPipeBuilder = new NewPipeBuilder(SHADER_DEPTH, { fragmentConstants, label: `Depth Texture Renderer` })
            .addVertexBuffer(this._vbo)
            .addBindGroup(new BindGroupBuilder(texDepth));
    }

    render(device: GPUDevice, pass: GPURenderPassEncoder, texture: Texture | TextureView): void {
        this.selectPipeline(texture);
        if (!this._currentPipeBuilder?.pipeline)
            throw new Error(`Pipeline hasn't been built.`);
        this._currentPipeBuilder.bindGroups.forEach(x => x.writeToGpu(device));
        pass.setPipeline(this._currentPipeBuilder.pipeline);
        this._currentPipeBuilder.bindGroups.forEach((x, i) => { pass.setBindGroup(i, x.createBindGroup(device, this._currentPipeBuilder?.pipeline!)) });
        this._currentPipeBuilder.vbos.forEach((x, i) => { pass.setVertexBuffer(i, x.buffer) });
        pass.draw(this._currentPipeBuilder.vbos[0].vertexCount);
    }

    async buildAsync(device: GPUDevice) {
        this._vbo.writeToGpu(device);
        await Promise.all([
            this._2dPipeBuilder.buildAsync(device),
            this._cubePipeBuilder.buildAsync(device),
            this._depthPipeBuilder.buildAsync(device),
        ]);
    }

    private selectPipeline(texture: Texture | TextureView) {
        const view = texture instanceof Texture ? texture.createView() : texture;
        if (view.isDepth() && view.is2d())
            this._currentPipeBuilder = this._depthPipeBuilder;
        else if (view.is2dArray() && view.layerCount == 6)
            this._currentPipeBuilder = this._cubePipeBuilder;
        else if (view.is2d())
            this._currentPipeBuilder = this._2dPipeBuilder;
        else
            throw new Error(`Texture not supported. (dim: ${view.viewDimension}, layers: ${view.layerCount}`);

        (this._currentPipeBuilder.bindGroups[0].bindings[0] as BGB.TextureBinding).setEntry(view);
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
