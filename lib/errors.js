const util = require('util');

function HFsError(message) {
  Error.call(this, message);
}
util.inherits(HFsError, Error);

// TODO:
// copy over node.js error codes.


/**
 * Happens when any required option is invalid
 *
 * error.option should have the option that is invalid
 * error.kind should contain details on the error type
 * 
 * @param {String} option
 * @param {String} kind
 * @param {String} message
 */
function InvalidOption(option, kind, message) {
  HFsError.call(this, message);

  this.option = option;
  this.kind = kind;
}
util.inherits(InvalidOption, HFsError);
InvalidOption.prototype.name = 'InvalidOption';
exports.InvalidOption = InvalidOption;

/**
 * Happens when an operation that requires
 * a path be empty is executed against a path
 * that has either a file or a directory
 * @param {String} path
 */
function PathExists(path, message) {
  HFsError.call(this, message);
  
  this.path = path;
}
util.inherits(PathExists, HFsError);
PathExists.prototype.name = 'PathExists';

/**
 * Happens when an operation that requires a given
 * path to exist is executed against a path
 * that is empty.
 * @param {String} path
 */
function PathDoesNotExist(path, message) {
  HFsError.call(this, message);
  
  this.path = path;
}
util.inherits(PathDoesNotExist, HFsError);
PathDoesNotExist.prototype.name = 'PathDoesNotExist';

/**
 * Happens when an operation that requires a file at a given path
 * finds a directory instead
 * @param {String} path
 */
function PathIsDirectory(path, message) {
  HFsError.call(this, message);
  
  this.path = path;
}
util.inherits(PathIsDirectory, HFsError);
PathIsDirectory.prototype.name = 'PathIsDirectory';

/**
 * Happens when an operation that requires a directory at a given path
 * finds a file instead
 * @param {String} path
 */
function PathIsNotDirectory(path, message) {
  HFsError.call(this, message);
  
  this.path = path;
}
util.inherits(PathIsNotDirectory, HFsError);
PathIsNotDirectory.prototype.name = 'PathIsNotDirectory';

exports.InvalidOption = InvalidOption;
exports.PathExists = PathExists;
exports.PathDoesNotExist = PathDoesNotExist;
exports.PathIsDirectory = PathIsDirectory;
exports.PathIsNotDirectory = PathIsNotDirectory;
