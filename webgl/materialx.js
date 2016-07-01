function parse_xml(str) {
    return (new window.DOMParser()).parseFromString(str, "text/xml");
}

function load_materialx(path, cb) {
    var mtls = {};
    fetch(path).then(
        function(res) {
            if(res.ok) {
                res.text().then(function(data) {
                    var xml = parse_xml(data);
                    parse_materialx(xml, mtls);
                    if(typeof cb !== 'undefined')
                        cb(mtls);
                });
            }
        });
    return mtls;
}

function parse_materialx(mtlx, mtls) {
    var materials = mtlx.getElementsByTagName('material');
    var shaders = mtlx.getElementsByTagName('shader');
    var opgraphs = mtlx.getElementsByTagName('opgraph');

    function get_named(array, name) {
        for(var i = 0; i < array.length; i++) {
            if(array[i].getAttribute('name') === name) {
                return array[i];
            }
        }
    }

    function get_file_prefix(node) {
        var prefix = node.getAttribute('fileprefix');
        if(prefix === null)
            prefix = "";
        else
            prefix += '/';
        if(node.parentElement !== null)
            prefix = get_file_prefix(node.parentElement) + prefix;
        return prefix;
    }

    function parse_mtlx_value(value, type) {
        switch(type) {
        case 'float':
            return parseFloat(value);
        case 'color3':
            return value.split(',').map(function(v) { return parseFloat(v); });
        default:
            return value;
        }
    }

    var materialList = {};
    if(typeof mtls !== 'undefined')
        materialList = mtls;

    for(var i = 0; i < materials.length; i++) {
        var m = materials[i];
        var outMat = {};
        materialList[m.getAttribute('name')] = outMat;
        var refs = m.getElementsByTagName('shaderref');
        var shaderRef = refs[0]; //XXX
        {
            var shaderName = shaderRef.getAttribute('name');
            var shader = get_named(shaders, shaderName);
            var inputs = shader.getElementsByTagName('input');
            var shaderInputs = {};
            outMat.shaderInputs = shaderInputs;
            outMat.shader = shaderName;
            for(var j = 0; j < inputs.length; j++) {
                var shaderInput = {};
                shaderInputs[inputs[j].getAttribute('name')] = shaderInput;
                shaderInput.type = inputs[j].getAttribute('type');
                var value = inputs[j].getAttribute('value');
                if(value !== null) {
                    shaderInput.value = value;
                    shaderInput.value = parse_mtlx_value(shaderInput.value, shaderInput.type);
                }
                var opgraphName = inputs[j].getAttribute('opgraph');
                var graphOutputName = inputs[j].getAttribute('graphoutput');
                if(opgraphName !== null && graphOutputName !== null) {
                    var opgraph = get_named(opgraphs, opgraphName);
                    var graphOutput = get_named(opgraph.getElementsByTagName('output'), graphOutputName);
                    var inParam = get_named(graphOutput.getElementsByTagName('parameter'), 'in');
                    if(typeof inParam !== 'undefined') {
                        var inNode = get_named(opgraph.children, inParam.getAttribute('value'));
                        if(typeof inNode !== 'undefined') {
                            //XXX: Handling file only here.
                            var file = get_named(inNode.getElementsByTagName('parameter'), 'file').getAttribute('value');
                            var file_prefix = get_file_prefix(inNode);
                            file = file_prefix + file;
                            shaderInput.file = file;
                        }
                    }
                }
            }
        }
        //'override'
    }
    return materialList;
}

function load_materialx_shaders(path, cb) {

    var uniPrefix = "u_";
    var accPrefix = "mat_";

    var mtlxTypes = {
        'float': {
            'glslType': 'float',
            'uniformType': '1f',
        },
        'color3': {
            'glslType': 'vec3',
            'uniformType': '3f',
        },
    };

    var materials = {};

    load_materialx(path, function(mtl) {
        for(var s in mtl) {
            var uniforms = {};
            var decls = [];
            var accessors = [];

            var material = {
                uniforms: uniforms,
                decls: decls,
                accessors: accessors,
            };

            materials[s] = material;

            for(var i in mtl[s].shaderInputs) {
                //XXX: If the mtlx is from a malicious source, we could create harmful shaders.
                var input = mtl[s].shaderInputs[i];
                var glsltype = mtlxTypes[input.type].glslType;
                var uniformType = mtlxTypes[input.type].uniformType;

                if(typeof input.file !== 'undefined') {
                    var texCoord = "vUv";
                    decls.push("uniform sampler2D " + uniPrefix + i + ";");
                    accessors.push(glsltype + " " + accPrefix + i + "() { return texture2D(" + uniPrefix + i + ", " + texCoord + "); }");
                }
                else if(typeof input.value !== 'undefined') {
                    uniforms[uniPrefix + i] = {type: uniformType, value: input.value};
                    decls.push("uniform " + glsltype + " " + uniPrefix + i + ";");
                    accessors.push(glsltype + " " + accPrefix + i + "() { return " + uniPrefix + i + "; }");
                }
            }
        }
        if(typeof cb !== 'undefined')
            cb(materials);
    });

    return materials;
}

if(typeof THREE !== 'undefined') {
    function create_materialx_shadermaterial(path, matName, cb) {
        var material = new THREE.ShaderMaterial({});
        load_materialx_shaders(path, function(mtl) {
            var uniforms = mtl[matName].uniforms;
            uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib["lights"], uniforms]);
            material.uniforms = uniforms;
            material.lights = true;

            fetch('/shaders/surface_vert.glsl').then(
                function(res) {
                    if(res.ok) {
                        res.text().then(function(text) {
                            material.vertexShader = text;
                            material.needsUpdate = true;
                        });
                    }
                }
            );

            fetch('/shaders/surface_frag.glsl').then(
                function(res) {
                    if(res.ok) {
                        res.text().then(function(text) {
                            var fragSrc =
                                mtl[matName].decls.join('\n') + "\n\n" +
                                mtl[matName].accessors.join('\n') + "\n\n" +
                                text;
                            material.fragmentShader = fragSrc;
                            material.needsUpdate = true;
                        });
                    }
                }
            );
        });
        window.mmat = material;
        return material;
    }
}
