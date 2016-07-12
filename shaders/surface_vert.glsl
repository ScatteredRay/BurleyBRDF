attribute vec4 tangent;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vScreenNormal;
varying vec3 vWorldTangent;
varying vec3 vWorldBitangent;
varying vec3 vWorldPos;
varying vec4 vScreenPos;
varying vec3 vReflect;

void main()
{
    vUv = uv;
    vWorldPos = (modelMatrix * vec4(position.xyz, 1.0)).xyz;
    vWorldNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
    vScreenNormal = normalize((normalMatrix * normal).xyz);
    vWorldTangent = normalize((modelMatrix * vec4(tangent.xyz, 0.0)).xyz);
    vWorldBitangent = normalize(cross(vWorldNormal, vWorldTangent));
    vWorldTangent = cross(vWorldTangent, vWorldNormal);
    vec3 cameraToVertex = normalize(vWorldPos.xyz - cameraPosition);
    vReflect = reflect(cameraToVertex, vWorldNormal);
    gl_Position = vScreenPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
