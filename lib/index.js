// native dependencies
const util = require('util');
const EventEmitter = require('events');

// third-party dependencies
const Bluebird = require('bluebird');

// use cpr carefully: ensure the file path is built using
// vroot.buildFullRootPath(path) to guarantee the path is always within
// the vfs' path
const _cpr      = Bluebird.promisify(require('cpr'));
const _rimraf   = Bluebird.promisify(require('rimraf'));

// own dependencies
const errors = require('./errors');
const aux    = require('./auxiliary');

/**
 * HFs Constructor.
 * Is an EventEmitter
 */
function HFs(vfs) {
  if (!vfs) { throw new Error('vfs is required'); }
  this.vfs = vfs;
}
util.inherits(HFs, EventEmitter);

/**
 * Promisified version of stat
 * We define a method here because throughout this application
 * we use virtualRoot to access filesystem
 * The vfs is a vroot (see node module vroot) instance
 * that prohibits access to parent directories.
 * 
 * It is very dangerous to use any kind of automated path building
 * and method modification, thus the code duplication: to guarantee
 * security.
 */
HFs.prototype.stat = function (path) {
  return new Bluebird((resolve, reject) => {
    this.vfs.stat(path, (err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      
      resolve(stats);
    });
  });
};

/**
 * Private method that checks whether a path exists
 * @param {String} path
 * @return {Bluebird -> Boolean}
 */
HFs.prototype.pathExists = function (path) {
  
  return this.stat(path).then((stats) => {
    // path exists, as no error was thrown
    return true;
  })
  .catch((err) => {
    if (err.code === 'ENOENT') {
      // the path does not exist
      return false;
    } else {
      // otherwise throw the error
      return Bluebird.reject(err);
    }
  });
};

/**
 * checks if a fs watcher is in use.
 * if so, silently discard the event as the file watcher should
 * handle event emitting
 */
HFs.prototype._emitFsEvent = function (eventName, data) {

  console.log('_emitFsEvent', eventName)

  if (!this._usingFsWatcher) {
    this.emit(eventName, data);
  }
}

HFs.prototype.move = function (fromPath, toPath) {
  if (!fromPath) {
    return Bluebird.reject(
      new errors.InvalidOption('fromPath', 'required'));
  }
  
  if (!toPath) {
    return Bluebird.reject(
      new errors.InvalidOption('toPath', 'required'));
  }
  
  if (toPath.startsWith(fromPath)) {
    return Bluebird.reject(
      new errors.InvalidOption('toPath', 'invalidPath'));
  }
  
  fromPath = aux.ensureStartingFwSlash(fromPath);
  toPath   = aux.ensureStartingFwSlash(toPath);
  
  var vfs = this.vfs;
  // moveType will be defined in
  // the first promise chain step
  var moveType;
  
  try {
    var fullFromPath = vfs.buildFullRootPath(fromPath);
    var fullToPath   = vfs.buildFullRootPath(toPath);
  } catch (err) {
    return Bluebird.reject(err);
  }
  
  return Bluebird.all([
    // stat the fromPath
    this.stat(fromPath),
    // check if the toPath exists
    this.pathExists(toPath)
  ])
  .then((results) => {
    
    // check the fromStats
    var fromStats = results[0];
    moveType = fromStats.isDirectory() ? 'directory' : 'file';
    
    if (results[1]) {
      return Bluebird.reject(new errors.PathExists(toPath));
    }
    
    // as _cpr is an external module, we have to pass
    // the full absolute path to it.
    return _cpr(fullFromPath, fullToPath, {
      deleteFirst: false,
      overwrite: false,
      confirm: true
    });
  })
  .then((files) => {

    // check if a fs watcher is in use
    

    // emit a `{file|directory}-created` event
    var createdEvent = moveType === 'directory' ?
      'directory-created' : 'file-created';

    this._emitFsEvent(createdEvent, {
      path: toPath,
    });
    
    // remove the fromPath contents
    return _rimraf(fullFromPath, { glob: false });
  })
  .then(() => {
    
    // emit a `{file|directory}-removed` event
    var removedEvent = moveType === 'directory' ?
      'directory-removed' : 'file-removed';
    
    this._emitFsEvent(removedEvent, {
      path: fromPath,
    });
  })
  .catch((err) => {
    if (err instanceof vfs.errors.FsError) {
      
      if (err.code === 'ENOENT') {
        return Bluebird.reject(new errors.PathDoesNotExist(fromPath));
      } else {
        return Bluebird.reject(err);
      }
      
    } else if (err instanceof vfs.errors.IllegalPath) {
      // illegal path: dangerous error
      // TODO: build mechanisms of being notified about this
      return Bluebird.reject(err);

    } else {
      return Bluebird.reject(err);
    }
  });
};

HFs.prototype.remove = function (path) {
  if (!path) {
    return Bluebird.reject(new errors.InvalidOption('path', 'required'));
  }
  
  path = aux.ensureStartingFwSlash(path);
  var vfs = this.vfs;
  // to be defined at the first promise chain step
  var removeType;
  
  return this.stat(path)
    .then((stats) => {
      
      var fullPath;
      
      try {
        // build the removal path using vfs
        // in order to make sure resulting path is valid
        fullPath = vfs.buildFullRootPath(path);
      } catch (err) {
        return Bluebird.reject(err);
      }
      
      removeType = stats.isDirectory() ? 'directory' : 'file';
      
      return _rimraf(fullPath);
    })
    .then(() => {
      
      var removeEvent = removeType === 'directory' ?
        'directory-removed' : 'file-removed';
      
      this._emitFsEvent(removeEvent, {
        path: path
      });
      
    })
    .catch((err) => {
      if (err instanceof vfs.errors.FsError) {
        if (err.code === 'ENOENT') {
          return Bluebird.reject(new errors.PathDoesNotExist(path));
        } else {
          return Bluebird.reject(err);
        }
      } else {
        return Bluebird.reject(err);
      }
    });
};

// assign file and directory methods
Object.assign(HFs.prototype, require('./file'));
Object.assign(HFs.prototype, require('./directory'));
Object.assign(HFs.prototype, require('./fs-watching'));

module.exports = HFs;