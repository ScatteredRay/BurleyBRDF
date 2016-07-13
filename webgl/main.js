var container;

var camera;
var scene;
var renderer;
var controls;

var drawTarget;
var accumTargets;

var accumPass;
var copyPass;

var mouseX = 0;
var mouseY = 0;

var gui;

var maxAccum = 2048;
var accum = 0;

var jitterAA = true;

var width = 0;
var height = 0;

var updateMaterials = [];

init();
animate();

function updateRender() {
    accum = 0;
    requestAnimationFrame(animate);
}

function CreateFullscreenPass(fragShader) {
    var pass = {};
    pass.material = new THREE.ShaderMaterial();

    pass.uniforms = pass.material.uniforms = {};
    pass.material.defines = {};

    fetch('/shaders/pass_vert.glsl').then(
        function(res) {
            if(res.ok) {
                res.text().then(function(text) {
                    pass.material.vertexShader = text;
                    pass.material.needsUpdate = true;
                    updateRender();
                });
            }
        }
    );

    fetch(fragShader).then(
        function(res) {
            if(res.ok) {
                res.text().then(function(text) {
                    pass.material.fragmentShader = text;
                    pass.material.needsUpdate = true;
                    updateRender();
                });
            }
        }
    );

    pass.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    pass.scene = new THREE.Scene();
    pass.quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null);
    pass.scene.add(pass.quad);

    pass.render = function(renderTarget) {
        pass.quad.material = pass.material;
        if(!renderTarget) {
            renderer.render(pass.scene, pass.camera);
        }
        else {
            renderer.render(pass.scene, pass.camera, renderTarget);
        }
    };

    return pass;
}

function init() {
    container = document.createElement('div');
    document.body.appendChild(container);
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.z = 10;
    camera.position.y = 1;
    camera.lookAt(new THREE.Vector3(0, 1, 0));

    scene = new THREE.Scene();

    var manager = new THREE.LoadingManager();
    manager.onProgress = function(item, loaded, total) {
        console.log(item, loaded, total);
    }

    function genCubeUrls(prefix, postfix) {
        return [
            prefix + 'px' + postfix, prefix + 'nx' + postfix,
            prefix + 'py' + postfix, prefix + 'ny' + postfix,
            prefix + 'pz' + postfix, prefix + 'nz' + postfix
        ];
    };

    var hdrPaths = genCubeUrls('/data/PisaHDR/', '.hdr');
    var loader = new THREE.HDRCubeTextureLoader();
    var IBL = loader.load(
        THREE.FloatType,
        hdrPaths,
        function() {
            updateRender();
        });

    var loader = new THREE.OBJLoader(manager);
    loader.load('/data/Meshes/Suzanne.obj', function(object) {
        create_materialx_shadermaterials(
            "/data/Materials/default.mtlx",
            function(mtls) {
                for(var mtl in mtls) {
                    updateMaterials.push(mtls[mtl]);
                    mtls[mtl].uniforms.envMap = {type: 't', value: IBL};
                    mtls[mtl].uniforms.instRand = {type: 'f', value: 0.0};
                    addGuiMaterial(mtls[mtl], mtl);
                }

                object.traverse(function(child) {
                    if(child instanceof THREE.Mesh) {
                        function setMaterial(material) {
                            if(!!material.name && !!mtls[material.name]) {
                                return mtls[material.name];
                            }
                            else if(!!material.materials) {
                                for(var i = 0; i < material.materials.length; i++) {
                                    material.materials[i] = setMaterial(material.materials[i]);
                                }
                            }
                            return material;
                        }
                        if(child.geometry.index === null) {
                            child.geometry.setIndex(new THREE.BufferAttribute(new Uint32Array([...Array(child.geometry.attributes.position.count).keys()]), 1, false));
                        }
                        child.material = setMaterial(child.material);
                        THREE.BufferGeometryUtils.computeTangents(child.geometry);
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                scene.add(object);
                updateRender();
            });
    });

    var ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 1, 1), new THREE.MeshStandardMaterial({color: 0x999999, roughness: 1.0}));
    ground.rotateX(-Math.PI / 2.0);
    ground.receiveShadow = true;
    scene.add(ground);
    ground.material.envMap = IBL;

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    //renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    width = window.innerWidth;
    height = window.innerHeight;

    drawTarget = new THREE.WebGLRenderTarget(
        width,
        height,
        {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            stencilBuffer:false
        });

    accumTargets = [];
    accumTargets[0] = new THREE.WebGLRenderTarget(
        width,
        height,
        {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            stencilBuffer:false
        });

    accumTargets[1] = accumTargets[0].clone();

    accumPass = CreateFullscreenPass('/shaders/accum.glsl');
    copyPass = CreateFullscreenPass('/shaders/copy.glsl');

    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;
    var oldUpdate = controls.update;
    controls.update = function() {
        var ret = oldUpdate();
        updateRender();
        return ret;
    }

    var ambient = new THREE.AmbientLight(0x101030);
    scene.add(ambient);

    function uc(e) {
        updateRender();
    }

    function hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : null;
    }

    function addColor(gui, color, name) {
        var c = {};
        if(typeof color == 'undefined' || typeof color.r == 'undefined')
            c[name] = [255, 255, 255];
        else
            c[name] = [color.r * 255, color.g * 255, color.b * 255];
        var controller = gui.addColor(c, name).onChange(function(e) {
            if(typeof c[name] == 'string')
                c[name] = hexToRgb(c[name])
            color.r = c[name][0] / 255.0;
            color.g = c[name][1] / 255.0;
            color.b = c[name][2] / 255.0;
            uc(e);
        });
        return controller;
    }

    function addFloat(gui, parent, path, name) {
        var c = {};
        c[name] = parent[path]
        var controller = gui.add(c, name, 0, 1).onChange(function(e) {
            parent[path] = c[name];
            uc(e);
        });
        return controller;
    }

    function addLight(name) {
        var directionalLight = new THREE.DirectionalLight(0xffeedd);
        directionalLight.position.set(-0.69, 0.48, 0.63);
        directionalLight.castShadow = false;
        directionalLight.shadow.mapSize.x = 2048;
        directionalLight.shadow.mapSize.y = 2048;
        directionalLight.shadow.camera.near = -10;
        directionalLight.shadow.camera.far = 10;
        directionalLight.shadow.camera.left = -2;
        directionalLight.shadow.camera.right = 2;
        directionalLight.shadow.camera.bottom = -2;
        directionalLight.shadow.camera.top = 2;
        scene.add(directionalLight);
        var dirGui = gui.addFolder(name);
        addColor(dirGui, directionalLight.color, 'color');
        dirGui.add(directionalLight, 'intensity').min(0.0).step(0.01).onChange(uc);
        dirGui.add(directionalLight, 'castShadow').onChange(uc);
        dirGui.add(directionalLight.position, 'x', -1, 1).onChange(uc);
        dirGui.add(directionalLight.position, 'y', -1, 1).onChange(uc);
        dirGui.add(directionalLight.position, 'z', -1, 1).onChange(uc);
    }

    //document.addEventListener('mousemove', onDocumentMouseMove, false);
    document.addEventListener('resize', onWindowResize, false);
    {
        gui = new dat.GUI();
        gui.add(ground, 'visible').onChange(uc);
        gui.add(renderer, 'toneMappingExposure').min(0.0).step(0.01).onChange(uc);
        var ambGui = gui.addFolder('Ambient');
        addColor(ambGui, ambient.color, 'color');
        ambGui.add(ambient, 'intensity').min(0.0).step(0.01).onChange(uc);
        //ambGui.add(material, 'envMapIntensity').min(0.0).step(0.01).onChange(uc);
        var nextLight = 1;
        var guiParams = {
            addLight : function() {
                addLight('Directional ' + nextLight++);                
            }
        };
        gui.add(guiParams, 'addLight');
        guiParams.addLight();

    }

    function addGuiMaterial(mat, name) {
        var matGui = gui.addFolder('Material ' + name);
        function addUniform(uniform, name) {
            switch(mat.uniforms[uniform].type) {
            case '3f':
                addColor(matGui, mat.uniforms[uniform].value, name);
                break;
            case 'f':
            case '1f':
                addFloat(matGui, mat.uniforms[uniform], 'value', name);
                break;
            }
        }

        addUniform('u_baseColor', "baseColor");
        addUniform('u_metallic', 'metallic');
        addUniform('u_subsurface', 'subsurface');
        addUniform('u_specular', 'specular');
        addUniform('u_roughness', 'roughness');
        addUniform('u_specularTint', 'specularTint');
        addUniform('u_anisotropic', 'anisotropic');
        addUniform('u_sheen', 'sheen');
        addUniform('u_sheenTint', 'sheenTint');
        addUniform('u_clearcoat', 'clearcoat');
        addUniform('u_clearcoatGloss', 'clearcoatGloss');
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innderWidth, window.innerHeight);
    updateRender();
}

