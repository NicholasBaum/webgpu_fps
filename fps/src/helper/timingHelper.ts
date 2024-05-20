function assert(cond: boolean, msg = '') {
    if (!cond) {
        throw new Error(msg);
    }
}

export class TimingHelper {
    private canTimestamp;
    private device;
    private querySet;
    private resolveBuffer;
    private resultBuffer?: GPUBuffer;
    private resultBuffers: GPUBuffer[] = [];
    // state can be 'free', 'need resolve', 'wait for result'
    #state = 'free';

    constructor(device: GPUDevice) {
        this.device = device;
        this.canTimestamp = device.features.has('timestamp-query');
        this.querySet = device.createQuerySet({
            type: 'timestamp',
            count: 2,
        });
        this.resolveBuffer = device.createBuffer({
            size: this.querySet.count * 8,
            usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
        });
    }

    private beginTimestampPass(encoder: any, fnName: string, descriptor: GPURenderPassDescriptor | GPUComputePassDescriptor) {
        if (this.canTimestamp) {
            assert(this.#state === 'free', 'state not free');
            this.#state = 'need resolve';

            const pass = encoder[fnName]({
                ...descriptor,
                ...{
                    timestampWrites: {
                        querySet: this.querySet,
                        beginningOfPassWriteIndex: 0,
                        endOfPassWriteIndex: 1,
                    },
                },
            });

            const resolve = () => this.resolveTiming(encoder);
            pass.end = (function (origFn) {
                return function (this: any) {
                    origFn.call(this);
                    resolve();
                };
            })(pass.end);

            return pass;
        } else {
            return encoder[fnName](descriptor);
        }
    }

    beginRenderPass(encoder: GPUCommandEncoder, descriptor: GPURenderPassDescriptor) {
        return this.beginTimestampPass(encoder, 'beginRenderPass', descriptor);
    }

    beginComputePass(encoder: GPUCommandEncoder, descriptor: GPUComputePassDescriptor = {}) {
        return this.beginTimestampPass(encoder, 'beginComputePass', descriptor);
    }

    private resolveTiming(encoder: GPUCommandEncoder) {
        if (!this.canTimestamp) {
            return;
        }
        assert(this.#state === 'need resolve', 'must call addTimestampToPass');
        this.#state = 'wait for result';

        this.resultBuffer = this.resultBuffers.pop() || this.device.createBuffer({
            size: this.resolveBuffer.size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        encoder.resolveQuerySet(this.querySet, 0, this.querySet.count, this.resolveBuffer, 0);
        encoder.copyBufferToBuffer(this.resolveBuffer, 0, this.resultBuffer, 0, this.resultBuffer.size);
    }

    async getResultAsync(): Promise<number> {
        if (!this.canTimestamp) {
            return 0;
        }
        assert(this.#state === 'wait for result', 'must call resolveTiming');
        this.#state = 'free';

        const resultBuffer = this.resultBuffer;
        if (!resultBuffer)
            throw new Error('getResult before reolveTiming was called');
        await resultBuffer.mapAsync(GPUMapMode.READ);
        const times = new BigInt64Array(resultBuffer.getMappedRange());
        const duration = Number(times[1] - times[0]);
        resultBuffer.unmap();
        this.resultBuffers.push(resultBuffer);
        return duration / 1e+6;
    }
}