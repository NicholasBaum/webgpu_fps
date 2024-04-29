import { IBufferObject } from "../primitives/bufferObjectBase";
import { getDepthSampler, getLinearSampler, getNearestSampler } from "./newPipeBuilder";

export class BindGroupBuilder {

    private groups: { getEntry: (index: number) => GPUBindGroupEntry }[][] = [[]];
    private get current() {
        this.rebuildRequired = true;
        return this.groups[this.groups.length - 1];
    }

    private build: GPUBindGroup[] | undefined;
    private rebuildRequired = true;

    constructor(private _device: GPUDevice, private _pipeline: GPURenderPipeline, public label?: string) { }

    getBindGroups(): GPUBindGroup[] {
        if (!this.build || this.rebuildRequired)
            this.build = this.createBindGroups();
        return this.build;
    }

    createBindGroups(): GPUBindGroup[] {
        this.build = this.groups.map((g, i) =>
            this._device.createBindGroup({
                layout: this._pipeline.getBindGroupLayout(i),
                entries: g.map((e, i) => e.getEntry(i)),
                label: `BindGroup ${i} of ${this.label}`
            }));
        this.rebuildRequired = false;
        return this.build;
    }

    addGroup(): BindGroupBuilder {
        this.groups.push([]);
        return this;
    }

    addBuffer(...buffers: IBufferObject[]): BindGroupBuilder {
        for (let b of buffers) {
            this.current.push({
                getEntry: i => {
                    return {
                        binding: i,
                        resource: { buffer: b.buffer }
                    }
                }
            });
        }
        return this;
    }

    addTexture(texture: GPUTextureView): BindGroupBuilder {
        this.current.push({
            getEntry: i => {
                return {
                    binding: i,
                    resource: texture,
                }
            }
        });
        return this;
    }

    addSampler(sampler: GPUSampler | GPUSamplerDescriptor): BindGroupBuilder {
        this.current.push({
            getEntry: i => {
                return {
                    binding: i,
                    resource: sampler instanceof GPUSampler ? sampler : this._device.createSampler(sampler)
                }
            }
        });
        return this;
    }

    addLinearSampler(): BindGroupBuilder {
        this.current.push({
            getEntry: i => {
                return {
                    binding: i,
                    resource: getLinearSampler(this._device)
                }
            }
        });
        return this;

    }
    addNearestSampler(): BindGroupBuilder {
        this.current.push({
            getEntry: i => {
                return {
                    binding: i,
                    resource: getNearestSampler(this._device)
                }
            }
        });
        return this;
    }

    addDepthSampler(): BindGroupBuilder {
        this.current.push({
            getEntry: i => {
                return {
                    binding: i,
                    resource: getDepthSampler(this._device)
                }
            }
        });
        return this;
    }

    when(predicate: boolean, fct: (x: BindGroupBuilder) => BindGroupBuilder) {
        return predicate ? fct(this) : this;
    }
}