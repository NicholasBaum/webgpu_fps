import { InstancesGroup } from "../primitives/instancesBuffer";
import { IModelInstance } from "../modelInstance";
import { ShadowMap } from "./shadowMap";
import { groupBy } from "../../helper/groupBy";
import { Scene } from "../scene";
import { ShadowMapBuilder } from "./shadowMapBuilder";
import { NewPipeBuilder, PipeOptions } from "../renderer/newPipeBuilder";
import { DEF_TOPOLOGY, DEF_VERTEX_BUFFER_LAYOUT } from "../../meshes/defaultLayout";
import { BindGroupBuilder } from "../renderer/bindGroupBuilder";

export async function createShadowMapRendererAsync(device: GPUDevice, scene: Scene, shadowMap: ShadowMapBuilder) {
    return await new ShadowMapRenderer(device, scene.models, shadowMap.maps).buildAsync(device);
}

//TODO: needs to be derived from the device    
const MIN_UNIFORM_BUFFER_STRIDE = 256;

export class ShadowMapRenderer {

    private renderGroups!: InstancesGroup[];
    private lightBuffer!: GPUBuffer;
    private _pipe: NewPipeBuilder;

    constructor(
        private device: GPUDevice,
        private models: IModelInstance[],
        private shadowMaps: ShadowMap[]
    ) {
        let opt: PipeOptions = {
            label: `Shadow Map Pipeline`,
            aaSampleCount: 1,
            cullMode: 'back',
            depthStencilState: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth32float',
            }
        };
        this._pipe = new NewPipeBuilder({ vertex: SHADER }, DEF_VERTEX_BUFFER_LAYOUT, DEF_TOPOLOGY, opt)
            .addBindGroup(x => x
                .addBuffer('read-only-storage')
                .addBuffer('uniform', GPUShaderStage.VERTEX, true)
            );
    }

    async buildAsync(device: GPUDevice) {
        this.renderGroups = [...groupBy(this.models, x => x.vertexBuffer).values()].map(x => new InstancesGroup(x));
        this.renderGroups.forEach(x => x.writeToGpu(device));
        this.writeToGpu(device);
        await this._pipe.buildAsync(device);
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
                pass.setPipeline(this._pipe.actualPipeline!);
                let bindGroup = new BindGroupBuilder(device, this._pipe.actualPipeline!)
                    .addBuffer(group)
                    .addBuffer(lightBuffer, MIN_UNIFORM_BUFFER_STRIDE)
                    .getBindGroups()[0];
                pass.setBindGroup(0, bindGroup, [i * MIN_UNIFORM_BUFFER_STRIDE]);
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

const SHADER = `
struct Instance
{
    transform : mat4x4 < f32>,
    normal_mat : mat4x4 < f32>,
}

@group(0) @binding(0) var<storage, read> instances : array<Instance>;
@group(0) @binding(1) var<uniform> lightView_mat : mat4x4 < f32>;

@vertex
fn vertexMain(@builtin(instance_index) idx : u32, @location(0) position : vec3 < f32>) -> @builtin(position) vec4 < f32>
{
    return lightView_mat * instances[idx].transform * vec4(position, 1);
}
`