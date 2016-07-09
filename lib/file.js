// third-party dependencies
const Bluebird = require('bluebird');

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
  
  var vfs = this.vfs;
  
  return this.pathExists(filepath)
    .then((exists) => {
      if (exists) {
        return Bluebird.reject(new errors.PathExists(filepath));
      }
      
      return new Bluebird((resolve, reject) => {
        // write the file
        vfs.writeFile(filepath, contents, (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          resolve();
        });
      });
    })
    .then(() => {
      // emit event
      this._emitFsEvent('file-created', {
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
  var vfs = this.vfs;
  
  return new Bluebird((resolve, reject) => {
    vfs.readFile(filepath, (err, contents) => {
      if (err) {
        reject(err);
        return;
      }
      
      resolve(contents);
    });
  })
  .catch((err) => {
    if (err instanceof vfs.errors.FsError) {
      
      // it's an FsError known to VRoot
      if (err.code === 'ENOENT') {
        // filepath does not exist
        return Bluebird.reject(new errors.PathDoesNotExist(filepath));
        
      } else if (err.code === 'EISDIR') {
        // filepath contains a directory
        return Bluebird.reject(new errors.PathIsDirectory(filepath));
      } else {
        // never ignore errors
        return Bluebird.reject(err);
      }
      
    } else if (err instanceof vfs.errors.IllegalPath) {
      // TODO: build reports on this kind of error.
      // this kind of error should not happen at all
      // and is a sign of attacking
      return Bluebird.reject(err);
      
    } else {
      return Bluebird.reject(err);
    }
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
  var self      = this;
  var vfs = this.vfs;
  
  return this.stat(filepath)
    .then((stats) => {
      
      if (stats.isDirectory()) {
        return Bluebird.reject(new errors.PathIsDirectory(filepath));
      }
      
      return new Bluebird((resolve, reject) => {
        vfs.writeFile(filepath, contents, function (err) {
          if (err) {
            reject(err);
            return;
          }
          
          resolve();
        });
      });
    }, (err) => {
      
      if (err instanceof vfs.errors.FsError) {
        if (err.code === 'ENOENT') {
          return Bluebird.reject(new errors.PathDoesNotExist(filepath));
        } else {
          return Bluebird.reject(err);
        }
      } else {
        return Bluebird.reject(err);
      }
    })
    .then(() => {
      self.emit('file-updated', {
        path: filepath
      });
    });
};