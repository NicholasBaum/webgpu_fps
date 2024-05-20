//replace TARGET_FORMAT
//replace workgroups_layout value
const PI = 3.14159265359;
const n_SHB = 9;
const workgroups_layout = {{WORKGROUPS_LAYOUT}};
const cluster_size = {{CLUSTER_SIZE}};

struct SHB
{
    coefficients : array<f32, n_SHB >,
}

//one SHB for every color channel
struct SHB3
{
    R : SHB,
    G : SHB,
    B : SHB,
}

struct Cluster
{
    shb3 : SHB3,
    weight : f32
}

//ind: workgroup index
fn calcCluster(ind : vec3u, sourceTexture : texture_2d_array<f32>) -> Cluster
{
    let size = textureDimensions(sourceTexture);
    let x_start = ind.x * cluster_size.x;
    let x_end = min(x_start + cluster_size.x, size.x);
    let y_start = ind.y * cluster_size.y;
    let y_end = min(y_start + cluster_size.y, size.y);
    let layer = ind.z;
    var RB = SHB();
    var GB = SHB();
    var BB = SHB();
    var totalWeight = 0.0;
    let pixelSize = 2 / f32(size.x);

    for (var j = y_start; j < y_end; j++)
    {
        for (var i = x_start; i < x_end; i++)
        {
            let coord = getCoords(i, j, layer, pixelSize);
            let len = length(coord);
            let weight = 4.0 / (len * len * len);
            let base = getBase(normalize(coord));
            let color = textureLoad(sourceTexture, vec2u(i, j), layer, 0).xyz;
            totalWeight += weight;
            for(var k = 0u; k < n_SHB; k++)
            {
                RB.coefficients[k] += base.coefficients[k]* color.x * weight;
                GB.coefficients[k] += base.coefficients[k]* color.y * weight;
                BB.coefficients[k] += base.coefficients[k]* color.z * weight;
            }
        }
    }

    return Cluster(SHB3(RB, GB, BB), totalWeight);
}

fn reduceClusters(clusters : array<array<array<Cluster, workgroups_layout.z>, workgroups_layout.y>, workgroups_layout.x>) -> SHB3
{
    var RB = SHB();
    var GB = SHB();
    var BB = SHB();
    var totalWeight = 0.0;

    for(var i = 0u; i < workgroups_layout.x; i++)
    {
        for(var j = 0u; j < workgroups_layout.y; j++)
        {
            for(var z = 0u; z < workgroups_layout.z; z++)
            {
                let c = clusters[i][j][z];
                let shb = c.shb3;
                totalWeight += c.weight;
                for(var k = 0u; k < n_SHB; k++)
                {
                    RB.coefficients[k] += shb.R.coefficients[k];
                    GB.coefficients[k] += shb.G.coefficients[k];
                    BB.coefficients[k] += shb.B.coefficients[k];
                }
            }
        }
    }
    let norm = (4 * PI) / totalWeight;

    for(var k = 0u; k < n_SHB; k++)
    {
        RB.coefficients[k] *=norm;
        GB.coefficients[k] *=norm;
        BB.coefficients[k] *=norm;
    }

    return SHB3(RB, GB, BB);
}

