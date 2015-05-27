var Server = require('./server');
var md_parser = require('./parser/md_parser');
var less_parser = require('./parser/less_parser');

Server.fileParser['markdown'] = md_parser;
Server.fileParser['less'] = less_parser;

var server1 = new Server({
    "path": 'C:\\test',
    "port": 8001
});

server1.stop();
server1.start();