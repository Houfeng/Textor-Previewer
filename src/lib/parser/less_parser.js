var less = require("./less");

exports.mime = 'text/css';
exports.parse = function(text, callback) {
    if (!text || !callback) return;
    less.render(text.toString(), function(ex, css) {
        callback(css);
    });
};