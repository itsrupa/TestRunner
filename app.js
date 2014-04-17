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
//var jenkinsapi = require('jenkins-api');

var username = process.env.JENKINS_USERNAME;
var password = process.env.JENKINS_PASSWORD;
if (!username  || !password ){
    console.log('Environmental variables JENKINS_USERNAME, JENKINS_PASSWORD do not exist');
    process.exit();
}

var connectionString = 'http://' + username + ':' + password + '@moonlight.gogrid.net';
//var jenkins = jenkinsapi.init(connectionString);
var jenkins = require('jenkins')(connectionString)

var rerunCountTracker = {};

function doJenkinsStep(jobName, callback) {

  //internal function
  function rerunJenkinsStep() {
    console.log('Rerunning Jenkins Step for jobName: ' + jobName);
    doJenkinsStep(jobName, callback);
  }
  //internal function
  //Returns true if the job hasn't rerun >3 times.
  function shouldReRunStep() {
    if (rerunCountTracker[jobName]) {
      rerunCountTracker[jobName] = rerunCountTracker[jobName] + 1;
    } else {
      rerunCountTracker[jobName] = 1;
    }

    if (rerunCountTracker[jobName] > 15) {
      rerunCountTracker[jobName] = 0;
      return false;
    } else {
      return true;
    }
  }


  jenkins.job.get(jobName, function(err, jobInfo) {
    if (err) {
      callback({
        "error": "Error doing jenkins.job.get for jobName: " + jobName + " Error: " + err
      });
    }

	logAndStreamData("jobName: " + jobName + ' jobInfo.lastBuild.number: ' + jobInfo.lastBuild.number);

    jenkins.build.get(jobName, jobInfo.lastBuild.number, function(err, buildInfo) {
      if (err) {
        callback({
          "error": "Error doing jenkins.build.get: " + jobName + " Error: " + err
        });
      }

	  logAndStreamData('Jenkins.Build.Get: ' + jobName + ' buildInfo.building = ' + buildInfo.building);

      if (buildInfo.building) { //if it is still building, rerun
        if (shouldReRunStep()) {
          logAndStreamData("Rerun Count: " + rerunCountTracker[jobName] + " for jobName: " + jobName);
          setTimeout(rerunJenkinsStep, 60000);
        } else {
		  logAndStreamData("Step failed. Already rerun more than 3 times");
          callback({
            "error": "Step failed. Already rerun more than 3 times"
          });
        }
      } else if (buildInfo.result != 'SUCCESS') {
		logAndStreamData("buildInfo.result != SUCCESS for jobName" + jobName);
        callback({
          "error": "buildInfo.result != SUCCESS for jobName" + jobName
        });
      } else {
        callback();
      }
    });
  });
}

/*function verifyJenkinsLastBuildInfo() {
    console.log('In Jenkins Build Info function');
    jenkins.job.get('environment', function(err, list) {
        if (err){ 
            return console.log(err); 
        }
        console.log(list);
        console.log(list.lastBuild.number)
        jenkins.build.get('environment',list.lastBuild.number, function(err, list) {
            if (err) {
                return console.log(err);
            }
            console.log('list');
            if (list.building) {
                console.log('building');
            setTimeout(verifyJenkinsLastBuildInfo,60000)
            } else if (list.result != 'SUCCESS') {
                console.log('not successful');
            } else {
                verifyPackageCacheLastBuildInfo();
            }
        }
        );
    }
    );
}

function verifyPackageCacheLastBuildInfo() {
    console.log('In Package Cache');
    jenkins.job.get('package_cache', function(err, list) {
        if (err){
            return console.log(err);
        }
        console.log(list);
        console.log(list.lastBuild.number);
        jenkins.build.get('package_cache',list.lastBuild.number, function(err, list) {
            if (err) {
                return console.log(err);
            }
            console.log('Got the list');
            if (list.building){
                console.log ('building');
                setTimeout(verifyPackageCacheLastBuildInfo,60000);
            } else if (list.result != 'SUCCESS') {
                console.log('not successful');
            } else {
                verifyModuleLastBuildInfo();
            }
        }
        );
    }
    );
}

function verifyModuleLastBuildInfo() {
    console.log('In verifyModuleLastBuildInfo');
    console.log(moduleName);
    jenkins.job.get(moduleName, function(err, list) {
        if (err){
            return console.log(err);
        }
        console.log(list);
        console.log(list.lastBuild.number);
        jenkins.build.get(moduleName,list.lastBuild.number, function(err, list) {
            if (err) {
                return console.log(err);
            }
            console.log(list);
            if (list.building){
                console.log ('building');
                setTimeout(verifyModuleLastBuildInfo,60000)
            } else if (list.result != 'SUCCESS') {
                console.log('not successful');
            } else {
                buildModuleInJenkins(moduleName);
            }
        }
        );
    }
    );
}*/

