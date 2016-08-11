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

describe('HFs initialization', function () {

  beforeEach(function () {
    fse.emptyDirSync(TMP_PATH);
  });

  afterEach(function () {
    fse.emptyDirSync(TMP_PATH);
  });

  it('should require rootPath as the first argument', function () {
    assert.throws(function () {
      var hfs = createHFs(undefined);
    });
  });

  it('should allow passing the rootPath string as the first argument', function () {
    var hfs = createHFs(TMP_PATH);
  });

});