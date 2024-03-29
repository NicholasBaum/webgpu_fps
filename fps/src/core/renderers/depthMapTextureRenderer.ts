import { TextureRenderer } from './textureRenderer';

export class DepthMapTextureRenderer extends TextureRenderer {

    protected override createBindGroup(textureView: GPUTextureView) {
        let desc: { label: string, layout: GPUBindGroupLayout, entries: GPUBindGroupEntry[] } = {
            label: "depth map renderer binding group",
            layout: this.pipeline.getBindGroupLayout(0),
            entries:
                [
                    {
                        binding: 0,
                        resource: textureView,
                    },
                ]
        };

        return this.device.createBindGroup(desc);
    }

    protected override getBindGroupLayoutEntries(): GPUBindGroupLayoutEntry[] {
        return [
            {
                binding: 0, // texture
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: 'depth',
                    //viewDimension: '2d',
                    //multisampled: false,
                }
            },
        ];
    }

    protected override getShader(): string {
        return SHADER;
    }
}

const SHADER = `
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