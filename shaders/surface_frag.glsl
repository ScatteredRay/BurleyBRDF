#include "disney.glsl"
#include "montecarlo.glsl"

varying vec2 vUv;
varying vec3 vScreenNormal;
varying vec3 vScreenTangent;
varying vec3 vScreenBitangent;
varying vec3 vWorldNormal;
varying vec3 vWorldTangent;
varying vec3 vWorldBitangent;
varying vec3 vWorldPos;
varying vec4 vScreenPos;
varying vec3 vReflect;

uniform samplerCube envMap;
uniform float instRand;
uniform int accumCount;
uniform vec2 accumHalton;

struct DirectionalLight
{
    vec3 color;
    vec3 direction;
    bool shadow;
    float shadowBias;
    vec2 shadowMapSize;
    float shadowRadius;
};

uniform DirectionalLight directionalLights[NUM_DIR_LIGHTS];

void main()
{
    vec3 color = vec3(0.00, 0.00, 0.00);

    // We generate tangents for percision.
    vec3 nz = normalize(vScreenNormal);
    vec3 nx = normalize(cross(nz, vScreenTangent));
    vec3 ny = normalize(cross(nx, nz));

    vec3 V = vec3(0.00, 0.00, 1.00);

    for(int i = 0; i < NUM_DIR_LIGHTS; i++) {
        vec3 lightVector = normalize(directionalLights[i].direction);
        color += BRDF(lightVector, V, nz, nx, ny) * directionalLights[i].color;
    }

    // IBL is done in world space.
    nz = normalize(vWorldNormal);
    nx = normalize(cross(nz, vWorldTangent));
    ny = normalize(cross(nx, nz));

    V = normalize(cameraPosition - vWorldPos);

    const int numSamples = 1;
    for(int s = 0; s < numSamples; s++) {
        vec2 r = rand2(vScreenPos.xy + vec2(float(s) / 17.456, instRand));
        r = hash2(float(accumCount));
        r = accumHalton;
        r += rand2(vScreenPos.xy);
        r = fract(r);
        vec4 d = CosWeightedHemisphere(r, nz, nx, ny);
        float cosine = max(0.0, dot(d.xyz, nz)) / (2.0 * PI);
        float pdf = d.w;
        vec3 l = max(BRDF(d.xyz, V, nz, nx, ny), vec3(0.0)) * pdf * 24.0;
        color += l * textureCube(envMap, d.xyz).rgb / float(numSamples);
    }

    gl_FragColor = vec4(color, 1.0);
}
