#include "disney.glsl"
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vScreenNormal;
varying vec3 vWorldTangent;
varying vec3 vWorldBitangent;
varying vec3 vWorldPos;
varying vec3 vReflect;

uniform samplerCube envMap;

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
    color = textureCube(envMap, vReflect).rgb * albedo;
    gl_FragColor = vec4(color, 1.0);
}
