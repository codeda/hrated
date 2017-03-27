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
          return parseInt(a.layer) - parseInt(b.layer);
        });
        var cmdline = "/home/ubuntu/hrated/video ";
        for (var item of arr) {
          item.newName = makeNewName(item.url[0]);
          var cmd = 'wget "'+item.url[0]+'" --output-document="'+item.newName+'"';
          console.log("exec: "+cmd);
          cp.execSync(cmd);          
          console.log(item);
          if (item.mediaType[0]==='image' || item.mediaType[0]==='video' || item.mediaType[0]==='gif') {
            var type=0;
            item.pipe = getPipe();
            if (item.mediaType[0]==='image') {
              type=0;
              item.ffmpeg = 'ffmpeg -i "'+item.newName+'" -s '+item.mediaWidth[0]+'x'+item.mediaHeight[0]+
                ' -vframes 1 -f rawvideo -pix_fmt argb -y '+item.pipe;            
            } else {
              type=1;
              item.ffmpeg = 'ffmpeg -re -f lavfi -i "movie=filename='+item.newName+
                ':loop=0, setpts=N/(FRAME_RATE*TB)" -vframes '+(parseInt(item.endPoint[0])-parseInt(item.startPoint[0]))*30/1000+
                ' -r 30 -s '+item.mediaWidth[0]+'x'+item.mediaHeight[0]+
                ' -f rawvideo -an -pix_fmt argb -y '+item.pipe;
            }
            console.log(item.ffmpeg);
            cp.exec(item.ffmpeg, (error,stdout,stderr) => {
              if (error) {
                console.error('exec error: '+error);
                return;
              }
              console.log("stdout: "+stdout);
              console.log("stderr: "+stderr);
            });
            cmdline += (type+" "+item.mediaWidth[0]+" "+item.mediaHeight[0]+" "+item.xPosition[0]+" "+item.yPosition[0]+" "+item.pipe+" "+parseInt(item.startPoint[0])*30/1000+" "+(parseInt(item.endPoint[0])-parseInt(item.startPoint[0]))*30/1000+" ");
          }
        } 
        cmdline += "| ffmpeg -s 1280x720 -r 30 -an -f rawvideo -pix_fmt argb -i - -y /tmp/output.mp4";
        setTimeout(function() {
          console.log('Done '+cmdline);
          cp.execSync(cmdline);
          console.log("done with "+filename);
          done();
        }, 1000);
    });
  });
}
