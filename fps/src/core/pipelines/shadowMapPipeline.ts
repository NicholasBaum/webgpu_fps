import shadowShader from '../../shaders/shadow_map_renderer.wgsl';

export function createShadowMapBindGroup(
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    instancesBuffer: GPUBuffer,
    lightViewBuffer: GPUBuffer,
): GPUBindGroup {

    let desc: { label: string, layout: GPUBindGroupLayout, entries: GPUBindGroupEntry[] } = {
        label: "shadow map binding group",
        layout: pipeline.getBindGroupLayout(0),
        entries:
            [
                {
                    binding: 0,
                    resource: { buffer: instancesBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: lightViewBuffer, size: 256 }
                },
            ]
    };
    return device.createBindGroup(desc);
}

const VERTEX_BUFFER_LAYOUT: GPUVertexBufferLayout = {
    // using the default vertices and it's format but ignoring the remaining data locations
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
            buffer: { type: "read-only-storage" }
        },
        {
            binding: 1, // lights view
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "uniform", hasDynamicOffset: true }
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

