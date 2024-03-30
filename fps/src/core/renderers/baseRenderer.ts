//render cubemap

export function renderDepthMap(device: GPUDevice, texture: GPUTextureView, renderPass: GPURenderPassEncoder, settings: { width: number, height: number, format: GPUTextureFormat, aaSampleCount: number }) {
    renderTextureMap(device, texture, renderPass, settings, 'depth');
}

export function renderDepthMapOn(device: GPUDevice, texture: GPUTextureView, target: GPUTexture) {
    renderTextureMapOn(device, texture, target, 'depth');
}

export function renderTextureMapOn(device: GPUDevice, texture: GPUTextureView, target: GPUTexture, sampleTyp: GPUTextureSampleType = 'float') {

    const settings = { width: target.width, height: target.height, format: target.format, aaSampleCount: target.sampleCount };
    // create renderpass
    const cmdEncoder = device.createCommandEncoder();
    const renderPass = cmdEncoder.beginRenderPass({
        colorAttachments: [
            {
                view: target.createView(),
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }
        ],
    });


    renderTextureMap(device, texture, renderPass, settings, sampleTyp);

    // end render if not part of a given renderPass
    cmdEncoder?.finish(renderPass.end());
}

// renders the texture to a quad
// if a RenderPassEncoder is given it will be used and kept open
export function renderTextureMap(device: GPUDevice, texture: GPUTextureView, renderPass: GPURenderPassEncoder, settings: { width: number, height: number, format: GPUTextureFormat, aaSampleCount: number }, sampleTyp: GPUTextureSampleType = 'float') {

    const { width, height, format, aaSampleCount } = settings;

    // vertex data
    const vertices = new Float32Array([
        -1.0, -1.0, 0.0, 1.0,
        1.0, -1.0, 0.0, 1.0,
        -1.0, 1.0, 0.0, 1.0,
        -1.0, 1.0, 0.0, 1.0,
        1.0, -1.0, 0.0, 1.0,
        1.0, 1.0, 0.0, 1.0,
    ]);

    const vertexBufferLayout: GPUVertexBufferLayout = {
        arrayStride: 16,
        attributes: [
            {
                format: "float32x4",
                offset: 0,
                shaderLocation: 0,
            },
        ]
    };

    const quadBuffer = device.createBuffer({ size: vertices.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });

    device.queue.writeBuffer(quadBuffer, 0, vertices as Float32Array);



    // bindGroup layout
    const bindGroupLayoutDesc: GPUBindGroupLayoutDescriptor =
    {
        entries:
            [
                {
                    binding: 0, // texture
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: sampleTyp, }
                },
                {
                    binding: 1, // sampler
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {}
                },
            ]
    };


    // create pipeline
    // create shader
    const shader = sampleTyp == 'float' ?
        device.createShaderModule({ label: "flat texture renderer", code: SHADER }) :
        device.createShaderModule({ label: "depth texture renderer", code: DEPTHSHADER });
    const bindGroupLayout = device.createBindGroupLayout(bindGroupLayoutDesc);
    const pipelineLayoutDesc = { bindGroupLayouts: [bindGroupLayout] };
    const pipelineLayout = device.createPipelineLayout(pipelineLayoutDesc);

    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: shader,
            entryPoint: 'vertexMain',
            buffers: [vertexBufferLayout],
        },
        fragment: {
            module: shader,
            entryPoint: 'fragmentMain',
            targets: [{
                format: format,
            }],
            constants: {
                canvasWidth: width,
                canvasHeight: height,
            }
        },
        primitive: {
            topology: 'triangle-list',
        },
        multisample: { count: aaSampleCount },
        depthStencil: {
            format: 'depth24plus',
            depthWriteEnabled: false,
            depthCompare: 'always',
        },
    });

    // create bindgroup
    const sampler = device.createSampler({
        addressModeU: 'repeat',
        addressModeV: 'repeat',
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        lodMinClamp: 0,
        lodMaxClamp: 4,
        maxAnisotropy: 16,
    });

    const bindGroup = device.createBindGroup({
        label: "flat texture renderer bindingGroup",
        layout: pipeline.getBindGroupLayout(0),
        entries:
            [
                {
                    binding: 0,
                    resource: texture,
                },
                {
                    binding: 1,
                    resource: sampler,
                }
            ]
    });

    // render 
    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.setVertexBuffer(0, quadBuffer);
    renderPass.draw(6, 1);
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

const DEPTHSHADER = `
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


    //transformation to make depth values distinguishable
    //const zFar = 100.0;
    //const zNear = 0.1;
    //let d = (2 * zNear) / (zFar + zNear - depthValue * (zFar - zNear));
    //return vec4 < f32 > (d, d, d, 1.0);
}
`;