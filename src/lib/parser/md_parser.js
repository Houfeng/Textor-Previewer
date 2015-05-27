var markdown = require("./markdown/markdown");
var fs = require("fs");

var styleCache = null;
var readStyle = function() {
    if (styleCache) return styleCache;
    var styleFile = __dirname + "/markdown/markdown.css";
    if (fs.existsSync(styleFile)) {
        styleCache = fs.readFileSync(styleFile);
    }
    return styleCache;
};

exports.mime = 'text/html';
exports.parse = function(text, callback) {
    if (!text || !callback) return;
    var style = readStyle();
    var body = markdown.toHTML(text.toString());
    var html = "<html>\r\n<head>\r\n<title>Markdown Preview</title>\r\n<meta charset=\"UTF-8\"/>\r\n<style>\r\n" + style + "\r\n</style>\r\n</head>\r\n<body>\r\n" + body + "\r\n</body>\r\n</html>";
    callback(html);
};