struct VertexOut_alt
{
    @builtin(position) position : vec4f,
    @location(0) vColor : vec4f,
    @location(1) uv : vec2f,
    @location(2) worldPosition : vec4f,
    @location(3) worldNormal : vec3f,
    @location(4) shadowPos : vec3f,
}

@vertex
fn vertexMain_alt
(
@builtin(instance_index) idx : u32,
@location(0) pos : vec4f,
@location(1) color : vec4f,
@location(2) uv : vec2f,
@location(3) normal : vec4f,
) -> VertexOut_alt
{
    let worldPos = models[idx].transform * pos;
    let worldNormal = (models[idx].normal_mat * vec4f(normal.xyz, 0)).xyz;

    let shadowPos = uni.lights[0].shadow_mat * worldPos;//potentially 0 if no shadowmap exists
    let shadowPosUV = vec3(shadowPos.xy * vec2(0.5, -0.5) + vec2(0.5), shadowPos.z);
    return VertexOut_alt(uni.viewProjectionMatrix * worldPos, color, uv, worldPos, worldNormal, shadowPosUV);
}

@fragment
fn fragmentMain_alt
(
@builtin(position) position : vec4f,
@location(0) vColor : vec4f,
@location(1) uv : vec2f,
@location(2) worldPosition : vec4f,
@location(3) worldNormal : vec3f,
@location(4) shadowPos : vec3f,
) -> @location(0) vec4f
{
    let uv_tiled = vec2f(material.mode.z * uv.x, material.mode.w * uv.y);
    return calcAllLights(uv_tiled, worldPosition, worldNormal, shadowPos);
}
