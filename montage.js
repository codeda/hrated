var exports = module.exports = {};
var fs = require('fs');
var xml2js = require('xml2js');

exports.processFile = function(filename, done) {
  var parser = new xml2js.Parser();
  fs.readFile(filename, function(err, data) {
    parser.parseString(data, function (err, result) {
        console.dir(result);
        console.log('Done');
    });
  });
  console.log("done with "+filename);
  done();
}

