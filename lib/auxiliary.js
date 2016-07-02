const startingSlashRegExp = /^\//;
const trailingSlashRegExp = /\/$/;
const slashesRegExp = /(^\/)|(\/$)/g;

// function trimStart(p) {
//   return p.replace(startingSlashRegExp, '');
// }

function trimTrailing(p) {
  return p.replace(trailingSlashRegExp, '');
}

// function trim(p) {
//   return p.replace(slashesRegExp, '');
// }

// function splitPath(p) {
//   return trim(p).split('/');
// };

/**
 * Auxiliary function that ensures paths start with the forward slash
 * @param {String} path
 */
function ensureStartingFwSlash(path) {
  return startingSlashRegExp.test(path) ? path : '/' + path;
}


// exports.trimStart = trimStart;
exports.trimTrailing = trimTrailing;
exports.ensureStartingFwSlash = ensureStartingFwSlash;
// exports.trim = trim;
// exports.splitPath = splitPath;
