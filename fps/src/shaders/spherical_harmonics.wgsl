/*
Takes an image and calculates the Coefficients for the ambient light.
Those coefficients contain the convolution with the cosine.
*/
const PI = 3.14159265359;

//holds the coefficients of the 9 spherical harmonics used
const n_SHB = 9;
struct SHB
{
    coefficients : array<f32, n_SHB >,
}

struct SHB3
{
    R : SHB,
    G : SHB,
    B : SHB,
}

fn createSH(sourceTexture : texture_2d<f32>, targetTexture : texture_storage_2d_array<rgba16float, write>)
{
    let shb3 = SphericalHarmonics(sourceTexture);
    InverseSphericalHarmonics(targetTexture, shb3.R, shb3.G, shb3.B);
}

fn GetBase(direction : vec3f) -> SHB
{
    let x = direction.x;
    let y = direction.y;
    let z = direction.z;

    return SHB(
    array<f32, 9 > (
    1,
    y,
    z,
    x,
    x * y,
    y * z,
    (3 * z*z - 1.0f),
    x * z,
    (x * x - y * y)
    ));
}

fn SphericalHarmonics(im : texture_2d<f32>) -> SHB3
{
    var RB = SHB();
    var GB = SHB();
    var BB = SHB();
    let size = textureDimensions(im);
    let hf = PI / f32(size.x);
    let wf = (2.0 * PI) / f32(size.y);

    for (var j = 0u; j < size.y; j++)
    {
        let phi = hf * f32(j);
        let sinPhi = sin(phi) * hf * wf;

        for (var i = 0u; i < size.x; i++)
        {
            let theta = wf * f32(i);

            let dir = vec3f(cos(theta) * sin(phi), sin(theta) * sin(phi), cos(phi));

            var base = GetBase(dir);
            base = multScalar(base, sinPhi);
            let color = textureLoad(im, vec2u(j, i), 0).xyz;

            for(var k = 0u; k < n_SHB; k++)
            {
                RB.coefficients[k] += base.coefficients[k]* color.x;
                GB.coefficients[k] += base.coefficients[k]* color.y;
                BB.coefficients[k] += base.coefficients[k]* color.z;
            }
        }
    }

    const normalizationFactor = 1.0;

    const coefficients = SHB(array<f32, 9 > (
    0.282095 * 3.141593 * normalizationFactor,
    -0.488603 * 2.094395 * normalizationFactor,
    0.488603 * 2.094395 * normalizationFactor,
    -0.488603 * 2.094395 * normalizationFactor,
    1.092548 * 0.785398 * normalizationFactor,
    -1.092548 * 0.785398 * normalizationFactor,
    0.315392 * 0.785398 * normalizationFactor,
    -1.092548 * 0.785398 * normalizationFactor,
    0.546274 * 0.785398 * normalizationFactor
    ));

    RB.coefficients = mult(RB, coefficients).coefficients;
    GB.coefficients = mult(GB, coefficients).coefficients;
    BB.coefficients = mult(BB, coefficients).coefficients;

    return SHB3(RB, GB, BB);
}

/*
Applies the inverse transformation to the coefficients and save them in an irradiance map
*/
fn InverseSphericalHarmonics(result : texture_storage_2d_array<rgba16float, write>, RB : SHB, GB : SHB, BB : SHB)
{
    let size = textureDimensions(result);
    let hf = PI / f32(size.y);
    let wf = (2.0 * PI) / f32(size.x);
    for (var j = 0u; j < size.y; j++)
    {
        let phi = hf * f32(j);

        for (var i = 0u; i < size.x; i++)
        {
            let theta = wf * f32(i);

            let dir = vec3f(cos(theta) * sin(phi), sin(theta) * sin(phi), cos(phi));
            let base = GetBase(dir);

            //base.mul(BaseCoeff);

            let color = vec3f
            (
            max(dotProduct(base, RB), 0.0),
            max(dotProduct(base, GB), 0.0),
            max(dotProduct(base, BB), 0.0),
            );

            textureStore(result, vec2u(j, i), 0, vec4f(color, 1));
        }
    }
}

fn dotProduct(shb1 : SHB, shb2 : SHB) -> f32 {
    var result = 0.0;

    for (var i = 0u; i < n_SHB; i++)
    {
        result += shb1.coefficients[i] * shb2.coefficients[i];
    }

    return result;
}

fn multScalar(shb : SHB, s : f32) -> SHB
{
    var result = SHB();
    for (var i = 0u; i < n_SHB; i++)
    {
        result.coefficients[i]=shb.coefficients[i] * s;
    }
    return result;
}

fn mult(shb1 : SHB, shb2 : SHB) -> SHB
{
    var result = SHB();
    for (var i = 0u; i < n_SHB; i++)
    {
        result.coefficients[i] = shb1.coefficients[i] * shb2.coefficients[i];
    }

    return result;
}

//as far as i can see all coefficients are premultiplied in the create function
fn GetBase2(direction : vec3f) ->SHB{
    let x = direction[0];
    let y = direction[1];
    let z = direction[2];


    return SHB(
    array<f32, 9 > (
    0.282095,
    -0.488603 * y,
    0.488603 * z,
    -0.488603 * x,
    1.092548 * x*y,
    -1.092548 * y*z,
    0.315392 * (3.0 * z*z - 1.0),
    -1.092548 * x*z,
    0.546274 * (x * x - y * y)
    ));
}
