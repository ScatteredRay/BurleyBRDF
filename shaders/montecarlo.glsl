#if 0
float VDCRadicalInverse(int bits)
{
    bits = (bits << 16) | (bits >> 16);
    bits = ((bits & 0x55555555) << 1) | ((bits & 0xAAAAAAAA) >> 1);
    bits = ((bits & 0x33333333) << 2) | ((bits & 0xCCCCCCCC) >> 2);
    bits = ((bits & 0x0F0F0F0F) << 4) | ((bits & 0xF0F0F0F0) >> 4);
    bits = ((bits & 0x00FF00FF) << 8) | ((bits & 0xFF00FF00) >> 8);
    return float(bits) * 2.3283064365386963e-10;
}

float Hammersley2(int i, int n)
{
    return vec2(float(i) / float(n), VDCRadicalInverse(i));
}

float halton(int i, int base)
{
    float res = 0.0;
    float f = 1.0;
    while(i > 0) {
        f = f / float(base);
        res = res + f * (i % base);
        i = i / base;
    }
    return res;
}

#endif

float hash(float p)
{
    vec3 p3 = fract(vec3(p) * 0.1031);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash2(float p)
{
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract(vec2((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y));
}

vec2 hash2(vec3 p)
{
    vec3 p3 = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract(vec2((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y));
}

vec3 hash3(float p)
{
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

vec3 hash3(vec3 p)
{
    vec3 p3 = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

float rand(vec2 co)
{
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec2 rand2(vec2 co)
{
    return vec2(rand(co), rand(vec2(co.y, fract(co.x * 24.7676))));
}

vec4 CosWeightedHemisphereTangentSpace(vec2 e)
{
    float r = sqrt(e.x);
    float th = 2.0 * PI * e.y;

    float pdf = r / (2.0 * PI);

    return vec4(
        r * cos(th),
        r * sin(th),
        sqrt(max(0.0, 1.0 - e.x)),
        pdf);
}


vec4 CosWeightedHemisphere(vec2 e, vec3 normal, vec3 tangent, vec3 bitangent)
{
    vec4 h = CosWeightedHemisphereTangentSpace(e);
    return vec4(tangent * h.x + bitangent * h.y + normal * h.z, h.w);
}

vec4 UniformHemisphereTangentSpace(vec2 e)
{
    float r = e.x;
    float th = 2.0 * PI * e.y;

    float pdf = 1.0 / (2.0 * PI);

    return vec4(
        r * cos(th),
        r * sin(th),
        sqrt(max(0.0, 1.0 - e.x)),
        pdf);
}

vec4 UniformHemisphere(vec2 e, vec3 normal, vec3 tangent, vec3 bitangent)
{
    vec4 h = UniformHemisphereTangentSpace(e);
    return vec4(tangent * h.x + bitangent * h.y + normal * h.z, h.w);
}