fn createSH(sourceTexture : texture_2d_array<f32>, targetTexture : texture_storage_2d_array<{{TARGET_FORMAT}}, write>)
    {
        let shb3 = createSphericalHarmonicsFromCubemap(sourceTexture);
        writeIrradianceMap(targetTexture, shb3);
    }

    fn createSphericalHarmonicsFromCubemap(im : texture_2d_array<f32>) -> SHB3
    {
        var RB = SHB();
        var GB = SHB();
        var BB = SHB();
        let size = textureDimensions(im);
        var totalWeight = 0.0;
        let pixelSize = 2 / f32(size.x);

        for(var l = 0u; l < 6; l++)
        {
            for (var j = 0u; j < size.y; j++)
            {
                for (var i = 0u; i < size.x; i++)
                {
                    let coord = getCoords(i, j, l, pixelSize);
                    let len = length(coord);
                    let weight = 4.0 / (len * len * len);
                    let base = getBase(normalize(coord));
                    let color = textureLoad(im, vec2u(i, j), l, 0).xyz;
                    totalWeight += weight;
                    for(var k = 0u; k < n_SHB; k++)
                    {
                        RB.coefficients[k] += base.coefficients[k]* color.x * weight;
                        GB.coefficients[k] += base.coefficients[k]* color.y * weight;
                        BB.coefficients[k] += base.coefficients[k]* color.z * weight;
                    }
                }
            }
        }

        let norm = (4 * PI) / totalWeight;

        for(var k = 0u; k < n_SHB; k++)
        {
            RB.coefficients[k] *=norm;
            GB.coefficients[k] *=norm;
            BB.coefficients[k] *=norm;
        }

        return SHB3(RB, GB, BB);
    }

    fn writeIrradianceMap(im : texture_storage_2d_array<{{TARGET_FORMAT}}, write>, shb3 : SHB3)
        {
            let size = textureDimensions(im);
            let pixelSize = 2 / f32(size.x);

            for(var l = 0u; l < 6; l++)
            {
                for (var j = 0u; j < size.y; j++)
                {
                    for (var i = 0u; i < size.x; i++)
                    {
                        let coord = getCoords(i, j, l, pixelSize);
                        let color = getIrradianceAt(normalize(coord), shb3) / PI;
                        textureStore(im, vec2u(i, j), l, vec4f(color, 1));
                    }
                }
            }
        }

        fn getRadianceAt(normal : vec3f, shb3 : SHB3) -> vec3f {

            let RB = shb3.R;
            let GB = shb3.G;
            let BB = shb3.B;

            let x = normal.x;
            let y = normal.y;
            let z = normal.z;


            var rad = vec3f(RB.coefficients[0], GB.coefficients[0], BB.coefficients[0]) * 0.282095;

            rad += vec3f(RB.coefficients[1], GB.coefficients[1], BB.coefficients[1]) * 0.488603 * y;
            rad += vec3f(RB.coefficients[2], GB.coefficients[2], BB.coefficients[2]) * 0.488603 * z;
            rad += vec3f(RB.coefficients[3], GB.coefficients[3], BB.coefficients[3]) * 0.488603 * x;


            rad += vec3f(RB.coefficients[4], GB.coefficients[4], BB.coefficients[4]) * 1.092548 * x * y;
            rad += vec3f(RB.coefficients[5], GB.coefficients[5], BB.coefficients[5]) * 1.092548 * y * z;

            rad += vec3f(RB.coefficients[6], GB.coefficients[6], BB.coefficients[6]) * 0.315392 * (3.0 * z * z - 1.0);
            rad += vec3f(RB.coefficients[7], GB.coefficients[7], BB.coefficients[7]) * 1.092548 * x * z;
            rad += vec3f(RB.coefficients[8], GB.coefficients[8], BB.coefficients[8]) * 0.546274 * (x * x - y * y);

            return rad;
        }

        fn getIrradianceAt(normal : vec3f, shb3 : SHB3) -> vec3f {

            let RB = shb3.R;
            let GB = shb3.G;
            let BB = shb3.B;

            let x = normal.x;
            let y = normal.y;
            let z = normal.z;

            var rad = vec3f(RB.coefficients[0], GB.coefficients[0], BB.coefficients[0]) * 0.886227;

            rad += vec3f(RB.coefficients[1], GB.coefficients[1], BB.coefficients[1]) * 2.0 * 0.511664 * y;
            rad += vec3f(RB.coefficients[2], GB.coefficients[2], BB.coefficients[2]) * 2.0 * 0.511664 * z;
            rad += vec3f(RB.coefficients[3], GB.coefficients[3], BB.coefficients[3]) * 2.0 * 0.511664 * x;


            rad += vec3f(RB.coefficients[4], GB.coefficients[4], BB.coefficients[4]) * 2.0 * 0.429043 * x * y;
            rad += vec3f(RB.coefficients[5], GB.coefficients[5], BB.coefficients[5]) * 2.0 * 0.429043 * y * z;

            rad += vec3f(RB.coefficients[6], GB.coefficients[6], BB.coefficients[6]) * (0.743125 * z * z - 0.247708);
            rad += vec3f(RB.coefficients[7], GB.coefficients[7], BB.coefficients[7]) * 2.0 * 0.429043 * x * z;
            rad += vec3f(RB.coefficients[8], GB.coefficients[8], BB.coefficients[8]) * 0.429043 * (x * x - y * y);

            return rad;
        }

        fn getBase(normal : vec3f) -> SHB
        {
            let x = normal.x;
            let y = normal.y;
            let z = normal.z;

            return SHB(
            array<f32, n_SHB > (
            0.282095,
            0.488603 * y,
            0.488603 * z,
            0.488603 * x,
            1.092548 * x * y,
            1.092548 * y * z,
            0.315392 * (3 * z*z - 1.0f),
            1.092548 * x * z,
            0.546274 * (x * x - y * y)
            ));
        }

        fn getCoords(i : u32, j : u32, l : u32, pixelSize : f32) -> vec3f
        {
            let x= -1 + (f32(i) + 0.5) * pixelSize;
            let y = 1 - (f32(j) + 0.5) * pixelSize;
            var coord = vec3f();
            switch(l)
            {
                case 0 :
                {
                    coord = vec3f(1, y, x); break;
                }
                case 1 :
                {
                    coord = vec3f(-1, y, - x); break;
                }
                case 2 :
                {
                    coord = vec3f(x, 1, y); break;
                }
                case 3 :
                {
                    coord = vec3f(x, -1, -y); break;
                }
                case 4 :
                {
                    coord = vec3f(x, y, -1); break;
                }
                case 5 :
                {
                    coord = vec3f(-x, y, 1); break;
                }
                default :
                {
                    coord = vec3f(0); break;
                }
            }
            return coord;
        }
