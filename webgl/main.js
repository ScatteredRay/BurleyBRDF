var container;

var camera;
var scene;
var renderer;
var controls;

var IBL;

var drawTarget;
var accumTargets;

var accumPass;
var copyPass;

var mouseX = 0;
var mouseY = 0;

var gui;
var lightGui;
var sceneGui;

var maxAccum = 2048;
var accum = 0;

var jitterAA = true;

var width = 0;
var height = 0;

var updateMaterials = [];
var updateLights = [];

var focusBounds = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 6);

init();
animate();

var renderTimeout = null;

function continueRender() {
    if(!!renderTimeout) {
        cancelAnimationFrame(renderTimeout)
        renderTimeout = null;
    }
    renderTimeout = requestAnimationFrame(animate);
}

function updateRender() {
    continueRender();
    accum = 0;
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

function CalcGroupBounds(group) {
    var bounds = null;
    group.traverse(function(child) {
        if((child instanceof THREE.Mesh ||
            child instanceof THREE.Line)&&
           !!child.geometry) {
            if(!child.geometry.boundingSphere) {
                child.geometry.computeBoundingSphere();
            }
            var sp = child.geometry.boundingSphere;
            if(!bounds) {
                bounds = new THREE.Sphere(sp.center.clone(), sp.radius);
            }
            else {
                var p1 = bounds.center.clone().add(bounds.center.clone().sub(sp.center).normalize().multiplyScalar(bounds.radius));
                var p2 = sp.center.clone().add(sp.center.clone().sub(bounds.center).normalize().multiplyScalar(sp.radius));
                var c = p1.clone().add(p2).divideScalar(2.0);
                var r = p1.sub(p2).length() / 2.0;
                bounds.set(c, r);
            }
        }
    });
    return bounds;
}

function UvToUdim(u, v) {
    u = Math.floor(u);
    v = Math.floor(v);
    return 1000 + 10 * v + u + 1;
}

function MeshProcessUdims(object) {
    var tMeshes = [];
    for(var c = 0; c < object.children.length; c++) {
        var child = object.children[0];
        var geo = child.geometry;
        if(!!geo && !!geo.attributes && !!geo.attributes.uv) {
            var attr = geo.attributes;
            var meshes = {};
            for(var i = 0; i < attr.uv.count; i++) {
                var u = attr.uv.array[i * 2];
                var v = attr.uv.array[(i * 2) + 1];
                var udim = UvToUdim(u, v);
                if(typeof meshes[udim] === 'undefined') {
                    meshes[udim] = {};
                    for(var a in attr) {
                        meshes[udim][a] = {buffer: [], itemSize: attr[a].itemSize};
                    }
                }

                for(var a in attr) {
                    var count = attr[a].itemSize;
                    for(var c = 0; c < count; c++) {
                        meshes[udim][a].buffer.push(attr[a].array[i * count + c]);
                    }
                }
            }
            object.remove(child);
            for(var u in meshes) {
                var buff = new THREE.BufferGeometry();
                var mesh = new THREE.Mesh(buff, new THREE.Material());
                mesh.name = child.name;
                mesh.material.name = child.material.name + "." + u;
                for(var a in meshes[u]) {
                    buff.addAttribute(a, new THREE.BufferAttribute(new Float32Array(meshes[u][a].buffer), meshes[u][a].itemSize));
                }
                buff.setIndex(new THREE.BufferAttribute(new Uint32Array([...Array(buff.attributes.position.count).keys()]), 1, false));
                tMeshes.push(mesh);
            }
        }
    }
    for(var c = 0; c < object.children.length;) {
        object.remove(object.children[c]);
    }
    for(var m = 0; m < tMeshes.length; m++) {
        object.add(tMeshes[m]);
    }
}

function LoadMesh(objPath, mtlxPath, cb) {
    var manager = new THREE.LoadingManager();
    manager.onProgress = function(item, loaded, total) {
        console.log(item, loaded, total);
    }

    var loader = new THREE.OBJLoader(manager);
    loader.load(objPath, function(object) {
        create_materialx_shadermaterials(
            mtlxPath,
            function(mtls, udims) {
                if(!!udims) {
                    MeshProcessUdims(object);
                }
                for(var mtl in mtls) {
                    updateMaterials.push(mtls[mtl]);
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
                            else {
                                return new THREE.MeshBasicMaterial();
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
                addGuiObject(object, objPath);
                cb(object);
            });
    });
}

function FocusObject(object) {
    var bounds = CalcGroupBounds(object);
    camera.position.copy(bounds.center);
    var viewRad = bounds.radius * 1.2;
    var vfov = camera.fov * Math.PI / 180 ;
    var hfov = 2.0 * Math.atan(Math.tan(vfov / 2.0) * camera.aspect)
    var mfov = Math.min(vfov, hfov) / 2.0;
    var dist = viewRad / Math.tan(mfov);
    camera.position.add(new THREE.Vector3(0, 0, dist));
    camera.lookAt(bounds.center);
    controls.target.copy(bounds.center);
}

function MatchLightToBounds(light, bounds) {
    light.shadow.camera.position.copy(bounds.center);
    light.shadow.camera.near = -bounds.radius * 2.0;
    light.shadow.camera.far = bounds.radius * 4.0;
    light.shadow.camera.left = -bounds.radius * 2.0;
    light.shadow.camera.right = bounds.radius * 2.0;
    light.shadow.camera.bottom = -bounds.radius * 2.0;
    light.shadow.camera.top = bounds.radius * 2.0;
    light.shadow.camera.updateProjectionMatrix();
}

function FocusShadows(object) {
    focusBounds = CalcGroupBounds(object);
    for(var i = 0; i < updateLights.length; i++) {
        MatchLightToBounds(updateLights[i], focusBounds);
    }
}

function init() {
    container = document.createElement('div');
    document.body.appendChild(container);
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.z = 10;
    camera.position.y = 1;
    camera.lookAt(new THREE.Vector3(0, 1, 0));

    scene = new THREE.Scene();

    function genCubeUrls(prefix, postfix) {
        return [
            prefix + 'px' + postfix, prefix + 'nx' + postfix,
            prefix + 'py' + postfix, prefix + 'ny' + postfix,
            prefix + 'pz' + postfix, prefix + 'nz' + postfix
        ];
    };

    var hdrPaths = genCubeUrls('/data/PisaHDR/', '.hdr');
    var loader = new THREE.HDRCubeTextureLoader();
    IBL = loader.load(
        THREE.FloatType,
        hdrPaths,
        function() {
            updateRender();
        });

    //LoadMesh("/data/Meshes/SuzanneUdim.obj", "/data/Materials/udims.mtlx", function(object) {
    LoadMesh("/data/Meshes/Suzanne.obj", "/data/Materials/default.mtlx", function(object) {
        FocusObject(object);
        FocusShadows(object)
        scene.add(object);
        updateRender();
    });

    create_materialx_shadermaterial("/data/Materials/ground.mtlx", "default", null, function(mtl) {
        updateMaterials.push(mtl);
        var groundGeo = new THREE.PlaneBufferGeometry(200, 200, 1, 1);
        var ground = new THREE.Mesh(groundGeo, mtl);
        ground.rotateX(-Math.PI / 2.0);
        ground.receiveShadow = true;
        THREE.BufferGeometryUtils.computeTangents(ground.geometry);
        scene.add(ground);
        addGuiObject(ground, "Ground");
    });

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
            type: THREE.FloatType,
            stencilBuffer: false,
        });

    accumTargets = [];
    accumTargets[0] = new THREE.WebGLRenderTarget(
        width,
        height,
        {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            stencilBuffer: false,
            depthBuffer: false
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

    uc = updateRender;

    function hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : null;
    }


    function addLight(name) {
        var directionalLight = new THREE.DirectionalLight(0xffeedd);
        updateLights.push(directionalLight);
        directionalLight.position.set(-0.69, 0.48, 0.63);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.x = 2048;
        directionalLight.shadow.mapSize.y = 2048;
        MatchLightToBounds(directionalLight, focusBounds);
        scene.add(directionalLight);
        var dirGui = lightGui.addFolder(name);
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
        gui.add(window, 'maxAccum').onChange(continueRender);
        gui.add(renderer, 'toneMappingExposure').min(0.0).step(0.01).onChange(uc);
        lightGui = gui.addFolder('Lighting');
        var ambGui = lightGui.addFolder('Ambient');
        addColor(ambGui, ambient.color, 'color');
        ambGui.add(ambient, 'intensity').min(0.0).step(0.01).onChange(uc);
        //ambGui.add(material, 'envMapIntensity').min(0.0).step(0.01).onChange(uc);
        var nextLight = 1;
        var guiParams = {
            addLight : function() {
                addLight('Directional ' + nextLight++);                
            }
        };
        lightGui.add(guiParams, 'addLight');
        guiParams.addLight();

        sceneGui = gui.addFolder('Scene');
    }
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
        updateRender();
    });
    return controller;
}

