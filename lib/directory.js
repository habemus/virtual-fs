// native
const fs = require('fs');

// third-party dependencies
const Bluebird = require('bluebird');

// promisify
Bluebird.promisifyAll(fs);
const mkdirpAsync = Bluebird.promisify(require('mkdirp'));

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

  
  // ATTENTION:
  // The existence of the path MUST be checked prior
  // to attempting to create the directory, because mkdirp
  // does not throw error when the directory already exists
  return this.pathExists(dirpath)
    .then((exists) => {
      if (exists) {
        return Bluebird.reject(new errors.PathExists(dirpath));
      }

      var fullDirpath = this.root.prependTo(dirpath);
      
      return mkdirpAsync(fullDirpath);
    })
    .then(() => {
      this.publishFsEvent('directory-created', {
        path: dirpath
      });
    });
};

/**
 * Reads a directory's contents's stats and returns results
 * in a friendly manner for the wire transfer (POJO)
 */
exports.readDirectory = function (dirpath) {
  
  if (typeof dirpath !== 'string') {
    return Bluebird.reject(new errors.InvalidOption('dirpath', 'required'));
  }
  
  dirpath = aux.ensureStartingFwSlash(dirpath);
  // trim dirpath's trailing fw-slash (/), if any
  dirpath = aux.trimTrailing(dirpath);

  return Bluebird.try(() => {
    // '' empty dirpath is a special case
    return (dirpath === '') ? this.root.value() : this.root.prependTo(dirpath);
  })
  .then((fullDirpath) => {
    return fs.readdirAsync(fullDirpath);
  })
  // partial catch
  // catches errors on readdir
  .catch((err) => {
    if (err.code === 'ENOENT') {
      // dirpath does not exist
      return Bluebird.reject(new errors.PathDoesNotExist(dirpath));
      
    } else if (err.code === 'ENOTDIR') {
      // dirpath contains a non-directory
      return Bluebird.reject(new errors.PathIsNotDirectory(dirpath));
    }

    // never ignore errors
    return Bluebird.reject(err);
  })
  .then((contents) => {
    
    // TODO:
    // study how to treat errors that happen at this stage.
    // The dirpath contents were already listed and
    // probably won't change. But if any errors happen
    // when we are 'stat'ing the contents, we should provide
    // a better error handling.
    return Bluebird.all(contents.map((contentBasename) => {
      // manually build the path in order to prevent
      // path injection ('../..' and the like)
      var contentPath = dirpath + '/' + contentBasename;
      
      return this.stat(contentPath).then((stat) => {
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