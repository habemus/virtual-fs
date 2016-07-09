// native dependencies
const path   = require('path');
const assert = require('assert');
const http   = require('http');

// third-party dependencies
const should = require('should');
const fse    = require('fs-extra');
const Bluebird = require('bluebird');

// the lib
const createHFs = require('../../../');

const TMP_PATH = path.join(__dirname, '../../tmp');

function wait(ms) {
  return new Bluebird((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

const ALL_EVENTS = [
  'directory-created',
  'directory-removed',
  'file-created',
  'file-removed',
  'file-updated',
];

/**
 * Generates an array with all events but the given one.
 * @param  {Array|String} evList
 * @return {Array}
 */
function allEventsBut(evList) {

  evList = Array.isArray(evList) ? evList : [evList];

  return ALL_EVENTS.filter((e) => {
    return evList.indexOf(e) === -1;
  });
}

describe('HFs watcher event propagation', function () {

  beforeEach(function () {
    fse.emptyDirSync(TMP_PATH);

    // wait 500 ms before starting test so
    // that operations of the beforeEach hook do not
    // interfere with tests
    return wait(500);
  });

  afterEach(function () {
    fse.emptyDirSync(TMP_PATH);
  });

  describe('`file-created` event', function () {

    it('should emit `file-created` events whenever an outer agent creates the file', function (done) {
      var hfs = createHFs(TMP_PATH);

      // wait for the watcher to be ready
      // before running tests
      hfs.startWatcher()
        .then(() => {
          hfs.on('file-created', (data) => {
            // path should be relative to the hfs root
            data.path.should.equal('/somefile.md');
            Object.keys(data).length.should.equal(1);

            wait(1000).then(() => {
              hfs.destroyWatcher();
              done();
            });
          });

          allEventsBut('file-created').forEach((ev) => {
            hfs.on(ev, (data) => {
              done(new Error(ev + ' should not have been emitted'));
            });
          });

          // create a file within the root path of the hfs
          // using an external module
          fse.writeFileSync(TMP_PATH + '/somefile.md', 'Some content');
        });
    });

    it('should emit `file-created` only once when creating file using hfs.createFile api', function (done) {
      var hfs = createHFs(TMP_PATH);

      var fileCreatedEventCount = 0;

      // wait for the watcher to be ready
      // before running tests
      hfs.startWatcher()
        .then(() => {
          hfs.on('file-created', (data) => {
            // path should be relative to the hfs root
            data.path.should.equal('/somefile.md');
            Object.keys(data).length.should.equal(1);

            fileCreatedEventCount += 1;
          });

          allEventsBut('file-created').forEach((ev) => {
            hfs.on(ev, (data) => {
              done(new Error(ev + ' should not have been emitted'));
            });
          });

          // create a file within the root path of the hfs
          // using an external module
          hfs.createFile('/somefile.md', 'Some content')
            .then(() => {
              return wait(1000);
            })
            .then(() => {
              fileCreatedEventCount.should.equal(1);
              
              hfs.destroyWatcher();
              done();
            });
        });
    });
  });

  describe('`directory-created` event', function () {

    it('should emit `directory-created` events whenever an outer agent creates a directory', function (done) {
      var hfs = createHFs(TMP_PATH);

      hfs.startWatcher()
        .then(() => {
          hfs.on('directory-created', (data) => {
            // path should be relative to the hfs root
            data.path.should.equal('/somedir');
            Object.keys(data).length.should.equal(1);

            wait(1000).then(() => {
              hfs.destroyWatcher();
              done();
            });
          });

          allEventsBut('directory-created').forEach((ev) => {
            hfs.on(ev, (data) => {
              done(new Error(ev + ' should not have been emitted'));
            });
          });

          // create a directory within the root path of the hfs
          fse.mkdirSync(TMP_PATH + '/somedir');
        });
    });
  });

  describe('`file-removed` event', function () {

    it('should emit `file-removed` events whenever an outer agent removes a file', function (done) {
      var hfs = createHFs(TMP_PATH);

      // create a file to be removed later
      fse.writeFileSync(TMP_PATH + '/file.md', 'contents');

      hfs.startWatcher()
        .then(() => {
          hfs.on('file-removed', (data) => {
            // path should be relative to the hfs root
            data.path.should.equal('/file.md');
            Object.keys(data).length.should.equal(1);

            wait(1000).then(() => {
              hfs.destroyWatcher();
              done();
            });
          });

          allEventsBut('file-removed').forEach((ev) => {
            hfs.on(ev, (data) => {
              done(new Error(ev + ' should not have been emitted'));
            });
          });

          // create a directory within the root path of the hfs
          fse.unlinkSync(TMP_PATH + '/file.md');
        });
    });
  });

  describe('`directory-removed` event', function () {

    it('should emit `directory-removed` events whenever an outer agent removes a directory', function (done) {
      var hfs = createHFs(TMP_PATH);

      // create a directory to be removed later
      fse.mkdirSync(TMP_PATH + '/somedir');

      hfs.startWatcher()
        .then(() => {
          hfs.on('directory-removed', (data) => {
            // path should be relative to the hfs root
            data.path.should.equal('/somedir');
            Object.keys(data).length.should.equal(1);

            wait(1000).then(() => {
              hfs.destroyWatcher();
              done();
            });
          });

          allEventsBut('directory-removed').forEach((ev) => {
            hfs.on(ev, (data) => {
              done(new Error(ev + ' should not have been emitted'));
            });
          });

          // create a directory within the root path of the hfs
          fse.rmdirSync(TMP_PATH + '/somedir');
        });
    });

    it('should emit multiple removal events `directory-removed` event whenever an outer agent removes a directory with contents within', function (done) {
      var hfs = createHFs(TMP_PATH);

      // create a directory to be removed later
      fse.mkdirSync(TMP_PATH + '/somedir');
      fse.mkdirSync(TMP_PATH + '/somedir/some-deeper-dir');
      fse.mkdirSync(TMP_PATH + '/somedir/another-deeper-dir');
      fse.writeFileSync(TMP_PATH + '/somedir/some-deep-file.md', 'contents')
      fse.writeFileSync(TMP_PATH + '/somedir/some-deeper-dir/some-other-file.md', 'contents 2');

      var removedDirEventCount = 0;
      var removedDirPaths = [
        '/somedir',
        '/somedir/some-deeper-dir',
        '/somedir/another-deeper-dir',
      ];

      var removedFileEventCount = 0;
      var removedFilePaths = [
        '/somedir/some-deep-file.md',
        '/somedir/some-deeper-dir/some-other-file.md',
      ];

      hfs.startWatcher()
        .then(() => {
          hfs.on('directory-removed', (data) => {
            removedDirPaths.indexOf(data.path).should.not.equal(-1);
            removedDirEventCount += 1;
          });

          hfs.on('file-removed', (data) => {
            removedFilePaths.indexOf(data.path).should.not.equal(-1);
            removedFileEventCount += 1;
          });

          allEventsBut(['directory-removed', 'file-removed']).forEach((ev) => {
            hfs.on(ev, (data) => {
              done(new Error(ev + ' should not have been emitted'));
            });
          });

          // create a directory within the root path of the hfs
          fse.removeSync(TMP_PATH + '/somedir');

          wait(1000).then(() => {
            removedDirEventCount.should.equal(removedDirPaths.length);
            removedFileEventCount.should.equal(removedFilePaths.length);

            hfs.destroyWatcher();
            done();
          });
        });
    });
  });

  describe('`file-updated` event', function () {

    it('should emit `file-updated` events whenever an outer agent removes a directory', function (done) {
      var hfs = createHFs(TMP_PATH);

      // create a file that will be written to later
      fse.writeFileSync(TMP_PATH + '/somefile.md', 'initial contents');

      hfs.startWatcher()
        .then(() => {
          hfs.on('file-updated', (data) => {
            // path should be relative to the hfs root
            data.path.should.equal('/somefile.md');
            Object.keys(data).length.should.equal(1);

            wait(1000).then(() => {
              hfs.destroyWatcher();
              done();
            });
          });

          allEventsBut('file-updated').forEach((ev) => {
            hfs.on(ev, (data) => {
              done(new Error(ev + ' should not have been emitted'));
            });
          });

          // create a directory within the root path of the hfs
          fse.writeFileSync(TMP_PATH + '/somefile.md', 'new contents');
        });
    });
  });

});