function addFloat(gui, parent, path, name) {
    var c = {};
    c[name] = parent[path]
    var controller = gui.add(c, name, 0, 1).onChange(function(e) {
        parent[path] = c[name];
        updateRender();
    });
    return controller;
}

function addGuiMaterial(gui, mat, name) {
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

function addGuiObject(obj, name) {
    var objGui = sceneGui.addFolder(name);
    objGui.add(obj, 'visible').onChange(updateRender);
    objGui.add(obj.position, 'x').onChange(updateRender);
    objGui.add(obj.position, 'y').onChange(updateRender);
    objGui.add(obj.position, 'z').onChange(updateRender);
    obj.traverse(function(child) {
        if(!!child.material) {
            addGuiMaterial(objGui, child.material, child.material.name);
        }
    });
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
    function halton(i, base) {
        var res = 0;
        var f = 1;
        while(i > 0) {
            f = f / base;
            res = res + f * (i % base);
            i = i / base;
        }
        return res;
    }

    var halton2 = [halton(accum, 2), halton(accum, 3)];
    for(var i = 0; i < updateMaterials.length; i++) {
        var instRand = Math.random();
        updateMaterials[i].uniforms.envMap = {type: 't', value: IBL};
        updateMaterials[i].uniforms.instRand = {type: 'f', value: instRand};
        updateMaterials[i].uniforms.accumCount = {type: 'i', value: accum};
        updateMaterials[i].uniforms.accumHalton = {type: '2f', value: halton2};
    }
    render();
    if(accum++ < maxAccum || maxAccum < 0) {
        continueRender();
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
    accumPass.uniforms.accumCount = {type: 'i', value: accum};
    accumPass.render(accumTargets[1]);

    // Swap accum targets
    var t = accumTargets[1];
    accumTargets[1] = accumTargets[0];
    accumTargets[0] = t;

    copyPass.uniforms.inTex = {value: t};
    copyPass.render();
}
