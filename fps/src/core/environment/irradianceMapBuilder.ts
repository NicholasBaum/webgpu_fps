import { createComputePipe, createStorageTexture } from "../compute/computeBuilder"
import { BindGroupBuilder } from "../renderer/bindGroupBuilder";
import SH from "../../shaders/spherical_harmonics.wgsl"

export async function createIrradianceMap(device: GPUDevice, source: GPUTexture, size: number = 64): Promise<GPUTexture> {
    const format = source.format;
    const target = createStorageTexture(device, [size, size, 6], format);
    const pipe = await createComputePipe(device, SHADER(format), 'irradiance map compute pipeline')
    const bg = new BindGroupBuilder(device, pipe)
        .addTexture(source.createView())
        .addTexture(target.createView())
        .createBindGroup();

    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pipe);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(1);
    pass.end();
    device.queue.submit([enc.finish(pass)])

    await device.queue.onSubmittedWorkDone();

    return target;
}


const SHADER = (format: GPUTextureFormat) => `
@group(0) @binding(0) var sourceTexture: texture_2d_array<f32>;
@group(0) @binding(1) var targetTexture: texture_storage_2d_array<${format}, write>;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id : vec3u)
{
    createSH(sourceTexture, targetTexture);
}
`+ SH.replace(/{{TARGET_FORMAT}}/g, format);