uniform sampler2D inTex;
uniform sampler2D accumTex;
uniform float accumCount;

varying vec2 vUv;

void main() {
    vec4 color = texture2D(inTex, vUv);
    vec4 accum = texture2D(accumTex, vUv);
    accum *= accumCount;
    gl_FragColor = (color + accum) / (accumCount + 1.0);
}
