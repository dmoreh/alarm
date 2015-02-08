var express = require('express');
var multer  = require('multer');
var mongoose = require('mongoose');

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

var UPLOADS_PATH = './uploads/'

var app = express();

app.set('view engine', 'ejs');
app.use('/upload_recording', multer({
	dest: UPLOADS_PATH,
	rename: function (fieldname, filename) {
  		return fieldname + filename + Date.now()
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
	rec.save(function (err, recording){
		if (err) return console.error(err);
		console.log('saved to db: ' + recording);
	});

	res.redirect('/success');
});

app.get('/success', function(req, res) {
	res.send('success!');
});

app.get('/admin', function(req, res) {
	res.render('admin', {
		title: "Admin",
		classname: "admin",
		alarms: [
			{
				'dayOfWeek': 'Monday',
				'datetime': new Date()
			},
			{'dayOfWeek': 'Tuesday'}
		]
	});
});

app.get('*', function(req, res) {
	res.send('bad route dude');
});

var server = app.listen(3000, function() {
	console.log('Listening on port 3000 yo');
});
