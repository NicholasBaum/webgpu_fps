import { IBufferObject } from "../primitives/bufferObjectBase";
import { getDepthSampler, getLinearSampler, getNearestSampler } from "../renderer/newPipeBuilder";

export class BindGroupEntriesBuilder {

    private groups: GPUBindGroupEntry[][] = [[]];
    private get current() {
        this.rebuildRequired = true;
        return this.groups[this.groups.length - 1];
    }
    private get currentIndex() { return this.current.length; }

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
                entries: g,
                label: `BindGroup ${i} of ${this.label}`
            }));
        this.rebuildRequired = false;
        return this.build;
    }

    addGroup(): BindGroupEntriesBuilder {
        this.groups.push([]);
        return this;
    }

    addBuffer(...buffers: IBufferObject[]): BindGroupEntriesBuilder {
        for (let b of buffers) {
            this.current.push({
                binding: this.currentIndex,
                resource: { buffer: b.buffer }
            });
        }
        return this;
    }

    addTexture(texture: GPUTextureView): BindGroupEntriesBuilder {
        this.current.push({
            binding: this.currentIndex,
            resource: texture,
        });
        return this;
    }

    addSampler(sampler: GPUSampler | GPUSamplerDescriptor): BindGroupEntriesBuilder {
        this.current.push({
            binding: this.currentIndex,
            resource: sampler instanceof GPUSampler ? sampler : this._device.createSampler(sampler)
        });
        return this;
    }

    addLinearSampler(): BindGroupEntriesBuilder {
        this.current.push({
            binding: this.currentIndex,
            resource: getLinearSampler(this._device)
        });
        return this;

    }
    addNearestSampler(): BindGroupEntriesBuilder {
        this.current.push({
            binding: this.currentIndex,
            resource: getNearestSampler(this._device)
        });
        return this;
    }
    addDepthSampler(): BindGroupEntriesBuilder {
        this.current.push({
            binding: this.currentIndex,
            resource: getDepthSampler(this._device)
        });
        return this;
    }
}