function deployModuleInJenkins(callback) {
    console.log('In building');
    var module = moduleName.replace('-','_');
    console.log(module);
	if(module == 'cbdirector'){
		jenkins.job.build('DEPLOY_lbng_IAD',function(err) {
			if (err) {
				callback({ err: 'Could not Build Error: ' + err});
			} else {
				callback();
			}
		});
	} else {
		jenkins.job.build('DEPLOY_'+ module + '_1',function(err) {
			if (err) {
				callback({ err: 'Could not Build Error: ' + err});
			} else {
				callback();
			}
		});
	}

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
console.log('Waiting For Browser To Connect..')
io.sockets.on('connection', function(soc) {
  console.log('A Browser Connected')
  socket = soc;

});

//global result file
var resultFile;
//global moduleName
var moduleName;

function getFiles(dir, callback){
	fs.readdir(dir, function(err,files) {
		if (err){
			callback({ err: 'Could not Find Files: ' + err});
		} else {
			//console.log(files);
			var f = [];
			for (var i in files) {
				var name = dir+files[i];
				if (!fs.statSync(name).isDirectory()) {
					f.push(name);
				}
			}
			callback(null, f);
		}
	});
}

/*function getFiles(dir){
    var files = fs.readdirSync(dir);
    for(var i in files){
        if (!files.hasOwnProperty(i)) continue;
        var name = dir+files[i];
        if (!fs.statSync(name).isDirectory()){
            //console.log(name);
			exec('python ' + name + ' -e stage -u 501262 -d 2');
        }
    }
}*/

function createResultsFile(releaseName, moduleName) {
  var resultsRoot = __dirname + '/public/results/';
  if (!fs.existsSync(resultsRoot)) {
    mkdir(resultsRoot);
  }

  releaseName = releaseName.replace("/", "_");
  resultFile = resultsRoot + releaseName + "__" + moduleName + "__" + moment().format("MM-DD-YYYY-hhmmssA") + ".txt";
  console.log("ResultFile Name:" + resultFile);
}

function logAndStreamData(data) {
  data = '[' + moment().format("YYYY-MM-DDThh:mm:ss") + '] ' + data;
  //send it back to browser immediately
  socket.emit('TestRunnerChannel', data);

  echo(data).toEnd(resultFile);
}

function stub(variable, cb) {
  cb();
}

function waitAMin(callback) {
  logAndStreamData('Waiting 1 min here ...');
  setTimeout(function() {
	  callback();
  }, 60000);
}

function cdToFolderAsync(folder, callback) {
  cd(folder);
  callback(null)
}

function runStep1() {
  logAndStreamData('Step 1: Doing cd ~/stage');
  // cdToFolderAsync(path.homedir() + '/stage', this);
  stub('bla', this);
}

function runStep2(code, output) {
  logAndStreamData('Step 2: Doing "git env fetch"');
  //exec('git env fetch', this);
  stub('bla', this);
}

function runStep3(code, output) {
  logAndStreamData('Step 3: Doing "git env reset --hard origin/stage"');
  //exec('git env reset --hard origin/stage', this);
  stub('bla', this);
}

function runStep4(code, output) {
  logAndStreamData('Step 4: Doing "git env merge"');
  //exec('git env merge', this);
  stub('bla', this);
}

function runStep5(code, output) {
  logAndStreamData('Step 5: Doing "git env update"');
  //exec('git env update', this);
  stub('bla', this);
}

function runStep6(code, output) {
  logAndStreamData('Step 6: Doing "git env follow ' + moduleName + ' ' + releaseName);
  //exec('git env follow ' + moduleName + ' ' + releaseName, this);
  stub('bla', this);
}

function runStep7(code, output) {
  logAndStreamData('Step 7: Doing "git add ' + moduleName);
  //exec('git add ' + moduleName, this);
  stub('bla', this);
}

function runStep8(code, output) {
  logAndStreamData('Step 8: Doing "git commit -m "Autocommit from TestRunner"');
  //exec('git commit -m "AutoCommit from TestRunner"', this);
  stub('bla', this);
}

function runStep9(code, output) {
  logAndStreamData('Step 9: Doing "git push"');
  //exec('git push', this);
  stub('bla', this);
}


function verifyBuildInfoEnvironment() {
  logAndStreamData('Step 10: Verifying Last Build Info for Job: "environment"');
  doJenkinsStep('environment', this);
}

function verifyBuildInfoPackageCache() {
  logAndStreamData('Step 11: Verifying Last Build Info for Job: "package_cache"');
  doJenkinsStep('package_cache', this);
}

function verifybuildInfoModuleName() {
  logAndStreamData('Step 12: Verifying Last Build Info for Job: "' + moduleName + '"');
  doJenkinsStep(moduleName, this);
}

function buildModuleInJenkins() {
    logAndStreamData('Step 13: Kicking off build for Module Name: "' + moduleName + '"');
	deployModuleInJenkins(this);
}

function waitinStep() {
  logAndStreamData('Waiting for a min in between Steps');
  waitAMin(this);
}

function verifyNewBuildInJenkins_1() {
  var m =  'DEPLOY_' + moduleName.replace('-','_') + '_1';
  logAndStreamData('Step 14: Verifying Last Deploy Info for Job: "' + m + '"');
  doJenkinsStep(m, this);
}

function verifyNewBuildInJenkins_2() {
  var m =  'DEPLOY_' + moduleName.replace('-','_') + '_2';
  logAndStreamData('Step 15: Verifying Last Deploy Info for Job: "' + m + '"');
  doJenkinsStep(m, this)
}

function verifyNewBuildInJenkinsForDLB() {
	var m = 'DEPLOY_lbng_IAD';
	logAndStreamData('Step 14: Verifying Last Deploy Info for Job: "' + m + '"');
	doJenkinsStep(m, this)
}

function runStep1ForTest() {
  logAndStreamData('Step 15: Doing cd ~/autoreg');
  cdToFolderAsync(path.homedir() + '/autoreg', this);
  //stub('bla', this);
}

function runStep2ForTest(code, output) {
  logAndStreamData('Step 16: Doing "git checkout develop"');
  exec('git checkout develop', this);
  //stub('bla', this);
}

function runStep3ForTest(code, output) {
  logAndStreamData('Step 17: Doing "git pull"');
  exec('git pull', this);
  //stub('bla', this);
}

function runStep4ForDLBTest() {
  logAndStreamData('Step 18: Doing cd ' + path.homedir() + '/autoreg/frameworks/pyapiframework/apitests/lbdirector/');
  console.log(path.homedir() + '/autoreg/frameworks/pyapiframework/apitests/lbdirector/');
  cdToFolderAsync(path.homedir() + '/autoreg/frameworks/pyapiframework/apitests/lbdirector/', this);
  //stub('bla', this);
}

function runStep5ForDLBTest() {
  logAndStreamData('Step 19: Getting all files to be executed');
  var allTestsFolder = path.homedir() + '/autoreg/frameworks/pyapiframework/apitests/lbdirector/';
  getFiles(allTestsFolder, this);
  //exec('python lbDirectorAddBasicLb.py -e stage -u 501262 -d 2', this);
  //stub('bla', this);
}

function runStep6ForDLBTest(err, files){
	/*logAndStreamData('Step 20: Executing "python xxx.py -e stage -u 501262 -d 2"');
	if (err){
		//this
	} else {
		for (var i = 0; i < files.length;i++ ){
			logAndStreamData('Doing "python ' + files[i] +' -e stage -u 501262 -d 2"');
			exec('python ' + files[i] +' -e stage -u 501262 -d 2');
		}

	}*/
	__runStep6ForDLBTest(err, files, this);
}

function __runStep6ForDLBTest(err, files, callback){
	var totalTestsCount = 0;
	var currentTestCount = 0;

	function executeTest(testCommand) {
		exec(testCommand, function (code, output){
			logAndStreamData("Test Result For: " + testCommand + "\n");
			logAndStreamData("****** output ******: \n" + output);
			if (currentTestCount < (totalTestsCount - 1)){
				currentTestCount++;
			} else {
				callback();
			}
		});
	}


	logAndStreamData('Step 20: Executing "python xxx.py -e stage -u 501262 -d 2"');
	if (err){
		callback(err);
	} else {
		totalTestsCount  = files.length;
		for (var i = 0; i < totalTestsCount; i++){
			if (files[i].indexOf("__init__.py") != -1){
				continue;
			}
			executeTest('python ' + files[i] +' -e stage -u 501262 -d 2');
		}
	}
}

function runFinalStep(code, output) {
  logAndStreamData(output);
  logAndStreamData('Step final: Done');
}

function startTest(releaseName, mName) {
  moduleName = mName;
  createResultsFile(releaseName, mName);

  logAndStreamData("Running Test For: Release Name: " + releaseName + " Module Name: " + mName);

  var data = which('git');
  if (!data) {
    logAndStreamData('Sorry, this script requires git');
    process.exit();
  }

  console.log(moduleName);

  if (moduleName == 'customer-portal')  {
	Step(runStep1,
		runStep2,
		runStep3,
		runStep4,
		runStep5,
		runStep6,
		runStep7,
		runStep8,
		runStep9,
		verifyBuildInfoEnvironment,
		verifyBuildInfoPackageCache,
		verifybuildInfoModuleName,
		buildModuleInJenkins,
		waitinStep,
		verifyNewBuildInJenkins_1,
		waitinStep,
		verifyNewBuildInJenkins_2,
		runStep1ForTest,
		runFinalStep
	);
  }  else if (moduleName == 'cbdirector') {
	  Step(runStep4ForDLBTest,
		  runStep5ForDLBTest,
		  runStep6ForDLBTest,
		  runFinalStep
	  );
  } else if (moduleName == 'cbdirectory') {
	  Step(runStep1,
		  runStep2,
		  runStep3,
		  runStep4,
		  runStep5,
		  runStep6,
		  runStep7,
		  runStep8,
		  runStep9,
		  verifyBuildInfoEnvironment,
		  verifyBuildInfoPackageCache,
		  verifybuildInfoModuleName,
		  buildModuleInJenkins,
		  waitinStep,
		  verifyNewBuildInJenkinsForDLB,
		  runStep1ForTest,
		  runStep2ForTest,
		  runStep3ForTest,
		  runStep4ForDLBTest,
		  runStep5ForDLBTest,
		  runFinalStep
	  );
  }
}

app.configure('development', function() {
  app.use(express.errorHandler());
});


server.listen(3000);