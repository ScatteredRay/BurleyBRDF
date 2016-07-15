uniform sampler2D inTex;
uniform sampler2D accumTex;
uniform int accumCount;

varying vec2 vUv;

void main() {
    float a = float(accumCount);
    float a1 = float(accumCount + 1);
    vec4 color = texture2D(inTex, vUv);
    vec4 accum = texture2D(accumTex, vUv);
    accum *= a;
    gl_FragColor = (color + accum) / a1;
}
