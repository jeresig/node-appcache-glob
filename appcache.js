var async = require("async");
var glob = require("glob");
var _ = require("lodash");

var AppCache = function(options) {
    this._options = _.clone(options) || {};

    this._data = {
        cache: [],
        network: []
    };

    this._globbedFiles = {};

    this._dirty = true;

    this._bump();
};

AppCache.prototype = {
    addCache: function(files) {
        if (typeof files === "string") {
            files = [files];
        }

        this._data.cache = this._data.cache.concat(files);
        this._dirty = true;

        return this;
    },

    addNetwork: function(files) {
        if (typeof files === "string") {
            files = [files];
        }

        this._data.network = this._data.network.concat(files);
        this._dirty = true;

        return this;
    },

    reload: function() {
        this._dirty = true;
        this.buildCache();
        return this;
    },

    getString: function(callback) {
        var self = this;

        this._buildCache(function(err) {
            callback(err, self._buildString());
        });
    },

    pipe: function(dest) {
        this.getString(function(err, data) {
            // Better handle piping directly to an HTTP response
            if (dest.setHeader) {
                // Set the correct header for the file
                dest.setHeader("Content-Type", "text/cache-manifest");

                // Set it to expire immediately, to make sure it's never cached
                dest.setHeader("Expires", "0");
            }

            dest.write(data);
            dest.end();
        });

        return dest;
    },

    route: function() {
        var self = this;

        return function(req, res) {
            self.pipe(res);
        };
    },

    clone: function() {
        var clone = new AppCache();

        clone._options = _.clone(this._options);
        clone._data = _.clone(this._data);
        clone._globbedFiles = _.clone(this.globbedFiles);
        clone._dirty = this._dirty;
        clone._key = this._key;

        return clone;
    },

    _buildString: function() {
        var self = this;
        var str = [];

        var addFiles = function(name) {
            self._globbedFiles[name].forEach(function(file) {
                if (typeof file === "string") {
                    str.push(file);
                } else {
                    str = str.concat(file);
                }
            })
        };

        str.push("CACHE MANIFEST");
        str.push("# " + this._key);

        if (this._data.cache.length) {
            str.push("CACHE:");
            addFiles("cache");
        }

        if (this._data.network.length) {
            str.push("NETWORK:");
            addFiles("network");
        }

        return str.join("\n");
    },

    _glob: function(file, callback) {
        if (file.indexOf("http") === 0 || file.indexOf("*") < 0) {
            callback(null, file);
        } else {
            var options = {};

            if (this._options.cwd) {
                options.cwd = this._options.cwd;
                file = file.replace(/^\//, "");
            }

            glob(file, options, function(err, files) {
                if (files) {
                    files = files.map(function(file) {
                        return "/" + file;
                    });
                }

                callback(err, files);
            });
        }
    },

    _bump: function() {
        this._key = (new Date).getTime() + Math.random();
    },

    _buildCache: function(callback) {
        var self = this;

        if (!this._dirty) {
            return process.nextTick(callback);
        }

        this._dirty = false;
        this._globbedFiles = {};

        async.each(Object.keys(this._data), function(key, callback) {
            async.concatSeries(self._data[key], function(file, callback) {
                self._glob(file, callback);
            }, function(err, files) {
                self._globbedFiles[key] = files;
                callback(err);
            });
        }, callback);

        return this;
    }
};

module.exports = {
    create: function(options) {
        return new AppCache(options);
    }
};
