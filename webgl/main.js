var container;

var camera;
var scene;
var renderer;
var controls;

var mouseX = 0;
var mouseY = 0;

var gui;

init();
animate();

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
    var IBL = loader.load(THREE.FloatType, hdrPaths);

    var material = create_materialx_shadermaterial("/data/Materials/default.mtlx", "default");
    material.uniforms.envMap = {type: 't', value: IBL};

    var loader = new THREE.OBJLoader(manager);
    loader.load('/data/Meshes/Suzanne.obj', function(object) {
        object.traverse(function(child) {
            if(child instanceof THREE.Mesh) {
                if(child.geometry.index === null) {
                    child.geometry.setIndex(new THREE.BufferAttribute(new Uint32Array([...Array(child.geometry.attributes.position.count).keys()]), 1, false));
                }
                THREE.BufferGeometryUtils.computeTangents(child.geometry);
                child.castShadow = true;
                child.receiveShadow = true;
                child.material = material;
            }
        });
        scene.add(object);
        requestAnimationFrame(animate);
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

    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;
    var oldUpdate = controls.update;
    controls.update = function() {
        var ret = oldUpdate();
        requestAnimationFrame(animate);        
    }

    var ambient = new THREE.AmbientLight(0x101030);
    scene.add(ambient);

    function uc(e) {
        requestAnimationFrame(animate);
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
        var matGui = gui.addFolder('Material');
        addColor(matGui, material.color, 'color');
        //matGui.add(material, 'roughness', 0, 1).onChange(uc);
        var nextLight = 1;
        var guiParams = {
            addLight : function() {
                addLight('Directional ' + nextLight++);                
            }
        };
        gui.add(guiParams, 'addLight');
        guiParams.addLight();

    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innderWidth, window.innerHeight);
    requestAnimationFrame(animate);
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
    //requestAnimationFrame(animate);
    render();
}

function render() {
    /*camera.position.x += (mouseX - camera.position.x) * 0.05;
    camera.position.y += (- mouseY - camera.position.y) * 0.05;
    camera.position = camera.position.normalize() * cameraDistance;
    camera.lookAt(scene.position);*/
    renderer.render(scene, camera);
}
