// native dependencies
const path   = require('path');
const assert = require('assert');
const http   = require('http');

// third-party dependencies
const should = require('should');
const fse    = require('fs-extra');
const Bluebird = require('bluebird');

// the lib
const createHFs = require('../../');

const TMP_PATH = path.join(__dirname, '../tmp');

describe('HFS#pathExists(path, type)', function () {

  beforeEach(function () {

    fse.emptyDirSync(TMP_PATH);

    // root contents
    fse.ensureDirSync(TMP_PATH + '/dir-1');
    fse.ensureDirSync(TMP_PATH + '/dir-2');
    fse.writeFileSync(TMP_PATH + '/file-1', 'file-1 contents');
    fse.writeFileSync(TMP_PATH + '/file-2', 'file-2 contents');
    
    // dir-1 contents
    fse.ensureDirSync(TMP_PATH + '/dir-1/dir-11');
    fse.ensureDirSync(TMP_PATH + '/dir-1/dir-12');
    fse.writeFileSync(TMP_PATH + '/dir-1/file-11', 'file-11 contents');
  });

  afterEach(function () {
    fse.emptyDirSync(TMP_PATH);
  });

  it('should return true if the path exists', function () {
    var hfs = createHFs(TMP_PATH);

    return hfs.pathExists('/dir-1')
      .then((exists) => {
        exists.should.equal(true);
      });
  });

  it('should return false if the path does not exist', function () {
    var hfs = createHFs(TMP_PATH);

    return hfs.pathExists('/path-that/does/not-exist')
      .then((exists) => {
        exists.should.equal(false);
      })
  });

  it('should return true when asked for a directory path and given a directory path', function () {
    var hfs = createHFs(TMP_PATH);

    return hfs.pathExists('/dir-1', 'directory')
      .then((exists) => {
        exists.should.equal(true);
      });
  });

  it('should return false when asked for a directory path and given a file path', function () {
    var hfs = createHFs(TMP_PATH);

    return hfs.pathExists('/file-1', 'directory')
      .then((exists) => {
        exists.should.equal(false);
      });
  })

  it('should return false when asked for a file path and given a directory path', function () {
    var hfs = createHFs(TMP_PATH);

    return hfs.pathExists('/dir-1', 'file')
      .then((exists) => {
        exists.should.equal(false);
      });
  });

  it('should return true when asked for a file path and given a file path', function () {
    var hfs = createHFs(TMP_PATH);

    return hfs.pathExists('/file-1', 'file')
      .then((exists) => {
        exists.should.equal(true);
      });
  });

  it('should require path as the first argument', function () {
    var hfs = createHFs(TMP_PATH);

    return hfs.pathExists()
      .then(() => {
        return Bluebird.reject(new Error('error expected'));
      }, (err) => {
        err.name.should.equal('InvalidOption');
        err.kind.should.equal('required');
        err.option.should.equal('path');
      });
  });
});