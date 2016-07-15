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
uniform sampler2D directionalShadowMap[NUM_DIR_LIGHTS];
varying vec4 vDirectionalShadowCoord[NUM_DIR_LIGHTS];

//THREE.js
    const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;
    const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256.,  256. );
    const vec4 UnpackFactors = UnpackDownscale / vec4( PackFactors, 1. );
    float unpackRGBAToDepth( const in vec4 v ) {
        return dot( v, UnpackFactors );
    }
    float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
        return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
    }
    float texture2DShadowLerp( sampler2D depths, vec2 size, vec2 uv, float compare ) {
        const vec2 offset = vec2( 0.0, 1.0 );
        vec2 texelSize = vec2( 1.0 ) / size;
        vec2 centroidUV = floor( uv * size + 0.5 ) / size;
        float lb = texture2DCompare( depths, centroidUV + texelSize * offset.xx, compare );
        float lt = texture2DCompare( depths, centroidUV + texelSize * offset.xy, compare );
        float rb = texture2DCompare( depths, centroidUV + texelSize * offset.yx, compare );
        float rt = texture2DCompare( depths, centroidUV + texelSize * offset.yy, compare );
        vec2 f = fract( uv * size + 0.5 );
        float a = mix( lb, lt, f.y );
        float b = mix( rb, rt, f.y );
        float c = mix( a, b, f.x );
        return c;
    }
#define SHADOWMAP_TYPE_PCF
    float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
        shadowCoord.xyz /= shadowCoord.w;
        shadowCoord.z += shadowBias;
        bvec4 inFrustumVec = bvec4 ( shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0 );
        bool inFrustum = all( inFrustumVec );
        bvec2 frustumTestVec = bvec2( inFrustum, shadowCoord.z <= 1.0 );
        bool frustumTest = all( frustumTestVec );
        if ( frustumTest ) {
        #if defined( SHADOWMAP_TYPE_PCF )
            vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
            float dx0 = - texelSize.x * shadowRadius;
            float dy0 = - texelSize.y * shadowRadius;
            float dx1 = + texelSize.x * shadowRadius;
            float dy1 = + texelSize.y * shadowRadius;
            return (
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
                texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
            ) * ( 1.0 / 9.0 );
        #elif defined( SHADOWMAP_TYPE_PCF_SOFT )
            vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
            float dx0 = - texelSize.x * shadowRadius;
            float dy0 = - texelSize.y * shadowRadius;
            float dx1 = + texelSize.x * shadowRadius;
            float dy1 = + texelSize.y * shadowRadius;
            return (
                texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
                texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
                texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
                texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
                texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy, shadowCoord.z ) +
                texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
                texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
                texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
                texture2DShadowLerp( shadowMap, shadowMapSize, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
            ) * ( 1.0 / 9.0 );
        #else
            return texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
        #endif
        }
        return 1.0;
    }
//END THREE.js

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
        vec3 l = BRDF(lightVector, V, nz, nx, ny) * directionalLights[i].color * dot(lightVector, nz);
        if(directionalLights[i].shadow) {
            l *= getShadow(directionalShadowMap[i], directionalLights[i].shadowMapSize, directionalLights[i].shadowBias, directionalLights[i].shadowRadius, vDirectionalShadowCoord[i]);
        }
        color += l;
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

    color = toneMapping(color);
    gl_FragColor = linearToOutputTexel(vec4(color, 1.0));
}
