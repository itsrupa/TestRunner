/**
 * Module dependencies.
 */

var express = require('express');
var http = require('http');
var path = require('path');
var moment = require('moment');
var fs = require('fs');
var Step = require('step');
var path = require('path-extra');
var jenkinsapi = require('jenkins-api');

var username = process.env.JENKINS_USERNAME;
var password = process.env.JENKINS_PASSWORD;
if (username == '' || password == ''){
    console.log('Environmental variables JENKINS_USERNAME, JENKINS_PASSWORD do not exist');
    process.exit();
}

var connectionString = 'http://' + username + ':' + password + '@moonlight.gogrid.net';
var jenkins = jenkinsapi.init(connectionString);

function verifyJenkinsLastBuildInfo(moduleName) {
    console.log('In Jenkins Build Info function');
    jenkins.last_build_info('environment', function(err, data) {
        if (err){ 
            return console.log(err); 
        }
        console.log(data)
        if (data.building){
            console.log('building');
            setTimeout(verifyJenkinsLastBuildInfo,60000)
        }else if (data.result != 'SUCCESS') {
            console.log('not successful')
        }else {
            verifyPackageCacheLastBuildInfo();
            verifyModuleLastBuildInfo(moduleName);
        }
    }
    );
}

function verifyPackageCacheLastBuildInfo() {
    console.log('In Package Cache');
    jenkins.last_build_info('package_cache', function(err, data) {
        if (err){
            return console.log(err);
        }
        if (data.building){
            console.log ('building');
            setTimeout(verifyPackageCacheLastBuildInfo,60000)
        }else if (data.result != 'SUCCESS') {
            console.log('not successful');
        }
    }
    );
}

function verifyModuleLastBuildInfo(moduleName) {
    console.log('In ' + moduleName);
    jenkins.last_build_info(moduleName, function(err, data) {
        if (err){
            return console.log(err);
        }
        if (data.building){
            console.log ('building');
            setTimeout(verifyModuleLastBuildInfo,60000)
        }else if (data.result != 'SUCCESS') {
            console.log('not successful');
        }
    }
    );
}

require('shelljs/global');

var app = express();

var server = require('http').createServer(app)
var io = require('socket.io').listen(server,{log: false});



app.configure(function() {
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.json()); // to support JSON-encoded bodies
  app.use(express.urlencoded()); // to support URL-encoded bodies
  app.use(express.static(path.join(__dirname, 'public')));
});

app.post('/startTest', function(req, res) {
  res.send("");
  startTest(req.body.releaseName, req.body.moduleName);
});

app.get('/allResults', function(req, res) {
  var allResultsFolder = __dirname + '/public/results';
  fs.readdir(allResultsFolder, function(err, files) {
    if (err) {
      console.log(err);
      res.json({
        error: 'could not read results folder'
      });
    }
    console.log(files);
    res.json(files);
  });
});

var socket;
console.log('making connection')
io.sockets.on('connection', function(soc) {
  console.log('got connection ...')
  socket = soc;

});

//global result file
var resultFile;


function createResultsFile(releaseName, moduleName) {
  releaseName = releaseName.replace("/", "_");
  resultFile = __dirname + '/public/results/' + releaseName + "__" + moduleName + "__" + moment().format("MM-DD-YYYY-hhmmssA") + ".html";
  console.log("ResultFile Name:" + resultFile);
}

function logAndStreamData(data) {
  //send it back to browser immediately
  socket.emit('TestRunnerChannel', data);

  //write to result file as html <p> with different colors
  var className = "text-success";
  if (data.indexOf("Error") >= 0) {
    className = "text-danger";
  }
  if (data.indexOf('Running Test For:') == 0) {
    className = 'bg-primary customPadding';
  }
  echo('<p class="' + className + '">' + data + '</p>').toEnd(resultFile);
}

var moduleName = 'customer-portal';
var releaseName = 'release/20140326'
function cdToFolderAsync(folder, callback) {
    cd(folder);
    callback(null, output)
}

function runCommand1() {
    console.log('Doing ... cd ~/stage');
    console.log('Doing ... cd ~/stage');
    cdToFolderAsync(path.homedir() + '/stage', this);
}

