const PI = 3.14159265359;
//holds the coefficients of the 9 spherical harmonics used
const n_SHB = 9;
struct SHB
{
    coefficients : array<f32, n_SHB >,
}

// one SHB for every color channel
struct SHB3
{
    R : SHB,
    G : SHB,
    B : SHB,
}

fn createSH(sourceTexture : texture_2d_array<f32>, targetTexture : texture_storage_2d_array<rgba16float, write>)
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
    //size in worldspace on a 2x2x2 cube
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


//evaluates the spherical harmonics on a irradiance map
fn writeIrradianceMap(im : texture_storage_2d_array<rgba16float, write>, shb3 : SHB3)
{
    let size = textureDimensions(im);
    //size in worldspace on a 2x2x2 cube
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

    //normal is assumed to be unit length
    let x = normal.x;
    let y = normal.y;
    let z = normal.z;

    //band 0
    var rad = vec3f(RB.coefficients[0], GB.coefficients[0], BB.coefficients[0]) * 0.282095;
    //band 1
    rad += vec3f(RB.coefficients[1], GB.coefficients[1], BB.coefficients[1]) * 0.488603 * y;
    rad += vec3f(RB.coefficients[2], GB.coefficients[2], BB.coefficients[2]) * 0.488603 * z;
    rad += vec3f(RB.coefficients[3], GB.coefficients[3], BB.coefficients[3]) * 0.488603 * z;

    //band 2
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
    //normal is assumed to be unit length
    let x = normal.x;
    let y = normal.y;
    let z = normal.z;

    //band 0
    var rad = vec3f(RB.coefficients[0], GB.coefficients[0], BB.coefficients[0]) * 0.886227;
    //band 1
    rad += vec3f(RB.coefficients[1], GB.coefficients[1], BB.coefficients[1]) * 2.0 * 0.511664 * y;
    rad += vec3f(RB.coefficients[2], GB.coefficients[2], BB.coefficients[2]) * 2.0 * 0.511664 * z;
    rad += vec3f(RB.coefficients[3], GB.coefficients[3], BB.coefficients[3]) * 2.0 * 0.511664 * x;

    //band 2
    rad += vec3f(RB.coefficients[4], GB.coefficients[4], BB.coefficients[4]) * 2.0 * 0.429043 * x * y;
    rad += vec3f(RB.coefficients[5], GB.coefficients[5], BB.coefficients[5]) * 2.0 * 0.429043 * y * z;

    rad += vec3f(RB.coefficients[6], GB.coefficients[6], BB.coefficients[6]) * 0.743125 * z * z - 0.247708;
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
    //offset by half a pixel
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
