const HFs = require('./lib');
const vroot = require('vroot');

module.exports = function (rootPath, options) {
  var vfs = vroot(rootPath, options);

  return new HFs(vfs);
};

module.exports.HFs = HFs;