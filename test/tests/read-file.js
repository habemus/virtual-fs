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

describe('HFS#readFile(filepath)', function () {

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
  
  it('should read the file\'s contents', function () {
    var hfs = createHFs(TMP_PATH)
    
    return hfs.readFile('/dir-1/file-11')
      .then((contents) => {
        // always returns buffer
        contents.should.be.instanceof(Buffer);
        contents.toString().should.equal('file-11 contents');
      });
  });
  
  it('should fail to read a filepath that is actually a directory', function () {
    var hfs = createHFs(TMP_PATH)
    
    return hfs.readFile('/dir-1/dir-12')
      .then(() => {
        throw new Error('error expected');
      })
      .catch((err) => {
        err.name.should.equal('PathIsDirectory');
      })
  });
  
  it('should fail to read a filepath does not exist', function () {
    var hfs = createHFs(TMP_PATH)
    
    return hfs.readFile('/dir-1/does-not/exist')
      .then(() => {
        throw new Error('error expected');
      })
      .catch((err) => {
        err.name.should.equal('PathDoesNotExist');
      })
  });
  
  it('should fail to read a filepath does not exist', function () {
    var hfs = createHFs(TMP_PATH);
    
    return hfs.readFile('../another-project/dir/file-1')
      .then(() => {
        throw new Error('error expected');
      })
      .catch((err) => {
        err.name.should.equal('IllegalPath');
      });
  });
  
});