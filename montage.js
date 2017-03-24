var exports = module.exports = {};
var fs = require('fs');
var xml2js = require('xml2js');
var tmp = require('tmp');
var cp = require('child_process');

function makeNewName(url) {
  console.log(url);
  var s = url.substring(url.lastIndexOf('/')+1);
  var o = tmp.fileSync();
  o.removeCallback();
  return o.name+s;
}

function getPipe() {
  var o = tmp.fileSync();
  var f = o.name;
  o.removeCallback();
  cp.execSync('mkfifo '+f);
  return f;
}

exports.processFile = function(filename, done) {
  var parser = new xml2js.Parser();
  fs.readFile(filename, function(err, data) {
    parser.parseString(data, function (err, result) {
        var arr = result.root.item;
        arr.sort(function(a,b) {
          if (parseInt(a.layer) - parseInt(b.layer) === 0) {
	    return parseInt(a.order) - parseInt(b.order);
          } else {
            return parseInt(a.layer) - parseInt(b.layer);
          }
        });
        var cmdline = "./video ";
        for (var item of arr) {
          item.newName = makeNewName(item.url[0]);
          var cmd = 'wget "'+item.url[0]+'" --output-document="'+item.newName+'"';
          console.log("exec: "+cmd);
          cp.execSync(cmd);          
          console.log(item);
          if (item.mediaType[0]==='image') {
            item.pipe = getPipe();
            item.ffmpeg = 'ffmpeg -i "'+item.newName+'" -s '+item.mediaWidth[0]+'x'+item.mediaHeight[0]+' -vframes 1 -f rawvideo -pix_fmt argb '+item.pipe;
            console.log(item.ffmpeg);
            cmdline += ("0 "+item.mediaWidth[0]+" "+item.mediaHeight[0]+" "+item.xPosition[0]+" "+item.yPosition[0]+" "+item.newName+" "+parseInt(item.startPoint[0])*30/1000+" "+(parseInt(item.endPoint[0])-parseInt(item.startPoint[0]))*30/1000+" ");
          }
        } 
        cmdline += "| ffmpeg -s 1280x720 -r 30 -an -f rawvideo -pix_fmt argb -i - /tmp/output.mp4";
        console.log('Done '+cmdline);
    });
  });
  console.log("done with "+filename);
  done();
}
