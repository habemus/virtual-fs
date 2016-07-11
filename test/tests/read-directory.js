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

describe('HFS#readDirectory(dirpath)', function () {

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

  it('should read the root directory contents', function () {
      var hfs = createHFs(TMP_PATH);
    
    var rootContentPaths = fse.readdirSync(TMP_PATH)
      .map(function (name) {
        // responses come with path with starting fw-slash
        return '/' + name;
      });
    
    return hfs.readDirectory('')
      .then((dirContents) => {
        dirContents.length.should.equal(4);
        
        dirContents.forEach(function (contentData) {
          (typeof contentData).should.equal('object');
          
          contentData.path.should.be.instanceof(String);
          rootContentPaths.indexOf(contentData.path).should.not.equal(-1);
          contentData.basename.should.equal(path.basename(contentData.path));

          contentData.isFile.should.be.instanceof(Boolean);
          contentData.isDirectory.should.be.instanceof(Boolean);
        });
      });
  });
  
  it('should read the contents of a deeper directory', function () {
    var hfs = createHFs(TMP_PATH);
    
    var dir1ContentPaths = fse.readdirSync(TMP_PATH + '/dir-1')
      .map(function (name) {
        // responses come with path with starting fw-slash
        // and start at the root
        return '/dir-1/' + name;
      });
    
    return hfs.readDirectory('/dir-1')
      .then((dirContents) => {
        dirContents.length.should.equal(3);
        
        dirContents.forEach(function (contentData) {
          (typeof contentData).should.equal('object');
          
          contentData.path.should.be.instanceof(String);
          dir1ContentPaths.indexOf(contentData.path).should.not.equal(-1);
          contentData.basename.should.equal(path.basename(contentData.path));

          contentData.isFile.should.be.instanceof(Boolean);
          contentData.isDirectory.should.be.instanceof(Boolean);
        });
      });
  });

  it('should require dirpath', function () {
    var hfs = createHFs(TMP_PATH);

    return hfs.readDirectory()
      .then(() => {
        return Bluebird.reject(new Error('error expected'));
      }, (err) => {
        err.name.should.equal('InvalidOption');
        err.option.should.equal('dirpath');
        err.kind.should.equal('required');
      });
  });
  
  it('should fail to read the contents of a directory that does not exist', function () {    
    var hfs = createHFs(TMP_PATH);
    
    return hfs.readDirectory('/path/that/does/not/exist')
      .then(() => {
        throw new Error('error expected');
      })
      .catch((err) => {
        err.name.should.equal('PathDoesNotExist');
      });
  });
  
  it('should fail to read the contents of a path that contains a file', function () {    
    var hfs = createHFs(TMP_PATH);
    
    return hfs.readDirectory('/dir-1/file-11')
      .then(() => {
        throw new Error('error expected');
      })
      .catch((err) => {
        err.name.should.equal('PathIsNotDirectory');
      });
  });
  
  it('should never interpret `..` in paths', function () {    
    var hfs = createHFs(TMP_PATH);
    
    return hfs.readDirectory('../another-project/dir')
      .then(() => {
        throw new Error('error expected');
      })
      .catch((err) => {
        err.name.should.equal('IllegalPath');
        // TODO: study whether this error should be revealed
      });
  });
  
});