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

describe('HFS#move', function () {
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
    fse.writeFileSync(
      TMP_PATH + '/dir-1/file-11',
      'file-11 contents');
    fse.writeFileSync(
      TMP_PATH + '/dir-1/dir-11/file-111',
      'file-111 contents');
    fse.writeFileSync(
      TMP_PATH + '/dir-1/dir-11/file-112',
      'file-112 contents');
  });

  afterEach(function () {
    fse.emptyDirSync(TMP_PATH);
  });
  
  it('should move a file to another path', function () {
    var hfs = createHFs(TMP_PATH);

    return hfs.move('/file-1', '/another-file')
      .then(() => {
        var readFile1Err;
        
        // `/file-1` should not exist anymore
        try {
          fse.readFileSync(TMP_PATH + '/file-1', 'utf8');
        } catch (e) {
          readFile1Err = e;
        }
        
        if (!readFile1Err) {
          throw new Error('error expected');
          return;
        }
        
        readFile1Err.code.should.equal('ENOENT');
        
        // `/another-file` should have the original file-1 contents
        fse.readFileSync(TMP_PATH + '/another-file', 'utf8')
          .should.equal('file-1 contents');
      });
  });
  
  it('should emit a `file-moved` event upon succesfully moving a file', function () {

    var hfs = createHFs(TMP_PATH);

    var EMITTED = false;
    hfs.on('file-moved', function (data) {
      Object.keys(data).length.should.equal(2);
      data.fromPath.should.equal('/file-1');
      data.toPath.should.equal('/another-file');
      
      EMITTED = true;
    });

    return hfs.move('/file-1', '/another-file')
      .then(() => {
        var readFile1Err;
        
        // `/file-1` should not exist anymore
        try {
          fse.readFileSync(TMP_PATH + '/file-1', 'utf8');
        } catch (e) {
          readFile1Err = e;
        }
        
        if (!readFile1Err) {
          throw new Error('error expected');
          return;
        }
        
        readFile1Err.code.should.equal('ENOENT');
        
        // `/another-file` should have the original file-1 contents
        fse.readFileSync(TMP_PATH + '/another-file', 'utf8')
          .should.equal('file-1 contents');

        return new Bluebird((resolve, reject) => {          
          setTimeout(function () {
            should(EMITTED).equal(true);

            resolve();
          }, 400);
        });
      });
  });
  
  it('should move a directory to another path', function () {
    
    var hfs = createHFs(TMP_PATH);

    return hfs.move('/dir-1/dir-11', '/another-dir')
      .then(() => {
        var readdir1Err;
        
        // `/dir-1/dir-11` should not exist anymore
        try {
          fse.readdirSync(TMP_PATH + '/dir-1/dir-11');
        } catch (e) {
          readdir1Err = e;
        }
        
        if (!readdir1Err) {
          throw new Error('error expected');
          return;
        }
        
        readdir1Err.code.should.equal('ENOENT');
        
        // `/another-dir` should have the original dir's contents
        fse.readdirSync(TMP_PATH + '/another-dir')
          .should.eql(['file-111', 'file-112']);
      })
  });

  it('should emit a `directory-moved` upon successfully moving a directory', function () {
    
    var hfs = createHFs(TMP_PATH);

    var EMITTED = false;
    hfs.on('directory-moved', function (data) {
      Object.keys(data).length.should.equal(2);
      
      data.fromPath.should.equal('/dir-1/dir-11');
      data.toPath.should.equal('/another-dir');
      
      EMITTED = true;
    });
    
    return hfs.move('dir-1/dir-11', '/another-dir')
      .then(() => {
        var readdir1Err;
        
        // `/dir-1/dir-11` should not exist anymore
        try {
          fse.readdirSync(TMP_PATH + '/dir-1/dir-11');
        } catch (e) {
          readdir1Err = e;
        }
        
        if (!readdir1Err) {
          throw new Error('error expected');
          return;
        }
        
        readdir1Err.code.should.equal('ENOENT');
        
        // `/another-dir` should have the original dir's contents
        fse.readdirSync(TMP_PATH + '/another-dir')
          .should.eql(['file-111', 'file-112']);

        return new Bluebird((resolve, reject) => {
          setTimeout(function () {
            should(EMITTED).equal(true);
            resolve();
          }, 400);
        });
      });
  });

  it('should fail to move from a path that does not exist', function () {
    
    var hfs = createHFs(TMP_PATH);
    
    return hfs.move('/path-that-does-not-exist', '/another-path')
      .then(() => {
        throw new Error('error expected');
      })
      .catch((err) => {
        err.name.should.equal('PathDoesNotExist');
      });
  });
  
  it('should fail to move to a path that already exists', function () {
    
    var hfs = createHFs(TMP_PATH);
    
    return hfs.move('/file-1', '/dir-1')
      .then(() => {
        throw new Error('error expected');
      })
      .catch((err) => {
        err.name.should.equal('PathExists');
      })
  });
  
  it('should fail to move to a path to a path that is within itself', function () {
    
    var hfs = createHFs(TMP_PATH);
    
    return hfs.move('/dir-1', '/dir-1/dir-within')
      .then(() => {
        throw new Error('error expected');
      })
      .catch((err) => {
        err.name.should.equal('InvalidOption');
      })
  });
  
});