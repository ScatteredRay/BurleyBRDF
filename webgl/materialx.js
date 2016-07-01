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
                        cb(mtlx);
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
            var shader = get_named(shaders, shaderRef.getAttribute('name'));
            var inputs = shader.getElementsByTagName('input');
            var shaderInputs = {};
            outMat.shaderInputs = shaderInputs;
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
    console.dir(materialList);
    return materialList;
}
