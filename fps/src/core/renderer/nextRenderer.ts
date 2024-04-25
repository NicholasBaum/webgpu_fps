import { NewPipeBuilder } from "./newPipeBuilder";

export abstract class NextRenderer {

    abstract get pipeBuilder(): NewPipeBuilder;

    constructor(private instanceCount = 1) { }

    get vbos() { return this.pipeBuilder.vbos }
    get bindGroups() { return this.pipeBuilder.bindGroups }
    get pipeline() { return this.pipeBuilder.pipeline }

    render(device: GPUDevice, pass: GPURenderPassEncoder, instanceCount?: number) {
        if (!this.pipeBuilder.pipeline)
            throw new Error(`Pipeline hasn't been built.`);
        this.writeToGpu(device);
        pass.setPipeline(this.pipeBuilder.pipeline);
        this.bindGroups.forEach((x, i) => { pass.setBindGroup(i, x.createBindGroup(device, this.pipeline!)) });
        this.vbos.forEach((x, i) => { pass.setVertexBuffer(i, x.buffer) });
        pass.draw(this.pipeBuilder.vbos[0].vertexCount, instanceCount ?? this.instanceCount);
    }

    writeToGpu(device: GPUDevice) {
        this.bindGroups.forEach(x => x.writeToGpu(device));
    }

    abstract buildAsync(device: GPUDevice): Promise<void>;
}