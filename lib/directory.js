// third-party dependencies
const Bluebird = require('bluebird');

// own dependencies
const errors = require('./errors');
const aux    = require('./auxiliary');

/**
 * Checks whether the given path is empty
 * and creates a directory if so.
 * Rejects with meanignful error if otherwise.
 * @param {String} dirpath
 * @return {Bluebird}
 */
exports.createDirectory = function (dirpath) {
  if (!dirpath) {
    return Bluebird.reject(new errors.InvalidOption('dirpath', 'required'));
  }
  
  dirpath = aux.ensureStartingFwSlash(dirpath);
  var vfs = this.vfs;
  
  return this.pathExists(dirpath)
    .then((exists) => {
      if (exists) {
        return Bluebird.reject(new errors.PathExists(dirpath));
      } else {
        return new Bluebird((resolve, reject) => {
          // create the directory
          vfs.mkdir(dirpath, (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            resolve();
          });
        });
      }
    })
    .then(() => {
      this.notifyFsEvent('directory-created', {
        path: dirpath
      });
    });
};

/**
 * Reads a directory's contents's stats and returns results
 * in a friendly manner for the wire transfer (POJO)
 */
exports.readDirectory = function (dirpath) {
  
  if (typeof dirpath === 'undefined') {
    return Bluebird.reject(new errors.InvalidOption('dirpath', 'required'));
  }
  
  dirpath = aux.ensureStartingFwSlash(dirpath);
  // trim dirpath's trailing fw-slash (/), if any
  dirpath = aux.trimTrailing(dirpath);
  
  var vfs = this.vfs;
  var self = this;
  
  return new Bluebird((resolve, reject) => {
    vfs.readdir(dirpath, function (err, contents) {
      if (err) {
        reject(err);
        return;
      }
      
      resolve(contents);
    });
  })
  // partial catch
  // catches errors on readdir
  .catch(function (err) {
    
    if (err instanceof vfs.errors.FsError) {
      // it's an FsError known to VRoot
      if (err.code === 'ENOENT') {
        // dirpath does not exist
        return Bluebird.reject(new errors.PathDoesNotExist(dirpath));
        
      } else if (err.code === 'ENOTDIR') {
        // dirpath contains a non-directory
        return Bluebird.reject(new errors.PathIsNotDirectory(dirpath));
      } else {
        // never ignore errors
        return Bluebird.reject(err)
      }
      
    } else if (err instanceof vfs.errors.IllegalPath) {
      // illegal path: dangerous error
      // TODO: build mechanisms of being notified about this
      return Bluebird.reject(err);
      
    } else {
      return Bluebird.reject(err);
    }
  })
  .then(function (contents) {
    
    // TODO:
    // study how to treat errors that happen at this stage.
    // The dirpath contents were already listed and
    // probably won't change. But if any errors happen
    // when we are 'stat'ing the contents, we should provide
    // a better error handling.
    return Bluebird.all(contents.map(function (contentBasename) {
      // manually build the path in order to prevent
      // path injection ('../..' and the like)
      var contentPath = dirpath + '/' + contentBasename;
      
      return self.stat(contentPath).then((stat) => {
        // crunch the stat object and return
        // a plain js object representation for ease of transfer
        // over the wire
        // this is for `isDirectory` and the like functions
        return {
          path: contentPath,
          basename: contentBasename,
          isDirectory: stat.isDirectory(),
          isFile: stat.isFile(),
        };
      });
    }));
  });
};