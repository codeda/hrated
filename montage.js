var exports = module.exports = {};
var fs = require('fs');
var xml2js = require('xml2js');
var tmp = require('tmp');
var cp = require('child_process');

var W=1280;
var H=720;

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

function convert(item, field, defaultValue) {
  if (item[field] != undefined && item[field] != null && 
      item[field][0] != undefined && item[field][0] != null && item[field][0] != '') {
    item[field] = item[field][0];
  } else {
    if (defaultValue != undefined && defaultValue != null) {
      item[field] = defaultValue;
    } else {
      throw "Can't get "+field+" and no default value present";
    }
  }
}

function processItem(item) {
  var type=0;
  item.pipe = getPipe();
  if (item.mediaType==='image') {
    type=0;
    item.ffmpeg = 'ffmpeg -i "'+item.newName+'" -s '+item.mediaWidth+'x'+item.mediaHeight+
      ' -vframes 1 -f rawvideo -pix_fmt argb -y '+item.pipe;
  } else {
    type=1;
    if (item.mediaType==='gif') {
      item.ffmpeg = 'ffmpeg -re -f lavfi -i "movie=filename='+item.newName+
        ':loop=0, setpts=N/(FRAME_RATE*TB)"';
    } else {
      item.ffmpeg = "ffmpeg -i "+item.newName;
    }
    item.ffmpeg+=' -ss '+parseInt(item.trimStart)/1000;
    // if there is trim, add it
    if (parseInt(item.trimEnd) !== -1) {
      item.ffmpeg += ' -vframes '+(parseInt(item.trimEnd)-parseInt(item.trimStart))*30/1000;
    };
    item.ffmpeg += ' -r 30 -s '+item.mediaWidth+'x'+item.mediaHeight;
    item.ffmpeg += ' -f rawvideo -an -pix_fmt argb -y '+item.pipe;
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
  return (type+" "+item.mediaWidth+" "+item.mediaHeight+" "+
    item.xPosition+" "+item.yPosition+" "+
    item.pipe+" "+parseInt(item.startPoint)*30/1000+" "+
    (parseInt(item.endPoint)-parseInt(item.startPoint))*30/1000+" ");
}

exports.processFile = function(filename, done) {
  try {
    cp.execSync("/bin/bash -c 'rm /tmp/output.mp4'");
  } catch(e) {
    console.log(e);
  }
  var parser = new xml2js.Parser();
  fs.readFile(filename, function(err, data) {
    parser.parseString(data, function (err, result) {
        var arr = result.root.item;
        arr.sort(function(a,b) {
          return parseInt(a.layer[0]) - parseInt(b.layer[0]);
        });
        var cmdline = "/home/ubuntu/hrated/video ";
        for (var item of arr) {
          convert(item, "layer");
          convert(item, "mediaType");
          convert(item, "mediaWidth", W);
          convert(item, "mediaHeight", H);
          convert(item, "url");
          convert(item, "trimStart", 0);
          convert(item, "trimEnd", -1);
          if (parseInt(item.trimEnd)===0) {
            item.trimEnd=-1;
          }
          convert(item, "startPoint", 0);
          // image's full duration is infinite, as image is static.
          // gif's too because gifs are looped
          if (item.mediaType!=="video") {
            convert(item, "endPoint");
          } else {
            convert(item, "endPoint", item.startPoint);
          }
          convert(item, "xPosition", 0);
          convert(item, "yPosition", 0);
          item.newName = makeNewName(item.url);
          var cmd = 'wget "'+item.url+'" --output-document="'+item.newName+'"';
          console.log("exec: "+cmd);
          cp.execSync(cmd);          
          console.log(item);
          if (item.mediaType==='image' || item.mediaType==='video' || item.mediaType==='gif') {
            var cmd = processItem(item);
            cmdline += cmd;
          }
        } 
        cmdline += "| ffmpeg -s "+W+"x"+H+" -r 30 -an -f rawvideo -pix_fmt argb -i - -y /tmp/output_tmp.mp4";
        setTimeout(function() {
          console.log('Done '+cmdline);
          cp.execSync(cmdline);
          console.log("done with "+filename);
          cp.execSync("/bin/bash -c 'mv /tmp/output_tmp.mp4 /tmp/output.mp4'");
          done();
        }, 1000);
    });
  });
}