/*function onDocumentMouseMove(event) {
    if(event.buttons == 1) {
        var windowHalfX = window.innerWidth/2;
        var windowHalfY = window.innerHeight/2;
        mouseX = (event.clientX - windowHalfX) / 2;
        mouseY = (event.clientY - windowHalfY) / 2;
        requestAnimationFrame(animate);
    }
}*/

function animate() {
    for(var i = 0; i < updateMaterials.length; i++) {
        updateMaterials[i].uniforms.instRand.value = Math.random();
    }
    render();
    if(accum++ < maxAccum) {
        requestAnimationFrame(animate);
    }
}

function render() {
    var cam = camera;
    if(jitterAA) {
        cam = camera.clone();
        cam.projectionMatrix = cam.projectionMatrix.clone();
        var jitterMat = new THREE.Matrix4();
        jitterMat.set(
            1, 0, 0, (Math.random() - 0.5) / (width * 0.5),
            0, 1, 0, (Math.random() - 0.5) / (height * 0.5),
            0, 0, 1, 0,
            0, 0, 0, 1);
        cam.projectionMatrix.premultiply(jitterMat);
    }
    renderer.render(scene, cam, drawTarget);

    accumPass.uniforms.inTex = {value: drawTarget.texture};
    accumPass.uniforms.accumTex = {value: accumTargets[0].texture};
    accumPass.uniforms.accumCount = {type: 'f', value: accum};
    accumPass.render(accumTargets[1]);

    // Swap accum targets
    var t = accumTargets[1];
    accumTargets[1] = accumTargets[0];
    accumTargets[0] = t;

    copyPass.uniforms.inTex = {value: t};
    copyPass.render();
}
