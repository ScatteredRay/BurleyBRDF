var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');

function typeFromPath(filePath) {
    var ext = path.extname(filePath);
    var typeMap = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".dds": "image/dds",
        ".obj": "text/plain",
        ".mtlx": "text/plain",
        ".glsl": "text/plain",
    };
    return typeMap[ext.toLowerCase()];
}

function responseHeaders(type) {
    return {'Content-Type': type,
            // Just for JS?
            'Access-Control-Allow-Origin' : '*'};
}

function fileResponse(filename, type, headers) {
    if(headers == null) {
        headers = {'Content-Type': "text/plain"};
    }
    return function(res) {
        console.log(filename);
        fs.readFile(filename,
                    function(e, data) {
                        if(!e) {
                            res.writeHead(200,
                                          responseHeaders(type));
                            res.end(data);
                        }
                        else {
                            res.writeHead(404, headers);
                            res.end("Error reading file");
                        }
                    });
    }
}

http.createServer(function(req, res) {
    var query = url.parse(req.url, true).query;
    console.log(req.url);
    if(req.url.match(/^\/data\/.*/)) {
        fileResponse(req.url.replace(/^\//g, "../"), typeFromPath(req.url))(res);
    }
    else if(req.url.match(/^\/shaders\/.*/)) {
        fileResponse(req.url.replace(/^\//g, "../"), typeFromPath(req.url))(res);
    }
    else {
        fileResponse(req.url.replace(/^\//g, ""), typeFromPath(req.url))(res);
    }
}).listen(8080, null);
