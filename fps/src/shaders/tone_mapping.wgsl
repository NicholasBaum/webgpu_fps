fn ACESFilm(x : vec3f) -> vec3f{
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0), vec3f(1));
}

fn Reinhard(x : vec3f) -> vec3f{
    return x / (x + vec3(1.0));
}

fn gammaEncode(x : vec3f) -> vec3f{
    return pow(x, vec3(1.0 / 2.2));
}
