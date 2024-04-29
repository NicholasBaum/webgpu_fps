import { InstancesBuffer } from "../primitives/instancesBuffer";
import { IModelInstance } from "../modelInstance";
import { ShadowMap } from "./shadowMap";
import { groupBy } from "../../helper/groupBy";
import { Scene } from "../scene";
import { ShadowMapBuilder } from "./shadowMapBuilder";

import SHADER from '../../shaders/shadow_map_renderer.wgsl';

export async function createShadowMapRendererAsync(device: GPUDevice, scene: Scene, shadowMap: ShadowMapBuilder) {
    return await new ShadowMapRenderer(device, scene.models, shadowMap.maps).buildAsync(device);
}

export class ShadowMapRenderer {

    private shadowPipeline!: GPURenderPipeline;
    private renderGroups!: InstancesBuffer[];
    private lightBuffer!: GPUBuffer;

    constructor(
        private device: GPUDevice,
        private models: IModelInstance[],
        private shadowMaps: ShadowMap[]
    ) { }

    async buildAsync(device: GPUDevice) {
        this.shadowPipeline = await createShadowPipelineAsync(device);
        this.renderGroups = [...groupBy(this.models, x => x.vertexBuffer).values()].map(x => new InstancesBuffer(x));
        this.renderGroups.forEach(x => x.writeToGpu(device));
        this.writeToGpu(device);
        return this;
    }

    addPass(encoder: GPUCommandEncoder) {
        const device = this.device;
        // recreate in case lights have moved
        this.shadowMaps.forEach(map => map.createViewMat());
        this.writeToGpu(device);
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
            for (let group of this.renderGroups) {
                group.writeToGpu(device);
                const vertexBuffer = group.vertexBuffer;
                pass.setPipeline(this.shadowPipeline);
                pass.setBindGroup(0, createShadowMapBindGroup(device, this.shadowPipeline, group.buffer, lightBuffer), [i * MIN_UNIFORM_BUFFER_STRIDE]);
                pass.setVertexBuffer(0, vertexBuffer.buffer);
                pass.draw(vertexBuffer.vertexCount, group.length);
            }
            pass.end();
        });
    }

    private writeToGpu(device: GPUDevice) {
        if (!this.lightBuffer) {
            this.lightBuffer = device.createBuffer({
                label: `light view buffer`,
                size: MIN_UNIFORM_BUFFER_STRIDE * this.shadowMaps.length,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
        }
        for (let i = 0; i < this.shadowMaps.length; i++) {
            let map = this.shadowMaps[i];
            device.queue.writeBuffer(this.lightBuffer, i * MIN_UNIFORM_BUFFER_STRIDE, map.light_mat as Float32Array);
        }
    }
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
    let shaderModule = device.createShaderModule({ label: "shadow shader", code: SHADER });

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
