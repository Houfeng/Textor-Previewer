var http = require('http');
var fs = require('fs');
var path = require('path');
var querystring = require("querystring");
var url = require("url");


//mime 类型表
var mimes = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.md': 'text/markdown',
    '.css': 'text/css',
    '.less': 'text/less',
    '.txt': 'text/plain',
    '.js': 'text/javascript',
    '.json': 'application/x-javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '*': 'application/octet-stream'
};

//http 状态表
var status = {
    'error': {
        code: 500,
        message: '{0}<hr/>server error'
    },
    'success': {
        code: 200
    },
    'notfound': {
        code: 404,
        message: '{0}<hr/>not found'
    }
};

//Server类.
var Server = function(option) {
    option = option || {};
    var self = this;
    self.root = option.path || '';
    self.port = option.port || 8000;
    self.configFile = option.config || '/web.json';
    var rootLastChar = self.root[self.root.length - 1];
    if (rootLastChar === '/' || rootLastChar === '\\') {
        self.root = self.root.substr(0, self.length - 1);
    }
    //self.readConfig();
    self.createServer();
};

Server.prototype.readConfig = function(callback) {
    var self = this;
    self.config = {};
    try {
        var configFile = self.root + self.configFile;
        if (fs.existsSync(configFile)) {
            var data = fs.readFileSync(configFile);
            self.config = JSON.parse(data);
        }
    } catch (ex) {
        //no handle
    }
    if (callback) callback();
};

//处理错误
Server.prototype.error = function(req, res, ex) {
    if (!req || !res) return;
    ex = ex || "";
    var self = this;
    res.writeHead(status.error.code, {
        'Content-Type': mimes['.html'],
        'url': req.url
    });
    res.end(status.error.message.replace('{0}', ex.message || ex));
    //console.error(ex.message);
};

//没有找到
Server.prototype.notFound = function(req, res) {
    var self = this;
    res.writeHead(status.notfound.code, {
        'Content-Type': mimes['.html'],
        'url': req.url
    });
    res.end(status.notfound.message.replace('{0}', req.physicalPath));
    //console.error(ex.message);
};

//获取mime
Server.prototype.getMime = function(extname) {
    var self = this;
    self.config.mimes = self.config.mimes || {};
    return self.config.mimes[extname] || mimes[extname] || mimes['*'];
};

//输出目录
Server.prototype.writeFolder = function(req, res) {
    var self = this;
    fs.readdir(req.physicalPath, function(err, files) {
        var buffer = [];
        files.forEach(function(item) {
            var itemPath = path.normalize(req.physicalPath + '/' + item);
            var stats = fs.statSync(itemPath); //临时用同步方式
            if (stats.isDirectory()) {
                buffer.push('<li><a href="' + item + '/">' + item + '/</a></li>');
            } else {
                buffer.push('<li><a href="' + item + '">' + item + '</a></li>');
            }
        });
        res.writeHead(status.success.code, {
            'Content-Type': mimes['.html'],
            'url': req.url
        });
        res.end(req.url + '<hr/><ul>' + buffer.join('') + '</ul>');
    });
};

Server.fileParser = {};

Server.prototype.getParser = function(extname) {
    var self = this;
    self.config.parse_map = self.config.parse_map || {};
    //默认处理眏射
    self.config.parse_map['.md'] = self.config.parse_map['.md'] || 'markdown';
    self.config.parse_map['.less'] = self.config.parse_map['.less'] || 'less';
    self.config.parse_map['.css'] = self.config.parse_map['.css'] || 'less';
    //查找
    var parserName = self.config.parse_map[extname];
    //console.log("user parser : " + parserName);
    if (parserName) {
        return Server.fileParser[parserName];
    } else {
        return null;
    }
};

//输出静态文件
Server.prototype.writeFile = function(req, res) {
    var self = this;
    fs.readFile(req.physicalPath, function(err, data) {
        var extname = path.extname(req.physicalPath);
        var mime = self.getMime(extname);
        var parser = self.getParser(extname);
        if (parser) {
            res.writeHead(status.success.code, {
                'Content-Type': parser.mime,
                'url': req.url
            });
            parser.parse(data, function(rs) {
                res.end(rs);
            });
        } else {
            res.writeHead(status.success.code, {
                'Content-Type': mime,
                'url': req.url
            });
            res.end(data);
        }
    });
};

Server.prototype.parseFwdUrl = function(fwdUrl) {
    var rs = {};
    rs.protocol = fwdUrl.indexOf('https://') - 1 ? 'https://' : 'http://';
    fwdUrl = fwdUrl.replace('https://', '').replace('http://', '');
    var firstSplitIndex = fwdUrl.indexOf('/');
    if (firstSplitIndex > -1) {
        rs.hostAndPort = fwdUrl.substring(0, firstSplitIndex);
        rs.host = rs.hostAndPort.split(':')[0] || '';
        rs.port = rs.hostAndPort.split(':')[1] || 80;
        rs.path = fwdUrl.substring(firstSplitIndex);
    } else {
        rs.hostAndPort = fwdUrl;
        rs.host = rs.hostAndPort.split(':')[0] || '';
        rs.port = rs.hostAndPort.split(':')[1] || 80;
        rs.path = '/';
    }
    return rs;
};

