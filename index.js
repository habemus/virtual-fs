const HFs = require('./lib');

module.exports = function (rootPath, options) {
  return new HFs(rootPath, options);
};

module.exports.HFs = HFs;