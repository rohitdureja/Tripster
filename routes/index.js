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

var userid;

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
		userid = results[0].ID;
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
				query = "insert into users values (userid_seq.nextval, '"+username+"','"+firstname+"','"+lastname+"','"+username+"')";
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
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	res.render('search', {title: 'Search', user:req.user, users: '', trips: ''});
});

// Search results
router.post('/search', function(req, res) {
	var search_string = req.body.searchquery;
	console.log(search_string);
	var users;
	var trips;
	console.log(userid);
	//query = "SELECT U.USERNAME, U.FIRST_NAME, U.LAST_NAME, U.EMAIL FROM USERS U WHERE U.EMAIL LIKE '\%"+search_string+"\%' OR U.USERNAME LIKE '\%"+search_string+"\%' OR U.FIRST_NAME LIKE '\%"+search_string+"\%'";
	query = "WITH SEARCHED_USER AS ( \
SELECT U.ID \
FROM USERS U \
WHERE (U.EMAIL LIKE '%"+search_string+"%' OR \
U.USERNAME LIKE '%"+search_string+"%' OR \
U.FIRST_NAME LIKE '%"+search_string+"%')), \
CURRENT_USERS_FRIENDS AS ( \
SELECT U.ID, U.USERNAME, U.FIRST_NAME, U.EMAIL, F.STATUS AS STATUS \
FROM FRIENDS F, USERS U \
INNER JOIN SEARCHED_USER SU \
ON SU.ID = U.ID \
WHERE (F.USER_ID1 = U.ID AND F.USER_ID2 = "+userid+") \
OR (F.USER_ID2 = U.ID AND F.USER_ID1 = "+userid+")), \
CURRENT_USERS_NON_FRIENDS AS ( \
SELECT U.ID, U.USERNAME, U.FIRST_NAME, U.EMAIL, 'Not A Friend' AS STATUS \
FROM SEARCHED_USER SU \
INNER JOIN USERS U \
ON SU.ID = U.ID \
WHERE SU.ID NOT IN( \
SELECT CUF.ID \
FROM CURRENT_USERS_FRIENDS CUF \
) \
) \
SELECT * FROM CURRENT_USERS_NON_FRIENDS \
UNION \
SELECT * FROM CURRENT_USERS_FRIENDS" 
	console.log(query);

	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		users = results;
		//Display all users
		for(var i = 0 ; i < users.length ; ++i)
		{
			console.log(users[i].USERNAME + " " + users[i].FIRST_NAME + " " + users[i].LAST_NAME + " " + users[i].EMAIL + " " + users[i].STATUS);
		}
		//res.send(users);

		query = "SELECT T.NAME AS TRIP_NAME, U.ID AS USER_ID, U.FIRST_NAME AS TRIP_OWNER, T.START_DATE AS START_DATE, T.END_DATE AS END_DATE, L.NAME AS LOCATION FROM TRIPS_LOCATIONS TL \
		INNER JOIN TRIPS T \
		ON T.ID = TL.TRIP_ID \
		INNER JOIN LOCATIONS L \
		ON L.ID = TL.LOCATION_ID \
		INNER JOIN USERS U \
		ON U.ID = T.OWNER \
		WHERE L.NAME LIKE '%"+search_string+"%' OR \
		T.NAME LIKE '%"+search_string+"%'";
		console.log(query);
		
		conn.execute(query, [], function(err, results) {
			if(err) {
				console.log('Error executing query: ', err);
				res.send('There was a problem querying the databases');
				//TODO: delete from stormpath also!
				return;
			}
			trips = results;

			// Display all trips/locations
			for(var i = 0 ; i < trips.length ; ++i)
			{
				console.log(trips[i].TRIP_NAME + " " + trips[i].USER_ID + " " +
					trips[i].TRIP_OWNER + " " + trips[i].START_DATE + " " + 
					trips[i].END_DATE + " " + trips[i].LOCATION);
			}
			//res.send(trips);

			res.render('search', {title:'Search', user:req.user, users: users, trips: trips});
		});
	});
});

// User profile
router.get('/profile', function(req, res) {

});

router.get('/request', function(req, res) {
	console.log(req.query.type);
	console.log(req.query.userid);
	query = "INSERT INTO FRIENDS F VALUES ('"+userid+"','"+req.query.userid+"', 'Pending')";
	
	console.log(query);

	conn.execute(query, [], function(err, results) {
			if(err) {
				console.log('Error executing query: ', err);
				res.send('There was a problem querying the databases');
				//TODO: delete from stormpath also!
				return;
			}
		});
});
/*
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
*/

module.exports = router;
