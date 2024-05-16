/*
Takes an image and calculates the Coefficients for the ambient light.
Those coefficients contain the convolution with the cosine.
*/
const PI = 3.14159265359;

// holds the coefficients of the 9 spherical harmonics used
struct SHB
{
    coefficients : array<f32, 9>,
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

fn SphericalHarmonicsOptimized(im : texture_2d<f32>)
{
    let RB = SHB();
    let GB = SHB();
    let BB = SHB();
    let size = textureDimensions(im);
    let hf = PI / f32(size.x);
    let wf = (2.0 * PI) / f32(size.y);

    var area = 0.0;
    for (var j = 0u; j < size.y; ++j)
    {
        let phi = hf * f32(j);
        let sinPhi = sin(phi) * hf * wf;

        for (var i = 0u; i < size.x; ++i)
        {
            let theta = wf * f32(i);

            let dir = vec3f(cos(theta) * sin(phi), sin(theta) * sin(phi), cos(phi));

            let base = GetBase(dir);
            let color = textureLoad(im, j, i).xyz;

            base *= sinPhi;
            area += sinPhi;

            RB.coefficients += base * color.x;
            GB.coefficients += base * color.y;
            BB.coefficients += base * color.z;
        }
    }

    const normalizationFactor = 1.0;

    const coefficients = array<f32, 9 > (
    0.282095 * 3.141593 * normalizationFactor,
    -0.488603 * 2.094395 * normalizationFactor,
    0.488603 * 2.094395 * normalizationFactor,
    -0.488603 * 2.094395 * normalizationFactor,
    1.092548 * 0.785398 * normalizationFactor,
    -1.092548 * 0.785398 * normalizationFactor,
    0.315392 * 0.785398 * normalizationFactor,
    -1.092548 * 0.785398 * normalizationFactor,
    0.546274 * 0.785398 * normalizationFactor
    );

    RB.coefficients = RB.coefficients * coefficients;
    GB.coefficients = GB.coefficients * coefficients;
    BB.coefficients = BB.coefficients * coefficients;
}

/*
Applies the inverse transformation to the coefficients and save them in an irradiance map
*/
fn InverseSphericalHarmonics(result : texture_storage_2d < rgba8unorm, f32>, RB : SHB, GB : SHB, BB : SHB) -> void
{
    let size = textureDimensions(result);
    let hf = PI / f32(size.y);
    let wf = (2.0 * PI) / f32(size.x);
    for (var j = 0u; j < size.y; ++j)
    {
        let phi = hf * f32(j);

        for (var i = 0u; i < size.x; ++i)
        {
            float theta = wf * f32(i);

            let dir = vec3f(cos(theta) * sin(phi), sin(theta) * sin(phi), cos(phi));
            let base = GetBase(dir);

            //base.mul(BaseCoeff);

            let color = vec3f
            (
            max(dotProduct(base.coefficients, RB.coefficients), 0.0),
            max(dotProduct(base.coefficients, GB.coefficients), 0.0),
            max(dotProduct(base.coefficients, BB.coefficients), 0.0),
            );

            textureStore(result, vec2u(j, i), vec4f(color, 1));
        }
    }
}

fn dotProduct(array1 : array<f32>, array2 : array<f32>) -> f32 {
    var result = 0.0;
    var length = length(array1);

    for (var i = 0u; i < length; i++)
    {
        result += array1[i] * array2[i];
    }

    return result;
}

// as far as i can see all coefficients are premultiplied in the create function
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