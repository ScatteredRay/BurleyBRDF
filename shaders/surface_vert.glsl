varying vec2 vUv;
varying vec3 vNormal;

void main()
{
    vUv = uv;
    vNormal = normal;
    vNormal = (modelViewMatrix * vec4(normal, 0.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
