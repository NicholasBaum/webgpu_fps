import { InstancesBufferWriter } from "../instancesBufferWriter";
import { ModelInstance } from "../modelInstance";
import { ModelAsset } from "../modelAsset";
import shadowShader from '../../shaders/shadow_map_renderer.wgsl';
import { ShadowMap } from "./shadowMap";

type RenderGroupKey = ModelAsset;

export class ShadowMapRenderer {

    private shadowPipeline!: GPURenderPipeline;
    private instanceBuffers!: InstancesBufferWriter[];
    private lightBuffer!: GPUBuffer;

    constructor(private device: GPUDevice, private models: ModelInstance[], private shadowMaps: ShadowMap[]) {

    }

    async initAsync() {
        this.shadowPipeline = await createShadowPipelineAsync(this.device);
        this.instanceBuffers = [...groupByAsset(this.models).values()].map(x => new InstancesBufferWriter(x));
        this.instanceBuffers.forEach(x => x.writeToGpu(this.device));
        this.writeToGpu();
    }

    render(encoder: GPUCommandEncoder) {
        // recreate in case lights have moved
        this.shadowMaps.forEach(map => map.createViewMat());
        this.writeToGpu();
        // render each map in a separate pass
        this.shadowMaps.forEach((map, i) => {
            const lightBuffer = this.lightBuffer;

            const desc: GPURenderPassDescriptor = {
                colorAttachments: [],
                depthStencilAttachment: {
                    view: map.textureView,
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store',
                },
            };

            const pass = encoder.beginRenderPass(desc);
            for (let b of this.instanceBuffers) {
                b.writeToGpu(this.device);
                const asset = b.instances[0].asset;
                const count = b.instances.length;

                pass.setPipeline(this.shadowPipeline);
                pass.setBindGroup(0, createShadowMapBindGroup(this.device, this.shadowPipeline, b.gpuBuffer, lightBuffer), [i * MIN_UNIFORM_BUFFER_STRIDE]);
                pass.setVertexBuffer(0, asset.vertexBuffer);
                pass.draw(asset.vertexCount, count);
            }
            pass.end();
        });
    }

    private writeToGpu() {
        if (!this.lightBuffer) {
            this.lightBuffer = this.device.createBuffer({
                label: `light view buffer`,
                size: MIN_UNIFORM_BUFFER_STRIDE * this.shadowMaps.length,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
        }
        for (let i = 0; i < this.shadowMaps.length; i++) {
            let map = this.shadowMaps[i];
            this.device.queue.writeBuffer(this.lightBuffer, i * MIN_UNIFORM_BUFFER_STRIDE, map.light_mat as Float32Array);
        }
    }
}

function groupByAsset(instances: ModelInstance[]): Map<RenderGroupKey, ModelInstance[]> {
    const getKey = (x: ModelInstance) => {
        return x.asset;
    };
    let groups: Map<RenderGroupKey, ModelInstance[]> = instances.reduce((acc, m) => {
        let key = getKey(m);
        if (!acc.has(key))
            acc.set(key, []);
        acc.get(key)?.push(m);
        return acc;
    }, new Map<RenderGroupKey, ModelInstance[]>());

    return groups;
}

//TODO: needs to be derived from the device    
const MIN_UNIFORM_BUFFER_STRIDE = 256;

function createShadowMapBindGroup(
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    instancesBuffer: GPUBuffer,
    lightViewBuffer: GPUBuffer,
): GPUBindGroup {

    let desc: { label: string, layout: GPUBindGroupLayout, entries: GPUBindGroupEntry[] } = {
        label: "shadow map shader binding group",
        layout: pipeline.getBindGroupLayout(0),
        entries:
            [
                {
                    binding: 0,
                    resource: { buffer: instancesBuffer }
                },
                {
                    binding: 1,
                    resource: { buffer: lightViewBuffer, size: MIN_UNIFORM_BUFFER_STRIDE }
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

function createShadowPipelineAsync(device: GPUDevice) {
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
