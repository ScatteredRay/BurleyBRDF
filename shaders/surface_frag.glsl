#include "disney.glsl"
#include "montecarlo.glsl"
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vScreenNormal;
varying vec3 vWorldTangent;
varying vec3 vWorldBitangent;
varying vec3 vWorldPos;
varying vec4 vScreenPos;
varying vec3 vReflect;

uniform samplerCube envMap;
uniform float instRand;

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
    vec3 albedo = mat_albedo();

    vec3 color = vec3(0.00, 0.00, 0.00);
    for(int i = 0; i < NUM_DIR_LIGHTS; i++) {
        vec3 lightVector = normalize(directionalLights[i].direction);
        color += clamp(dot(lightVector, vWorldNormal), 0.0, 1.0) * directionalLights[i].color * albedo;
        //color += BRDF(lightVector, vec3(0, 0, -1), vNormal, vec3(0, 1, 0), vec3(1, 0, 1)) * directionalLights[i].color;
    }
    // We generate tangents for percision.
    vec3 nz = normalize(vWorldNormal);
    vec3 nx = normalize(cross(nz, vWorldTangent));
    vec3 ny = normalize(cross(nx, nz));
    color = vec3(0.0, 0.0, 0.0);
    const int numSamples = 32;
    for(int s = 0; s < numSamples; s++) {
        vec2 r = rand2(vScreenPos.xy + vec2(float(s) / 17.456, instRand));
        vec4 d = CosWeightedHemisphere(r, nz, nx, ny);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float pdf = d.w;
        vec3 l = BRDF(d.xyz, V, nz, nx, ny) / pdf;
        //color += l * textureCube(envMap, d.xyz).rgb;// / float(numSamples);
        color += textureCube(envMap, d.xyz).rgb * l / float(numSamples);
        //color += dot(d.xyz, nz) / float(numSamples);
        //break;
    }

            //color = textureCube(envMap, vReflect).rgb * albedo;
    gl_FragColor = vec4(color, 1.0);
}
