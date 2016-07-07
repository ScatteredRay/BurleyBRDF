var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');
var async = require('async');

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
        headers = {'Content-Type': type};
    }
    return function(res) {
        console.log(filename);
        fs.readFile(filename,
                    function(e, data) {
                        if(!e) {
                            res.writeHead(200, responseHeaders(type));
                            res.end(data);
                        }
                        else {
                            res.writeHead(404, headers);
                            res.end("Error reading file");
                        }
                    });
    }
}

function shaderResponse(filename) {
    type = "text/plain"

    return function(res) {
        console.log("Processing Shader " + filename);
        fs.readFile(
            filename,
            function(e, data) {
                if(!e) {
                    var shader = data.toString();
                    var includes = [];
                    shader.replace(
                        /#include "(.*)"/g,
                        function(match, include) {
                            includes.push({match: match, include: include});
                            return match;
                        });
                    async.each(
                        includes,
                        function(inc, cb) {
                            fs.readFile(
                                "../shaders/" + inc.include,
                                function(e, data) {
                                    if(!e) {
                                        shader = shader.replace(inc.match, data.toString());
                                        cb();
                                    }
                                    else {
                                        cb("Error reading file: " + inc.include)
                                    }
                                });
                        },
                        function(err) {
                            if(err) {
                                res.writeHead(404, responseHeaders(type));
                                res.end(err);
                            }
                            else {
                                res.writeHead(200, responseHeaders(type));
                                res.end(shader);
                            }
                        });
                }
                else {
                    res.writeHead(404, responseHeaders(type));
                    res.end("Error reading file.");
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
        shaderResponse(req.url.replace(/^\//g, "../"), typeFromPath(req.url))(res);
    }
    else {
        fileResponse(req.url.replace(/^\//g, ""), typeFromPath(req.url))(res);
    }
}).listen(8080, null);
