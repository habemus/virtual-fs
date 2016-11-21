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

describe('HFs create methods', function () {

  beforeEach(function () {
    fse.emptyDirSync(TMP_PATH);
  });

  afterEach(function () {
    fse.emptyDirSync(TMP_PATH);
  });
  
  describe('#createFile', function () {
    
    it('should require non-empty `filepath` as first argument', function () {

      var hfs = createHFs(TMP_PATH);

      return hfs.createFile('')
        .then(() => {
          done(new Error('expected error'));
        })
        .catch((err) => {
          err.name.should.equal('InvalidOption');
        });
    });
    
    it('should create an empty file when passed no `contents` argument', function () {

      var hfs = createHFs(TMP_PATH);

      return hfs.createFile('somefile.md')
        .then(() => {
          
          fse.readFileSync(TMP_PATH + '/somefile.md', 'utf8')
            .should.equal('');
        });
    });

    it('should emit a `hfs:file-created` event upon successful file creation', function () {
      
      var hfs = createHFs(TMP_PATH);

      var EMITTED = false;
      hfs.on('file-created', function (data) {
        EMITTED = true;
        
        data.path.should.equal('/somefile.md');
      });

      return hfs.createFile('somefile.md')
        .then(() => {
          fse.readFileSync(TMP_PATH + '/somefile.md', 'utf8')
            .should.equal('');
          
          // wait some time to ensure event has been emitted
          return new Bluebird((resolve, reject) => {
            setTimeout(function () {
              should(EMITTED).equal(true);  
            
              resolve();
            }, 400);
          })
        });
    });
    
    it('should create a file with the given contents', function () {
      
      var hfs = createHFs(TMP_PATH);

      return hfs.createFile('somefile.md', 'some contents')
        .then(() => {
          
          fse.readFileSync(TMP_PATH + '/somefile.md', 'utf8')
            .should.equal('some contents');
        });
    });
    
    it('should fail to create a file if another file exists in the same path', function () {
      
      var hfs = createHFs(TMP_PATH);

      // create a file on the directory
      fse.ensureFileSync(TMP_PATH + '/somefile.md');

      return hfs.createFile('somefile.md')
        .then(() => {
          throw new Error('expected error');
        }, (err) => {
          err.name.should.equal('PathExists');
          err.path.should.equal('/somefile.md');
        });
    });

    it('should fail to create a file if another directory exists in the same path', function () {

      var hfs = createHFs(TMP_PATH);

      // create a file on the directory
      fse.ensureDirSync(TMP_PATH + '/some-existing-dir');

      return hfs.createFile('some-existing-dir')
        .then(() => {
          throw new Error('expected error');
        })
        .catch((err) => {
          err.name.should.equal('PathExists');
          err.path.should.equal('/some-existing-dir');
        });
    });
  });
  
  describe('#createDirectory', function () {
    
    it('should require non-empty `dirpath` as first argument', function () {

      var hfs = createHFs(TMP_PATH);

      return hfs.createDirectory('')
        .then(() => {
          throw new Error('expected error');
        })
        .catch((err) => {
          err.name.should.equal('InvalidOption');
          err.kind.should.equal('required');
          err.option.should.equal('dirpath');
        });
    });
    
    it('should create a directory at the given path', function () {
      
      var hfs = createHFs(TMP_PATH);

      return hfs.createDirectory('somedir')
        .then(() => {
          fse.statSync(TMP_PATH + '/somedir')
            .isDirectory()
            .should.equal(true);
        });
    });
    
    it('should emit a `hfs:directory-created` event upon successful dir creation', function () {
      
      var hfs = createHFs(TMP_PATH);

      var EMITTED = false;
      hfs.on('directory-created', function (data) {
        data.path.should.equal('/somedir');
        EMITTED = true;
      });

      return hfs.createDirectory('somedir')
        .then(() => {
          
          fse.statSync(TMP_PATH + '/somedir')
            .isDirectory()
            .should.equal(true);
          
          // give time for the event message to arrive
          return new Bluebird((resolve, reject) => {
            setTimeout(function () {
              should(EMITTED).equal(true);
              resolve();
            }, 400);
          });
        });
    });
    
    it('should fail to create a new directory if the path has another file', function () {

      var hfs = createHFs(TMP_PATH);

      // TODO: investigate weird behavior
      // when trying to create a directory or file that exists
      // that emits a delayed file-add and file-remove events
      // to the fs watcher.

      // ensure some file athe the target path
      fse.ensureFileSync(TMP_PATH + '/some-existing-file');

      return hfs.createDirectory('some-existing-file')
        .then(() => {
          throw new Error('expected error');
        })
        .catch((err) => {
          err.name.should.equal('PathExists');
          err.path.should.equal('/some-existing-file');
        });
    });

    it('should do nothing in case the path has another directory', function () {

      var hfs = createHFs(TMP_PATH);

      // ensure some file athe the target path
      fse.ensureDirSync(TMP_PATH + '/some-existing-dir');

      return hfs.createDirectory('some-existing-dir')
        .then(() => {
          fse.statSync(TMP_PATH + '/some-existing-dir')
            .isDirectory()
            .should.equal(true);
        });
    });

    it('should create all intermediary directories - like mkdirp', function () {
      
      var hfs = createHFs(TMP_PATH);

      // ensure some file athe the target path
      fse.ensureDirSync(TMP_PATH + '/some-existing-dir');

      return hfs.createDirectory('some-existing-dir/some/deeper/dir')
        .then(() => {
          fse.statSync(TMP_PATH + '/some-existing-dir/some/deeper/dir')
            .isDirectory()
            .should.equal(true);
        });
    });
  });
});