// native
const fs        = require('fs');
const NODE_PATH = require('path');

// third-party dependencies
const Bluebird = require('bluebird');

// promisify
Bluebird.promisifyAll(fs);
const mkdirpAsync = Bluebird.promisify(require('mkdirp'));

// own dependencies
const errors = require('./errors');
const aux    = require('./auxiliary');

/**
 * Checks if the given filepath is empty and creates
 * a file in it if so. If otherwise, rejects with meaningful
 * error.
 * 
 * Optionally set the contents of the file. Defaults to ''
 * @param {String} filepath
 * @param {String|Buffer} contents
 * @return {Bluebird}
 */
exports.createFile = function(filepath, contents) {
  if (!filepath) {
    return Bluebird.reject(new errors.InvalidOption('filepath', 'required'));
  }
  
  filepath = aux.ensureStartingFwSlash(filepath);
  contents = contents || '';

  var _fullFilepath;

  // ATTENTION:
  // The existence of the path MUST be checked prior
  // to attempting to write the file, in order to prevent
  // contents from being overwritten
  return this.pathExists(filepath)
    .then((exists) => {
      if (exists) {
        return Bluebird.reject(new errors.PathExists(filepath));
      }

      _fullFilepath = this.root.prependTo(filepath);

      var _fullDirpath = NODE_PATH.dirname(_fullFilepath);

      return mkdirpAsync(_fullDirpath);
    })
    .then(() => {
      // write the file
      return fs.writeFileAsync(_fullFilepath, contents);
    })
    .then(() => {
      // emit event
      this.publishFsEvent('file-created', {
        path: filepath
      });
    });
};

/**
 * Reads a file's contents
 * @param {String} filepath
 * @return {Bluebird -> Buffer}
 */
exports.readFile = function (filepath) {
  if (!filepath) {
    return Bluebird.reject(new errors.InvalidOption('filepath', 'required'));
  }
  
  filepath = aux.ensureStartingFwSlash(filepath);

  return Bluebird.try(() => {
    return this.root.prependTo(filepath);
  })
  .then((fullFilepath) => {
    return fs.readFileAsync(fullFilepath);
  })
  .catch((err) => {

    if (err.code === 'ENOENT') {
      // filepath does not exist
      return Bluebird.reject(new errors.PathDoesNotExist(filepath));
      
    } else if (err.code === 'EISDIR') {
      // filepath contains a directory
      return Bluebird.reject(new errors.PathIsDirectory(filepath));
    }

    return Bluebird.reject(err);
  });
};

exports.updateFile = function (filepath, contents) {
  if (!filepath) {
    return Bluebird.reject(new errors.InvalidOption('filepath', 'required'));
  }
  
  if (typeof contents === 'undefined') {
    return Bluebird.reject(new errors.InvalidOption('contents', 'required'));
  }
  
  filepath = aux.ensureStartingFwSlash(filepath);
  
  return this.stat(filepath)
    .then((stats) => {
      
      if (stats.isDirectory()) {
        return Bluebird.reject(new errors.PathIsDirectory(filepath));
      }

      var fullFilepath = this.root.prependTo(filepath);

      return fs.writeFileAsync(fullFilepath, contents);

    })
    .then(() => {
      this.publishFsEvent('file-updated', {
        path: filepath
      });
    })
    .catch((err) => {
      if (err.code === 'ENOENT') {
        return Bluebird.reject(new errors.PathDoesNotExist(filepath));
      }
      
      return Bluebird.reject(err);
    })
};