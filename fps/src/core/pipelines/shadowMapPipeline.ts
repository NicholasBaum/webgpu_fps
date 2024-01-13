import shadowShader from '../../shaders/shadow_map_renderer.wgsl';

export function createShadowMapBindGroup(
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    model: GPUBuffer,
    lightView: GPUBuffer,
): GPUBindGroup {

    let desc: { label: string, layout: GPUBindGroupLayout, entries: GPUBindGroupEntry[] } = {
        label: "shadow map binding group",
        layout: pipeline.getBindGroupLayout(0),
        entries:
            [
                {
                    binding: 0,
                    resource: { buffer: model }
                },
                {
                    binding: 1,
                    resource: { buffer: lightView }
                },
            ]
    };
    return device.createBindGroup(desc);
}

const VERTEX_BUFFER_LAYOUT: GPUVertexBufferLayout = {
    // using the already loaded vertex data and just ignoring other data from the full vertex
    arrayStride: 56,
    attributes: [
        {
            format: "float32x3",
            offset: 0,
            shaderLocation: 0,
        },
    ]
};

export function createShadowPipelineAsync(device: GPUDevice) {
    let entries: GPUBindGroupLayoutEntry[] = [
        {
            binding: 0, // models
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "uniform" }
        },
        {
            binding: 1, // lights view
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "uniform" }
        },
    ];

    let bindingGroupDef = device.createBindGroupLayout({ entries: entries });
    let pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindingGroupDef] });
    let shaderModule = device.createShaderModule({ label: "shadow shader", code: shadowShader });

    let piplineDesc: GPURenderPipelineDescriptor = {
        label: "shadow map pipeline",
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: "vertexMain",
            buffers: [VERTEX_BUFFER_LAYOUT]
        },
        primitive: {
            topology: "triangle-list",
            cullMode: 'back',
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth32float',
        },
    };

    return device.createRenderPipelineAsync(piplineDesc);
}