function runCommand2(code, output) {
    console.log("Command 1 complete");
    console.log("Command 1 complete");
    console.log('\nDoing ... git env fetch');
    console.log('\nDoing ... git env fetch');
    exec('git env fetch', this);
}

function runCommand3(code, output) {
    console.log("Output from command2 " + output);
    console.log("Output from command2 " + output);
    console.log("\nCommand 2 complete");
    console.log("\nCommand 2 complete")
    console.log('\nDoing ... git env reset --hard origin/stage');
    console.log('\nDoing ... git env reset --hard origin/stage');
    exec('git env reset --hard origin/stage', this);
}

function runCommand4(code, output) {
    console.log("Output from command3 " + output);
    console.log("Output from command3 " + output);
    console.log("\nCommand 3 complete");
    console.log("\nCommand 3 complete");
    console.log('Doing ... git env merge');
    console.log('Doing ... git env merge');
    exec('git env merge', this);
}

function runCommand5(code, output) {
    console.log("Output from command4 " + output);
    console.log("Output from command4 " + output);
    console.log("\nCommand 4 complete");
    console.log("\nCommand 4 complete");
    console.log('Doing ... git env update');
    console.log('Doing ... git env update');
    exec('git env update', this);
}

function runCommand6(code, output) {
    console.log("Output from command5 " + output);
    console.log("Output from command5 " + output);
    console.log("\nCommand 5 complete");
    console.log("\nCommand 5 complete");
    console.log('Doing ... git env follow '+ moduleName + ' ' + releaseName );
    console.log('Doing ... git env follow '+ moduleName + ' ' + releaseName );
    exec('git env follow ' + moduleName + ' ' + releaseName, this);
}

function runCommand7(code, output) {
    console.log("Output from command6 " + output);
    console.log("Output from command6 " + output);
    console.log("\nCommand 6 complete");
    console.log("\nCommand 6 complete");
    console.log('Doing ... git add ' + moduleName);
    console.log('Doing ... git add ' + moduleName);
    exec('git add ' + moduleName, this);
}

function runCommand8(code, output) {
    console.log("Output from command7 " + output);
    console.log("Output from command7 " + output);
    console.log("\nCommand 7 complete");
    console.log("\nCommand 7 complete");
    console.log('Doing ... git commit -m "Autocommit from TestRunner"');
    console.log('Doing ... git commit -m "Autocommit from TestRunner"');
    exec('git commit -m "AutoCommit from TestRunner"', this);
}

function runCommand9(code, output) {
    console.log("Output from command8 " + output);
    console.log("Output from command8 " + output);
    console.log("\nCommand 8 complete");
    console.log("\nCommand 8 complete");
    console.log('Doing ... git push');
    console.log('Doing ... git push');
    exec('git push', this);
}

function runFinalStep(code, output) {
    console.log("Git Push Command now complete");
    logAndStreamData("Git Push Command now complete");
    verifyJenkinsLastBuildInfo();
    console.log("This is Final Step");
    logAndStreamData("This is Final Step");
}

function startTest(releaseName, moduleName) {
  Step(runCommand1,
      runCommand2,
      runCommand3,
      runCommand4,
      runCommand5,
      runCommand6,
      runCommand7,
      runCommand8,
      runCommand9,
      runFinalStep
  );
  
  createResultsFile("release/2012323", "customer-portal");

  logAndStreamData("Running Test For: Release Name: " + releaseName + " Module Name: " + moduleName);
  var data = which('git');
  if (!data) {
    logAndStreamData('Sorry, this script requires git');
  }

  logAndStreamData('Doing... git commit -am "Auto-commit" ');
  var result = exec('git commit -am "Auto-commit"');
  if (result.code !== 0) {
    echo('Error: Git commit failed');
    console.dir(result.output);
    logAndStreamData('Error... ' + result.output);
    // exit(1);
  }

  setTimeout(function() {

    logAndStreamData("After 5 seconds");
  }, 5000);

  var result2 = exec('git commit -am "Auto-commit"');
  if (result2.code !== 0) {
    logAndStreamData('Error2: Git commit failed');
    logAndStreamData(result2.output);
    // exit(1);
  }
}

app.configure('development', function() {
  app.use(express.errorHandler());
});


server.listen(3000);
