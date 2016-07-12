uniform sampler2D inTex;

varying vec2 vUv;

void main() {
    vec4 color = texture2D(inTex, vUv);
    gl_FragColor = color;
}
