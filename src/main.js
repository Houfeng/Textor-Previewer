define(function(require, exports, module) {
    "require:nomunge,exports:nomunge,module:nomunge";
    var self = exports;

    var gui = require('self/utils/menu');
    var store = require('mokit/store');
    var utils = require('mokit/utils');
    var Server = require_node(require.toUrl('./lib/server'));
    var md_parser = require_node(require.toUrl('./lib/parser/md_parser'));
    var less_parser = require_node(require.toUrl('./lib/parser/less_parser'));

    Server.fileParser['markdown'] = md_parser;
    Server.fileParser['less'] = less_parser;

    var finderItem = null;
    var context = null;
    var serverCache = {};
    var portCacheKey = 'web-preview-port-index';

    var getPort = function() {
        var port = (store.session.get(portCacheKey) || 10000) + 1;
        store.session.set(portCacheKey, port);
        return port;
    };

    self.onReady = function(_context) {
        context = _context;
    };

    self.onCreateContextMenu = function(contextMenu) {
        var previewMenu = new gui.MenuItem({
            label: 'Web Preview',
            click: function() {
                if (finderItem) {
                    serverCache[finderItem.path] = serverCache[finderItem.path] || new Server({
                        "path": finderItem.path,
                        "port": getPort(),
                        "config": "/web.json"
                    });
                    var server = serverCache[finderItem.path] || {};
                    try {
                        server.stop();
                        server.start();
                    } catch (ex) {};
                    context.shell.openExternal('http://localhost:' + server.port);
                }
            }
        });
        //
        utils.async(function() {
            contextMenu.finder.append(new gui.MenuItem({
                type: 'separator'
            }));
            contextMenu.finder.append(previewMenu);
        }, 1000);

        contextMenu.finder.on('popup',function() {
            finderItem = contextMenu.finder.finderItem;
            previewMenu.enabled = finderItem.isRoot && (finderItem.type == 'dir');
        });
    };

});