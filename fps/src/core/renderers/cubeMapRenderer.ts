import { TextureMapRenderer } from "./textureMapRenderer";

// actually renders a 6 layered 2d-array texture instead of the actual cubemap type
export class CubeMapRenderer extends TextureMapRenderer {

    constructor(
        device: GPUDevice,
        canvasWidth: number,
        canvasHeight: number,
        canvasFormat: GPUTextureFormat,
        aaSampleCount: number,
    ) {
        super(device, canvasWidth, canvasHeight, canvasFormat, aaSampleCount, { label: "CubeMapRenderer", sampleType: 'float', shader: SHADER, viewDimension: '2d-array' });
    }

}

const SHADER = `
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
    let dummy = canvasWidth*canvasHeight;
    let scale = vec2f(4.0/canvasWidth,3.0/canvasHeight);    
    const h = 1.0/3.0;    
    var layer = -1;
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
            layer = 4;
        }
        else if(f.x < 0.0)
        {
            layer = 1;
        }
        else if(f.x < 0.5)
        {
            layer = 5;
        }
        else
        {
            layer = 0;
        }        
    }
    var uv = pixelPos.xy*scale;
    // mirror images
    if(layer == 2)
    {
       uv = vec2f(uv.y,uv.x);
       uv = vec2f(1.0,1.0) + vec2f(-1.0,-1.0)*uv;
    }
    else if( layer == 3)
    {
        uv = vec2f(uv.y,uv.x);
    }
    else
    {
        uv = vec2f(1.0,0) + vec2f(-1.0,1)*uv;
    }
    return  select(textureSample(texture, textureSampler, uv, layer), vec4f(0,0,0,1), layer<0);
}
`;