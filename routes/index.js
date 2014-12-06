var express = require('express');
var router = express.Router();
var passport = require('passport');
var stormpath = require('stormpath');

// Set up oracle
var oracle = require('oracle');
var conn;
var connectData = {
    hostname: "tripster.cx4nlyh3nrji.us-west-2.rds.amazonaws.com",
    port: 1521,
    database: "ORCL",
    user: "tripsteradmin",
    password: "adminRS1!" 
}
oracle.connect(connectData, function(err, connection) {
	if(err) {
		console.log("Error connecting to db: ", err);
	    return;
	}
	console.log('connected');
	conn=connection;
});

var error = '';	// variable for error messages.
var query = ''; // variable to form sql queries.

/* GET home page. */
router.get('/', function(req, res) {
  // If user is logged in
  if(!req.user || req.user.status !== 'ENABLED') {
  	res.render('index', { title: 'Welcome', error: error, user: req.user });
  	error = '';
  }
  else
  	res.redirect('/home');
});

// User home page, once logged in
router.get('/home', function(req, res) {
	console.log(res.user);
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	query = "select users.id from users where users.username = '"+req.user.username+"'";
	console.log(query);
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			return;
		}
		req.user.id = results[0].ID;
		console.log(req.user.id);
		res.render('home', {title: 'Home', user: req.user});
	});

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
	var app = spClient.getApplication(process.env['STORMPATH_APP_HREF'], function(err, app) 
	{
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
				// Add new user to our SQL database.
				query = "insert into users values (userid_seq.nextval, '"+username+"','"+firstname+"','"+lastname+"')";
				console.log(query);
				conn.execute(query, [], function(err, results) {
					if(err) {
						console.log('Error executing query: ', err);
						res.send('There was a problem querying the databases');
						//TODO: delete from stormpath also!
						return;
					}
				});
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
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	else {
		error = req.user.givenName + ' you are now signed out. We miss you already, come back soon!'
		req.logout();
		res.redirect('/');
	}
});

// Search box
router.get('/search', function(req, res) {

});

// User profile
router.get('/profile', function(req, res) {

});

// Populate stormapth
router.get('/populate', function(req, res) {
	var query = "select * from users";
	var username;
	var password;
	var firstname;
	var lastname;
	var email;

	var i = 26;
	// Initialise our Stormpath client
	var apiKey = new stormpath.ApiKey(
		process.env['STORMPATH_API_KEY_ID'],
		process.env['STORMPATH_API_KEY_SECRET']
		);
	var spClient = new stormpath.Client({apiKey: apiKey});

	console.log(query);
	conn.execute(query, [], function(err, results) {
		if(err) 
		{
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			return;
		}
		else
		{
			//res.send(results);
			console.log(results.length);
			//for(var i = 0 ; i < results.length ; ++i)
			//{
				//setTimeout(function() {
    			//console.log('Blah blah blah blah extra-blah');
				//}, 3000);
				username = results[i].USERNAME;
				password = 'Tripster123!';
				firstname = results[i].FIRST_NAME;
				lastname = 'Tripster'
				email = results[i].EMAIL;
				//email = username + '@gmail.com';
				console.log(username + " " + password + " " + firstname + " " + email + "\n");
				// Grab the stormpath app and create a new user account.
				var app = spClient.getApplication(process.env['STORMPATH_APP_HREF'], function(err, app) 
				{
					if(err) throw err;

					app.createAccount(
					{
						givenName: firstname,
						surname: lastname,
						username: username,
						email: email,
						password: password,
					}, function(err, createdAccount) 
					{
						if(err) 
						{
							console.log(err.userMessage);
							throw err;
						}
					});
				});
			//}
		}
	});	
});

module.exports = router;
