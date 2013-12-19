var async = require("async");
var glob = require("glob");

var AppCache = function(options) {
    this._options = options || {};

    this._data = {
        cache: [],
        network: []
    };

    this._globbedFiles = {};

    this._dirty = true;
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

            dest.emit(data);
        });

        return dest;
    },

    clone: function() {
        var clone = new AppCache();

        clone._data = {
            cache: this.data.cache.slice(0),
            network: this.data.network.slice(0)
        };

        return clone;
    },

    route: function() {
        var self = this;

        return function(req, res) {
            self.pipe(res);
        };
    },

    _buildString: function() {
        var str = [];

        var addFiles = function(name) {
            this._data[name].forEach(function(file) {
                if (typeof file === "string") {
                    str.push(file);
                } else {
                    str = str.concat(file);
                }
            })
        };

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
        if (file.indexOf("http") === 0) {
            callback(null, file);
        } else {
            var options = {};

            if (this._options.cwd) {
                options.cwd = this._options.cwd;
            }

            glob(file, options, callback);
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

        this._bump();

        async.each(Object.keys(this._data), function(key, callback) {
            async.concat(self._data[key], self._glob, function(err, files) {
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
