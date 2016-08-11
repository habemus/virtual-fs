// native dependencies
const util         = require('util');
const EventEmitter = require('events');
const fs           = require('fs');

// third-party dependencies
const Bluebird        = require('bluebird');
const rootPathBuilder = require('root-path-builder');

// promisify methods
// use fs methods carefully: ensure the file path is built using
// root.prependTo to guarantee the path is always within
// the rootPath
Bluebird.promisifyAll(fs);

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
function HFs(rootPath, options) {

  if (typeof rootPath !== 'string') {
    throw new Error('rootPath MUST be a String');
  }

  options = options || {};

  /**
   * Instance of rootPathBuilder
   * @type {RootPathBuilder}
   */
  this.root = rootPathBuilder(rootPath);

  /**
   * Flag of whether to mute built-in hfs events
   * By default fs events are enabled.
   * @type {Boolean}
   */
  this.suppressFsEvents = options.suppressFsEvents || false;
}
util.inherits(HFs, EventEmitter);

/**
 * Returns stat of the node at the given path
 * within the rootPath.
 * @param {String} path
 * @return {Bluebird -> Stat}
 */
HFs.prototype.stat = function (path) {

  return Bluebird.try(() => {
    // build the full path
    return this.root.prependTo(path);
  })
  .then((fullPath) => {
    return fs.statAsync(fullPath);
  });
};

/**
 * Private method that checks whether a path exists
 * @param {String} path
 * @param {String} type Either `directory` or `file`
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
HFs.prototype.publishFsEvent = function (eventName, data) {
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

  // normalize before checking whether paths are within one another
  fromPath = aux.ensureStartingFwSlash(fromPath);
  toPath   = aux.ensureStartingFwSlash(toPath);

  if (_isPathWithin(toPath, fromPath)) {
    return Bluebird.reject(
      new errors.InvalidOption('toPath', 'invalidPath'));
  }
  
  // moveType will be defined in
  // the first promise chain step
  var moveType;
  
  try {
    var fullFromPath = this.root.prependTo(fromPath);
    var fullToPath   = this.root.prependTo(toPath);
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

    this.publishFsEvent(createdEvent, {
      path: toPath,
    });
    
    // remove the fromPath contents
    return _rimraf(fullFromPath, { glob: false });
  })
  .then(() => {
    
    // emit a `{file|directory}-removed` event
    var removedEvent = moveType === 'directory' ?
      'directory-removed' : 'file-removed';
    
    this.publishFsEvent(removedEvent, {
      path: fromPath,
    });
  })
  .catch((err) => {
    if (err.code === 'ENOENT') {
      return Bluebird.reject(new errors.PathDoesNotExist(fromPath));
    }

    return Bluebird.reject(err);
  });
};

HFs.prototype.remove = function (path) {
  if (!path) {
    return Bluebird.reject(new errors.InvalidOption('path', 'required'));
  }
  
  path = aux.ensureStartingFwSlash(path);

  // to be defined at the first promise chain step
  var removeType;
  
  return this.stat(path)
    .then((stats) => {
      removeType = stats.isDirectory() ? 'directory' : 'file';

      return Bluebird.try(() => {
        return this.root.prependTo(path);
      });
    })
    .then((fullPath) => {
      return _rimraf(fullPath);
    })
    .then(() => {
      
      var removeEvent = removeType === 'directory' ?
        'directory-removed' : 'file-removed';
      
      this.publishFsEvent(removeEvent, {
        path: path
      });
      
    })
    .catch((err) => {
      if (err.code === 'ENOENT') {
        return Bluebird.reject(new errors.PathDoesNotExist(path));
      }

      return Bluebird.reject(err);
    });
};

// assign file and directory methods
Object.assign(HFs.prototype, require('./file'));
Object.assign(HFs.prototype, require('./directory'));

module.exports = HFs;