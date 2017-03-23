var fs = require('fs');
var cp = require('child_process');
var queue = require('block-queue');
var montage = require('./montage.js');

function processFile(filename, done) {
  console.log("process "+filename);
  montage.processFile(filename, done);
} 

////////////////////////////////////////////////////////////////////////
//
// test code to check directory for xml file changes, and process them
// while a file is being processed, new ones are ignored
//
////////////////////////////////////////////////////////////////////////

var w = undefined;
var prefix = "/tmp";
var ext = ".xml";

var q = queue(1, function(task, done) {
    try {
      processFile(prefix + "/" + task, done);
    } catch(error) {
      done();
      console.log("error in processing: "+error);
    }
});

function handleFileChange(eventType, filename) {
  if (filename && filename.indexOf(ext)>-1 && eventType == 'change') {
      console.log('eventType: '+eventType+", filename: "+filename);
      q.push(filename);
  };
}

w = fs.watch(prefix, {encoding: 'buffer'}, handleFileChange);
