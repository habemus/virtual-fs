const HFs = require('./lib');
const vroot = require('vroot');

module.exports = function (rootPath) {
  var vfs = vroot(rootPath);

  return new HFs(vfs);
};

module.exports.HFs = HFs;