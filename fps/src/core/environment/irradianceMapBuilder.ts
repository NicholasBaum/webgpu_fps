import { createComputePipe, createStorageTexture } from "../compute/computeBuilder"
import { BindGroupBuilder } from "../renderer/bindGroupBuilder";
import SH2 from "../../shaders/sh.wgsl"
import { TimingHelper } from "../../helper/timingHelper";

export async function createIrradianceMap(device: GPUDevice, source: GPUTexture, size: number = 64, useTiming = false): Promise<GPUTexture> {

    const timers = useTiming ? Array(3).fill(null).map(x => new TimingHelper(device)) : undefined;

    const workgroupsLayout = [6, 4, 6];
    const clusterSize = [Math.floor(source.width / workgroupsLayout[0]), Math.floor(source.height / workgroupsLayout[1])];
    const format = source.format;
    const target = createStorageTexture(device, [size, size, 6], format);
    const calcPipe = await createComputePipe(device, CALCSHADER(format, workgroupsLayout, clusterSize), 'calculate irradiance map compute pipeline')
    const reducePipe = await createComputePipe(device, REDUCESHADER(format, workgroupsLayout, clusterSize), 'reduce clusters irradiance map compute pipeline')
    const writePipe = await createComputePipe(device, WRITESHADER(format, workgroupsLayout, clusterSize), 'write irradiance map compute pipeline')
    const clusterBuffer = device.createBuffer({
        size: (workgroupsLayout[0] * workgroupsLayout[1] * workgroupsLayout[2]) * (9 * 3 * 4 + 4),
        usage: GPUBufferUsage.STORAGE
    });

    const bg1 = new BindGroupBuilder(device, calcPipe)
        .addTexture(source.createView())
        .addBuffer(clusterBuffer)
        .createBindGroup();

    const shb3Buffer = device.createBuffer({
        size: 9 * 3 * 4,
        usage: GPUBufferUsage.STORAGE

    });

    const bg2 = new BindGroupBuilder(device, reducePipe)
        .addBuffer(clusterBuffer)
        .addBuffer(shb3Buffer)
        .createBindGroup();

    const bg3 = new BindGroupBuilder(device, writePipe)
        .addBuffer(shb3Buffer)
        .addTexture(target.createView())
        .createBindGroup();

    const enc = device.createCommandEncoder();

    const pass1 = timers ? timers[0].beginComputePass(enc) : enc.beginComputePass();
    pass1.setPipeline(calcPipe);
    pass1.setBindGroup(0, bg1);
    pass1.dispatchWorkgroups(workgroupsLayout[0], workgroupsLayout[1], workgroupsLayout[2]);
    pass1.end();

    const pass2 = timers ? timers[1].beginComputePass(enc) : enc.beginComputePass();
    pass2.setPipeline(reducePipe);
    pass2.setBindGroup(0, bg2);
    pass2.dispatchWorkgroups(1);
    pass2.end();

    const pass3 = timers ? timers[2].beginComputePass(enc) : enc.beginComputePass();
    pass3.setPipeline(writePipe);
    pass3.setBindGroup(0, bg3);
    pass3.dispatchWorkgroups(size / 16, size / 16, 6);
    pass3.end();

    device.queue.submit([enc.finish()])
    await device.queue.onSubmittedWorkDone();

    clusterBuffer.destroy();
    shb3Buffer.destroy();
    if (timers) {
        const times = await Promise.all(timers.map(x => x.getResultAsync()));
        console.log(`Compute Multi Pass ${times.reduce((acc, x) => acc + x).toFixed(2)}`);
        console.log(`Compute First Pass ${times[0].toFixed(2)}`);
        console.log(`Compute Second Pass ${times[1].toFixed(2)}`);
        console.log(`Compute Third Pass ${times[2].toFixed(2)}`);
    }
    return target;
}



const CALCSHADER = (format: GPUTextureFormat, workgroupsLayout: number[], clusterSize: number[]) => `
@group(0) @binding(0) var sourceTexture: texture_2d_array<f32>;
@group(0) @binding(1) var<storage, read_write> clusters: array<array<array<Cluster, workgroups_layout.z>, workgroups_layout.y>, workgroups_layout.x>;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id : vec3u)
{
   clusters[id.x][id.y][id.z] = calcCluster(id, sourceTexture);
}
`+ attachSH(format, workgroupsLayout, clusterSize);



const REDUCESHADER = (format: GPUTextureFormat, workgroupsLayout: number[], clusterSize: number[]) => `
@group(0) @binding(0) var<storage, read> clusters: array<array<array<Cluster, workgroups_layout.z>, workgroups_layout.y>, workgroups_layout.x>;
@group(0) @binding(1) var<storage, read_write> shb3: SHB3;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id : vec3u)
{
    shb3 = reduceClusters(clusters);
}
`+ attachSH(format, workgroupsLayout, clusterSize);



const WRITESHADER = (format: GPUTextureFormat, workgroupsLayout: number[], clusterSize: number[]) => `
@group(0) @binding(0) var<storage, read> shb3: SHB3;
@group(0) @binding(1) var targetTexture: texture_storage_2d_array<${format}, write>;

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) id : vec3u)
{    
    let size = textureDimensions(targetTexture);
    //size in worldspace on a 2x2x2 cube
    let pixelSize = 2 / f32(size.x);
    writePixel(id.x, id.y, id.z, pixelSize);
}

fn writePixel(i : u32, j : u32, l : u32, pixelSize : f32)
{
   let coord = getCoords(i, j, l, pixelSize);
   let color = getIrradianceAt(normalize(coord), shb3) / PI;
   textureStore(targetTexture, vec2u(i, j), l, vec4f(color, 1));
}
`+ attachSH(format, workgroupsLayout, clusterSize);


function attachSH(format: GPUTextureFormat, workgroupsLayout: number[], clusterSize: number[]) {
    return SH2
        .replace(/{{TARGET_FORMAT}}/g, format)
        .replace(/{{WORKGROUPS_LAYOUT}}/g, `vec3u(${workgroupsLayout[0]},${workgroupsLayout[1]},${workgroupsLayout[2]})`)
        .replace(/{{CLUSTER_SIZE}}/g, `vec2u(${clusterSize[0]},${clusterSize[1]})`);
}