Server.prototype.forward = function(req, res, fwdInfo) {
    var self = this;
    req.headers.host = fwdInfo.hostAndPort;
    req.headers.origin = fwdInfo.protocol + fwdInfo.hostAndPort;
    req.headers.referer = fwdInfo.protocol + fwdInfo.hostAndPort + fwdInfo.path;
    var postData = querystring.stringify(req.postData);
    req.headers["content-length"] = postData.length;
    //delete req.headers["content-length"];
    var remoteReq = http.request({
        host: fwdInfo.host,
        port: fwdInfo.port,
        path: fwdInfo.path,
        method: req.method,
        headers: req.headers
    }, function(remoteRes) {
        res.writeHead(status.success.code, remoteRes.headers);
        remoteRes.on('data', function(data) {
            res.write(data);
        }).on('end', function() {
            res.end();
        });
    }).on('error', function(ex) {
        self.error(req, res, "Remote Error : " + ex.message);
    });
    remoteReq.write(postData + "\n");
    remoteReq.end();
};

Server.prototype.forwardUrl = function(req, res, rule) {
    var self = this;
    //
    var remoteUrl = rule.value;
    //以下是接受数据的代码
    var fwdInfo = self.parseFwdUrl(remoteUrl);
    var query = req.url.split('?')[1] || '';
    if (query.length > 0) {
        fwdInfo.path += (fwdInfo.path.indexOf('?') > -1 ? '&' : '?') + query;
    }
    //debug
    //self.error(req, res, JSON.stringify(req.headers));
    //return;
    self.forward(req, res, fwdInfo);
};

Server.prototype.forwardHost = function(req, res, rule) {
    var self = this;
    //以下是接受数据的代码
    var remoteUrl = rule.value;
    var fwdInfo = self.parseFwdUrl(remoteUrl);
    fwdInfo.path = req.url;
    //debug
    //self.error(req, res, JSON.stringify(req.headers));
    //return;
    self.forward(req, res, fwdInfo);
};

Server.prototype.getFwdExp = function(url, expDic) {
    //console.log(url);
    var rule = null;
    for (var key in expDic) {
        var exp = new RegExp(key);
        if (exp.test(url)) {
            rule = {
                "key": key,
                "value": expDic[key]
            };
            break;
        }
    }
    return rule;
};

Server.prototype.handleFileSystem = function(req, res) {
    var self = this;
    //处理物理文件
    fs.exists(req.physicalPath, function(exists) {
        if (exists) {
            fs.stat(req.physicalPath, function(err, stats) {
                if (stats.isDirectory()) {
                    self.writeFolder(req, res);
                } else {
                    self.writeFile(req, res);
                }
            });
        } else {
            self.notFound(req, res);
        }
    });
};

//处理转发，这个转发是一个不完整的转发，仅用来实现代理请求 “远程服务”
Server.prototype.handleForward = function(req, res) {
    var self = this;
    var urlRule = self.getFwdExp(req.withoutQueryStringURL, self.config.fwd_url);
    var hostRule = self.getFwdExp(req.withoutQueryStringURL, self.config.fwd_host);
    //console.log(urlRule);
    if (urlRule) {
        //console.log("trigger url forward");
        self.forwardUrl(req, res, urlRule);
    } else if (hostRule) {
        //console.log("trigger host forward");
        self.forwardHost(req, res, hostRule);
    } else {
        //console.log("trigger local file");
        self.handleFileSystem(req, res);
    }
};

Server.prototype.handleRequest = function(req, res) {
    var self = this;
    try {
        //console.log(self.config);
        if (self.config.fwd_url || self.config.fwd_host) {
            self.handleForward(req, res);
        } else {
            self.handleFileSystem(req, res);
        }
    } catch (ex) {
        self.error(req, res, ex);
    }
};

Server.prototype.createServer = function() {
    var self = this;
    self.httpServer = http.createServer(function(req, res) {
        req.postData = ''; //这里的 Post Data 只处理表单，不关心文件上传
        req.url = decodeURI(req.url || "");
        req.withoutQueryStringURL = req.url.split('?')[0].split('#')[0];
        req.physicalPath = path.normalize(self.root + '/' + req.withoutQueryStringURL);
        req.addListener("data", function(postDataChunk) {
            req.postData += postDataChunk;
        });
        req.addListener("end", function() {
            req.postData = querystring.parse(req.postData);
            self.handleRequest(req, res);
        });
    });
};

//启动Server
Server.prototype.start = function(port, callback) {
    var self = this;
    try {
        self.readConfig();
        self.port = port || self.port;
        self.httpServer.listen(self.port, callback);
        console.log('Server start on port ' + self.port);
    } catch (ex) {
        console.log('Server start error : ' + ex.message);
    }
};

//停止Server
Server.prototype.stop = function(callback) {
    var self = this;
    try {
        self.httpServer.close(callback);
        console.log('Server Stop.');
    } catch (ex) {
        console.log('Server stop error : ' + ex.message);
    }
};

//导出模块
module.exports = Server;
//