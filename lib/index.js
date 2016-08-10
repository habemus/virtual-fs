// native dependencies
const util         = require('util');
const EventEmitter = require('events');

// third-party dependencies
const Bluebird = require('bluebird');
const vroot = require('vroot');

// use cpr carefully: ensure the file path is built using
// vroot.joinAbsolutePath(path) to guarantee the path is always within
// the vfs' path
const _cpr      = Bluebird.promisify(require('cpr'));
const _rimraf   = Bluebird.promisify(require('rimraf'));

// own dependencies
const errors = require('./errors');
const aux    = require('./auxiliary');

function _isPathWithin(path, potentialParent) {
  return path.startsWith(potentialParent) && 
         (path.split('/').length > potentialParent.split('/').length);
}

/**
 * HFs Constructor.
 * Is an EventEmitter
 */
function HFs(vfs, options) {
  if (!vfs) { throw new Error('vfs is required'); }

  if (typeof vfs === 'string') {
    // vfs is actually the rootPath
    vfs = vroot(vfs);
  }

  options = options || {};

  this.vfs = vfs;

  /**
   * Flag of whether to mute built-in hfs events
   * By default fs events are enabled.
   * @type {Boolean}
   */
  this.suppressFsEvents = options.suppressFsEvents || false;
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
HFs.prototype.pathExists = function (path, type) {
  if (!path) {
    return Bluebird.reject(new errors.InvalidOption('path', 'required'));
  }
  
  return this.stat(path).then((stats) => {
    // path exists, as no error was thrown
    // if a type is passed, check if the stats type
    // matches the required one
    if (!type) {
      return true
    } else if (type === 'directory') {
      return stats.isDirectory();
    } else if (type === 'file') {
      return stats.isFile();
    } else {
      return false;
    }
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
 * Checks whether fs events are to be suppressed before emitting event
 */
HFs.prototype.notifyFsEvent = function (eventName, data) {
  if (this.suppressFsEvents) {
    return;
  }
  this.emit(eventName, data);
};

HFs.prototype.move = function (fromPath, toPath) {
  if (!fromPath) {
    return Bluebird.reject(
      new errors.InvalidOption('fromPath', 'required'));
  }
  
  if (!toPath) {
    return Bluebird.reject(
      new errors.InvalidOption('toPath', 'required'));
  }

  if (_isPathWithin(toPath, fromPath)) {
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
    var fullFromPath = vfs.joinAbsolutePath(fromPath);
    var fullToPath   = vfs.joinAbsolutePath(toPath);
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
    // emit a `{file|directory}-created` event
    var createdEvent = moveType === 'directory' ?
      'directory-created' : 'file-created';

    this.notifyFsEvent(createdEvent, {
      path: toPath,
    });
    
    // remove the fromPath contents
    return _rimraf(fullFromPath, { glob: false });
  })
  .then(() => {
    
    // emit a `{file|directory}-removed` event
    var removedEvent = moveType === 'directory' ?
      'directory-removed' : 'file-removed';
    
    this.notifyFsEvent(removedEvent, {
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
        fullPath = vfs.joinAbsolutePath(path);
      } catch (err) {
        return Bluebird.reject(err);
      }
      
      removeType = stats.isDirectory() ? 'directory' : 'file';
      
      return _rimraf(fullPath);
    })
    .then(() => {
      
      var removeEvent = removeType === 'directory' ?
        'directory-removed' : 'file-removed';
      
      this.notifyFsEvent(removeEvent, {
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

module.exports = HFs;