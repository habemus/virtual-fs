// native
const path = require('path');

// third-party
const Bluebird = require('bluebird');
const chokidar = require('chokidar');

/**
 * File event handlers
 */
function _handleFileAdd(filepath) {
  var relativePath = this._makeRelativePath(filepath);

  // emit event
  this.emit('file-created', {
    path: relativePath
  });
}

function _handleFileUnlink(filepath) {
  var relativePath = this._makeRelativePath(filepath);

  // emit event
  this.emit('file-removed', {
    path: relativePath
  });
}

function _handleFileChange(filepath) {
  var relativePath = this._makeRelativePath(filepath);

  this.emit('file-updated', {
    path: relativePath
  });
}

/**
 * Directory event handlers
 */
function _handleDirAdd(dirpath) {
  var relativePath = this._makeRelativePath(dirpath);

  this.emit('directory-created', {
    path: relativePath
  });
}

function _handleDirUnlink(dirpath) {
  var relativePath = this._makeRelativePath(dirpath);

  this.emit('directory-removed', {
    path: relativePath
  });
}

exports._makeRelativePath = function (p) {
  // make the p be relative to the vfs
  var fullRootPath = this.vfs.getFullRootPath();
  p = path.relative(fullRootPath, p);

  return '/' + p;
};

exports.startWatcher = function () {
  var fullRootPath = this.vfs.getFullRootPath();

  // set the _usingFsWatcher flag to 'true'
  // so that hfs methods do not emit events on their own
  this._usingFsWatcher = true;

  return new Bluebird((resolve, reject) => {

    var watcher = chokidar.watch(this.vfs.getFullRootPath());
    this.watcher = watcher;

    // wait for the watcher to be ready
    // before attaching event listeners
    watcher.on('ready', () => {
      // files
      watcher
        .on('add', _handleFileAdd.bind(this))
        .on('unlink', _handleFileUnlink.bind(this))
        .on('change', _handleFileChange.bind(this));

      // directories
      watcher
        .on('addDir', _handleDirAdd.bind(this))
        .on('unlinkDir', _handleDirUnlink.bind(this));

      resolve();
    });
  });
};

exports.destroyWatcher = function () {
  this._usingFsWatcher = false;
  this.watcher.close();
};
