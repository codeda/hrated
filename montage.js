var exports = module.exports = {};

exports.processFile = function(filename, done) {
  setTimeout(function() {
    console.log("done with "+filename);
    done();
  }, 10000);
}

