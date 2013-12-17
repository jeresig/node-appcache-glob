var async = require("async");
var glob = require("glob");

var AppCache = function() {
    this._data = {
        cache: [],
        network: [],
        fallback: []
    };

    this._globbedFiles = {};

    this._dirty = true;
};

AppCache.prototype = {
    cache: function(files) {
        if (typeof files === "string") {
            files = [files];
        }

        this._data.cache = this._data.cache.concat(files);
        this._dirty = true;
    },

    network: function(files) {
        if (typeof files === "string") {
            files = [files];
        }

        this._data.network = this._data.network.concat(files);
        this._dirty = true;
    },

    glob: function(file, callback) {
        if (file.indexOf("http") === 0) {
            callback(null, file);
        } else {
            glob(file, callback);
        }
    },

    getFiles: function(files, callback) {
        async.concat(files, this.glob, callback);
    },

    bump: function() {
        return (this._key = (new Date).getTime() + Math.random());
    },

    buildCache: function(callback) {
        var self = this;

        if (!this._dirty) {
            return callback();
        }

        this.bump();

        async.each(Object.keys(this._data), function(key, callback) {
            self.getFiles(self._data[key], function(err, files) {
                self._globbedFiles[key] = files;
                callback(err);
            });
        }, callback);

        this._dirty = false;
    },

    clone: function() {
        

    }
};

// Inheritance
// Middleware for Express
module.exports = {
    create: function() {

    }


};
