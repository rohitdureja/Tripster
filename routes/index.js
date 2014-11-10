var express = require('express');
var router = express.Router();
var passport = require('passport');
var stormpath = require('stormpath');

var error = '';
/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Welcome', error: error, user: req.user });
  error = '';
});

// User home page, once logged in
router.get('/home', function(req, res) {
	console.log(res.user);
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	res.render('home', {title: 'Home', user: req.user});
});

// Register a new user
router.post('/signup', function(req, res) {
	var username = req.body.username;
	var password = req.body.password;
	var firstname = req.body.firstname;
	var lastname = req.body.lastname;

	// Initialise our Stormpath client
	var apiKey = new stormpath.ApiKey(
		process.env['STORMPATH_API_KEY_ID'],
		process.env['STORMPATH_API_KEY_SECRET']
		);
	var spClient = new stormpath.Client({apiKey: apiKey});

	// Grab the stormpath app and create a new user account.
	var app = spClient.getApplication(process.env['STORMPATH_APP_HREF'], function(err, app) {
		if(err) throw err;

		app.createAccount({
			givenName: firstname,
			surname: lastname,
			username: username,
			email: username,
			password: password,
		}, function(err, createdAccount) {
			if(err) {
				console.log(err.userMessage);
				return res.render('index', {title: 'Welcome', error: 'Error: ' + err.userMessage});
			}
			else {
				passport.authenticate('stormpath')(req, res, function() {
					return res.redirect('/home');
				});
			}
		});
	});
});

// Authenticate a user
router.post('/login',
	passport.authenticate(
		'stormpath',
		{
			successRedirect:'/home',
			failureRedirect: '/',
			failureFlash: 'Invalid email or password',
		}
	)
);

// Log out from session
router.get('/logout', function(req, res) {
	error = 'Error: ' + req.user.givenName + ' you are now signed out.'
	req.logout();
	res.redirect('/');
});
/*router.post('/login', function(req, res) {
	var error = "true";
	var username = req.body.username;
	if(error=="false")
		res.render('index', { title: 'Welcome', error: error });
	else
		res.render('home', {title: username});
});*/

module.exports = router;
