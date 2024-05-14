import { createStorageTexture, createComputePipe } from "../compute/computeBuilder"
import { BindGroupBuilder } from "../renderer/bindGroupBuilder";
import SPEC from '../../shaders/specular_env_compute.wgsl'
import PBR from '../../shaders/pbr_functions.wgsl'

//Todo: doesn't sample mip maps if available
export async function createEnvironmentSpecularMap(device: GPUDevice, cubeMap: GPUTexture): Promise<GPUTexture> {

    const size = cubeMap.width;
    const mipLevels = 5;
    const target = createStorageTexture(device, [size, size, 6, mipLevels], cubeMap.format);

    for (let i = 0; i < mipLevels; i++) {
        const constants = { roughness: i / (mipLevels - 1) }
        const pipe = await createComputePipe(device, SHADER(cubeMap.format), `specular environment map builder pipeline`, constants);

        const bg = new BindGroupBuilder(device, pipe)
            .addTexture(cubeMap.createView())
            .addTexture(target.createView({ baseMipLevel: i, mipLevelCount: 1 }))
            .createBindGroup();
        const enc = device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(pipe);
        pass.setBindGroup(0, bg);
        const t = size / (16 * 2 ** i);
        pass.dispatchWorkgroups(t, t, 6);
        pass.end();
        device.queue.submit([enc.finish(pass)]);
    }
    await device.queue.onSubmittedWorkDone();

    return target;
}

const SHADER = (format: string) => SPEC.replace(/{{format}}/g, format) + PBR;