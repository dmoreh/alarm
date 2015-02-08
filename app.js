var express = require('express');
var multer  = require('multer');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var schedule = require('node-schedule');
var pythonShell = require('python-shell');
var shell = require('shelljs');

mongoose.connect('mongodb://localhost/test');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

var recordingSchema = mongoose.Schema({
	name: String,
	path: String,
	author: String,
	date: Date,
	played: Boolean
});
var Recording = mongoose.model('Recording', recordingSchema);

var alarmSchema = mongoose.Schema({
	dayOfWeek: Number,
	time: String,
	enabled: Boolean
});
var Alarm = mongoose.model('Alarm', alarmSchema);

var UPLOADS_PATH = './uploads/'

var app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use('/upload_recording', multer({
	dest: UPLOADS_PATH,
	rename: function (fieldname, filename) {
  		return fieldname + '_' + filename + '_'+ Date.now()
	}
}));

app.get('/', function(req, res) {
	res.redirect('/form');
});

app.get('/form', function(req, res) {
	res.render('form', {
		title: 'Wake me up',
		classname: 'form'
	});
});

app.post('/upload_recording', function(req, res) {
	var path = UPLOADS_PATH + req.files.audio.name;
	var rec = new Recording({
		name: req.files.audio.originalname,
		path: path,
		author: req.body.author,
		date: new Date(),
		played: false
	});
	rec.save(function (err, recording) {
		if (err) return console.error(err);
		console.log('recording saved to db: ' + recording);
	});

	res.redirect('/success');
});

app.get('/success', function(req, res) {
	res.send('success!');
});

app.get('/admin', function(req, res) {
	Alarm.find(function (err, alarms) {
  		if (err) return console.error(err);

		if (!alarms.length) {
			alarms = [];
			for (var i = 0; i < 7; i++) {
				var alarm = {
					dayOfWeek: i,
					time: "12:00",
					enabled: false
				}
				alarms.push(alarm)
			}
		}
		res.render('admin', {
			title: "Alarms",
			classname: "admin",
			alarms: alarms
		});
	});
});

app.post('/set_alarm', function(req, res) {
	console.log(req.body)

	var enabledDays = req.body.enabled;
	if (!enabledDays.constructor === Array) { 
		enabledDays = [enabledDays];
	}

	Alarm.remove({}, function(err) {
		if (err) return console.error(err);

		req.body.times.forEach(function(time, dayOfWeek, arr) {
			var enabled = enabledDays.indexOf(dayOfWeek.toString()) > -1;
			console.log(dayOfWeek, time, enabled);

			var alarm = new Alarm({
				dayOfWeek: dayOfWeek,
				time: time,
				enabled: enabled
			});
			alarm.save(function (err, alarm) {
				if (err) return console.error(err);
				console.log('alarm saved to db: ' + alarm);
				
				// TODO: figure out sync issues so this can be done at end of loop.
				if (dayOfWeek == arr.length - 1) {
					update_schedule();
				}
			});
		});

		res.redirect('/success');
	});
});

app.get('*', function(req, res) {
	res.send('bad route dude');
});

var jobs = []; // TODO: Should jobs be in mongo?
var update_schedule = function() {
	// cancel all old jobs
	jobs.forEach(function(job, idx, arr) {
		job.cancel();
	});

	// create new ones for current alarms
	Alarm.find(function (err, alarms) {
  		if (err) return console.error(err);

  		for (var i = 0; i < alarms.length; i++) {
  			alarm = alarms[i]
  			if (!alarm.enabled) continue;

			var rule = new schedule.RecurrenceRule();
			rule.dayOfWeek = alarm.dayOfWeek;
			time = alarm.time.split(":");
			rule.hour = parseInt(time[0]);
			rule.minute = parseInt(time[1]);

			var job = schedule.scheduleJob(rule, function() {
				soundAlarm();
			});
			jobs.push(job);
  		}
	});
};

var soundAlarm = function() {
	pickRecording(function(rec) {
		var path = rec.path
		shell.exec('mpg321 ' + path, function (code, output) {
			console.log('finished');
		 	rec.played = true;
		 	console.log(rec);
			rec.save(function (err, recording) {
				if (err) return console.error(err);
				console.log('recording saved to db: ' + recording);
			});
		});
	});
};

var pickRecording = function(callback) {
	Recording.find({'played': false}, function (err, unplayed) {
		if (err || (unplayed.length < 1)) {
			Recording.find({}, function (err, all) {
				// TODO: this fails if there are no recordings.
				return callback(all[0]);
			});
		}
		return callback(unplayed[0]);
	});
}

var server = app.listen(3000, function() {
	console.log('Listening on port 3000 yo');
});
