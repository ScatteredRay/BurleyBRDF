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
#endif

float rand(vec2 co)
{
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 rand2(vec2 co)
{
    return vec2(rand(co), rand(vec2(co.x, co.y * 24.7676)));
}

vec4 CosWeightedHemisphereTangentSpace(vec2 e)
{
    float r = sqrt(e.x);
    float th = 2.0 * PI * e.y;

    float pdf = 0.0001 + r / PI;

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
