attribute vec3 tangent;

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

#if NUM_DIR_LIGHTS > 0
uniform mat4 directionalShadowMatrix[NUM_DIR_LIGHTS];
varying vec4 vDirectionalShadowCoord[NUM_DIR_LIGHTS];
#endif

void main()
{
    vUv = uv;
    vWorldPos = (modelMatrix * vec4(position.xyz, 1.0)).xyz;
    vScreenNormal = normalize((normalMatrix * normal));
    vScreenTangent = normalize((normalMatrix * tangent));
    vScreenBitangent = normalize(cross(vScreenNormal, vScreenTangent));
    vWorldNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
    vWorldTangent = normalize((modelMatrix * vec4(tangent, 0.0)).xyz);
    vWorldBitangent = normalize(cross(vWorldNormal, vWorldTangent));
    vWorldTangent = cross(vWorldTangent, vWorldNormal);
    vec3 cameraToVertex = normalize(vWorldPos.xyz - cameraPosition);
    vReflect = reflect(cameraToVertex, vWorldNormal);
    gl_Position = vScreenPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

#if NUM_DIR_LIGHTS > 0
    for(int i = 0; i < NUM_DIR_LIGHTS; i++) {
        vDirectionalShadowCoord[i] = directionalShadowMatrix[i] * vec4(vWorldPos, 1.0);
    }
#endif
}
