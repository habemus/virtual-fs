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
  
  it('should update the file\'s contents', function () {
    var hfs = createHFs(TMP_PATH);
    return hfs.updateFile('/file-1', 'new file-1 contents')
      .then(() => {
        fse.readFileSync(TMP_PATH + '/file-1', 'utf8')
          .should.equal('new file-1 contents');
      });
  });

  it('should require filepath', function () {
    var hfs = createHFs(TMP_PATH);

    return hfs.updateFile(undefined, 'new file-1 contents')
      .then(() => {
        return Bluebird.reject(new Error('error expected'));
      }, (err) => {
        err.name.should.equal('InvalidOption');
        err.option.should.equal('filepath');
        err.kind.should.equal('required');
      });
  });

  it('should require file contents not to be undefined', function () {
    var hfs = createHFs(TMP_PATH);

    return hfs.updateFile('/file-1', undefined)
      .then(() => {
        return Bluebird.reject(new Error('error expected'));
      }, (err) => {
        err.name.should.equal('InvalidOption');
        err.option.should.equal('contents');
        err.kind.should.equal('required');
      });
  });

  it('should allow updating contents to an empty string', function () {
    var hfs = createHFs(TMP_PATH);

    return hfs.updateFile('/file-1', '')
      .then(() => {

        fse.readFileSync(TMP_PATH + '/file-1', 'utf8')
          .should.equal('');
      });
  });
  
  it('should emit a `file-updated` event upon successful file update', function () {
    var hfs = createHFs(TMP_PATH)
    
    var EMITTED = false;
    hfs.on('file-updated', function (data) {
      Object.keys(data).length.should.equal(1);
      
      data.path.should.equal('/file-1');
      
      EMITTED = true;
    });

    return hfs.updateFile('/file-1', 'new file-1 contents')
      .then(() => {
        
        fse.readFileSync(TMP_PATH + '/file-1', 'utf8')
          .should.equal('new file-1 contents');
        
        return new Bluebird((resolve, reject) => {
          setTimeout(function () {
            should(EMITTED).equal(true);
            resolve();
          }, 400);
        })
      })
  });
  
  it('should fail to update a file that does not yet exist', function () {
    var hfs = createHFs(TMP_PATH);
    return hfs.updateFile('/file-that-doest-not-exist', 'some content')
      .then(() => {
        done(new Error('error expected'))
      })
      .catch((err) => {
        err.name.should.equal('PathDoesNotExist');
      });
  });
  
  
  it('should fail to update a file that is actually a directory', function () {
    var hfs = createHFs(TMP_PATH);
    return hfs.updateFile('/dir-1/dir-11', 'some content')
      .then(() => {
        done(new Error('error expected'))
      })
      .catch((err) => {
        err.name.should.equal('PathIsDirectory');
      });
  });
  
  
});