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
  
  it('should remove a file\'s contents', function () {
    var hfs = createHFs(TMP_PATH);
    return hfs.remove('/dir-1/file-11')
      .then(() => {
        // the file should not exist anymore
        try {
          fse.readFileSync(TMP_PATH + '/dir-1/file-11');
          throw new Error('error expected');
        } catch (e) {
          e.code.should.equal('ENOENT');
        }
      });
  });
  
  it('should emit a `file-removed` upon successful removal of a file\'s contents', function () {
    var hfs = createHFs(TMP_PATH);
    
    var EMITTED;
    
    hfs.on('file-removed', function (data) {
      EMITTED = true;
      
      data.path.should.equal('/dir-1/file-11');
    });

    return hfs.remove('/dir-1/file-11')
      .then(() => {
        
        // the file should not exist anymore
        try {
          fse.readFileSync(TMP_PATH + '/dir-1/file-11');
          throw new Error('error expected');
        } catch (e) {
          e.code.should.equal('ENOENT');

          return new Bluebird((resolve, reject) => {
            // wait sometime to ensure event is received
            setTimeout(function () {
              
              should(EMITTED).equal(true);
              resolve();
            }, 400);
          });
        }
      });
  });
  
  it('should remove a directory\'s contents', function () {
    var hfs = createHFs(TMP_PATH);
    return hfs.remove('/dir-1')
      .then(() => {
        
        // the directory should not exist anymore
        try {
          fse.readdirSync(TMP_PATH + '/dir-1');
          throw new Error('error expected');
        } catch (e) {
          e.code.should.equal('ENOENT');
        }
      });
  });
  
  it('should emit a `directory-removed` upon successful removal of a file\'s contents', function () {
    var hfs = createHFs(TMP_PATH);
    
    var EMITTED;
    
    hfs.on('directory-removed', function (data) {
      EMITTED = true;
      
      data.path.should.equal('/dir-1');
    });

    return hfs.remove('/dir-1')
      .then(() => {
        
        // the directory should not exist anymore
        try {
          fse.readdirSync(TMP_PATH + '/dir-1');
          throw new Error('error expected');
        } catch (e) {
          e.code.should.equal('ENOENT');

          return new Bluebird((resolve, reject) => {
            // wait sometime to ensure event is received
            setTimeout(function () {
              
              should(EMITTED).equal(true);
              resolve();
            }, 400);
          });
        }
      });
  });
  
  it('should fail to remove a path that does not exist', function () {
    var hfs = createHFs(TMP_PATH);
    return hfs.remove('/path-that-does-not-exist')
      .then(() => {
        throw new Error('error expected');
      })
      .catch((err) => {
        err.name.should.equal('PathDoesNotExist');
      });
  });
  
  describe('illegal path operations', function () {
    
    it('should fail to remove paths that are not within the project\'s root', function () {
      var hfs = createHFs(TMP_PATH);
      
      return hfs.remove('../another-project/file')
        .then(() => {
          throw new Error('error expected');
        })
        .catch((err) => {
          err.name.should.equal('IllegalPath');
        });
    });
    
    it('should fail to remove paths that are not within the project\'s root - 2', function () {
      var hfs = createHFs(TMP_PATH);
      
      return hfs.remove('../another-project/')
        .then(() => {
          throw new Error('error expected');
        })
        .catch((err) => {
          err.name.should.equal('IllegalPath');
        });
    });
    
    it('should fail to remove paths that are not within the project\'s root - 3', function () {
      var hfs = createHFs(TMP_PATH);
      
      return hfs.remove('../')
        .then(() => {
          throw new Error('error expected');
        })
        .catch((err) => {
          err.name.should.equal('IllegalPath');
        });
    });
    
    it('should fail to remove paths that are not within the project\'s root - 4', function () {
      var hfs = createHFs(TMP_PATH);
      
      return hfs.remove('..')
        .then(() => {
          throw new Error('error expected');
        })
        .catch((err) => {
          err.name.should.equal('IllegalPath');
        })
    });
    
    it('should fail to remove paths that are not within the project\'s root - 5', function () {
      var hfs = createHFs(TMP_PATH);
      
      return hfs.remove('.')
        .then(() => {
          throw new Error('error expected');
        })
        .catch((err) => {
          err.name.should.equal('IllegalPath');
        })
    });
  });
  
});