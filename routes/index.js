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
	var mytrips;
	var friends;
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

		// get trips owned by user
		query = "select ID, NAME, to_char(START_DATE, 'MM/DD/YYYY') AS START_DATE from trips where OWNER="+userid+" ORDER BY START_DATE";
		console.log(query);
		conn.execute(query, [], function(err, results) {
			if(err) {
				console.log('Error executing query: ', err);
				res.send('There was a problem querying the databases');
				return;
			}
			mytrips=results;
			console.log(mytrips);
			query = "SELECT U.ID, U.USERNAME, U.FIRST_NAME, U.LAST_NAME, U.EMAIL, F.STATUS AS STATUS FROM FRIENDS F, USERS U WHERE F.STATUS = 'Accepted' AND ((F.USER_ID1 = U.ID AND F.USER_ID2 = "+userid+") OR (F.USER_ID2 = U.ID AND F.USER_ID1 = "+userid+"))";
			console.log(query);
			conn.execute(query, [], function(err, results) {
			if(err) {
				console.log('Error executing query: ', err);
				res.send('There was a problem querying the databases');
				return;
			}
			friends = results;
			console.log(friends);
			res.render('home', {title: 'Home', user: req.user, mytrips: mytrips, friends: friends});
		});
		});
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

// Send, approve, reject friend requests and user requests
router.get('/request', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	console.log(req.query.type);
	if(req.query.type=='friend')
	{
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
	}
	if(req.query.type=='request')
	{
		if(req.query.decision=='accept')
		{
			query = "UPDATE FRIENDS F \
			SET F.STATUS = 'Accepted' \
			WHERE F.USER_ID1 = "+req.query.userid+" AND F.USER_ID2 = "+userid;
		}
		if(req.query.decision=='reject')
		{
			query = "UPDATE FRIENDS F \
			SET F.STATUS = 'Rejected' \
			WHERE F.USER_ID1 = "+req.query.userid+" AND F.USER_ID2 = "+userid;
		}
		console.log(query);

		conn.execute(query, [], function(err, results) {
				if(err) {
					console.log('Error executing query: ', err);
					res.send('There was a problem querying the databases');
					return;
				}
			});
	}
});

// Display all friend and trip requests
router.get('/requests', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var user_requests;
	var trip_requests;
	query = "SELECT U.ID, U.FIRST_NAME, U.LAST_NAME, U.EMAIL, U.USERNAME, F.STATUS \
	FROM USERS U \
	INNER JOIN FRIENDS F \
	ON F.USER_ID1 = U.ID \
	WHERE F.USER_ID2 = "+userid;
	console.log(query);
	conn.execute(query, [], function(err, results) {
			if(err) {
				console.log('Error executing query: ', err);
				res.send('There was a problem querying the databases');
				//TODO: delete from stormpath also!
				return;
			}
			user_requests = results;
			for(var i = 0 ; i < user_requests.length ; ++i)
			{
				console.log(user_requests[i].ID + " " + user_requests[i].USERNAME);
			}
			query = "SELECT TU.TRIP_ID, T.NAME, U.FIRST_NAME, U.LAST_NAME, U.ID, to_char(T.START_DATE, 'MM/DD/YYYY') AS START_DATE, T.END_DATE, T.TRIP_TYPE \
			FROM TRIPS_USERS TU \
			INNER JOIN TRIPS T \
			ON T.ID = TU.TRIP_ID \
			INNER JOIN USERS U \
			ON TU.USER_ID_REQUEST = U.ID \
			WHERE TU.USER_ID = "+userid+" AND \
			TU.STATUS = 'Pending'";
			console.log(query);
			conn.execute(query, [], function(err, results) {
				if(err) {
					console.log('Error executing query: ', err);
					res.send('There was a problem querying the databases');
					//TODO: delete from stormpath also!
					return;
				}
				trip_request = results;
				console.log(trip_request);
				res.render('requests', {title: 'Requests', user: req.user, user_requests: user_requests, trip_requests: trip_request});
			});
		});
});

// Accept/Reject trip requests
router.get('/invitetrip', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var accept = req.query.accept;
	var tripid = req.query.tripid;
	if(accept=='yes')
		query = "UPDATE TRIPS_USERS TU SET TU.STATUS = 'Accepted' WHERE TU.USER_ID = "+userid+" AND TU.TRIP_ID = "+tripid;
	else
		query = "UPDATE TRIPS_USERS TU SET TU.STATUS = 'Rejected' WHERE TU.USER_ID = "+userid+" AND TU.TRIP_ID = "+tripid;
	console.log(query);
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		res.redirect('/trip?id='+tripid);
	});
});

// Create trip form
router.get('/createtrip', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	res.render('createtrip', {title: 'Create', user:req.user});
});

// Create trip and add to database
router.post('/createtrip', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var tripname = req.body.tripname;
	var type = req.body.type;
	var startdate = req.body.startdate;
	var enddate = req.body.enddate;
	var privacy = req.body.privacy=='public'?1:0;

	console.log(tripname);
	console.log(type);
	console.log(startdate);
	console.log(enddate);
	console.log(privacy);
	query = "INSERT INTO TRIPS VALUES (TRIPID_SEQ.NEXTVAL,'"+tripname+"','"+startdate+"','"+enddate+"','"+privacy+"','"+type+"',"+userid+")";
	console.log(query);
	conn.execute(query, [], function(err, results) {
			if(err) {
				console.log('Error executing query: ', err);
				res.send('There was a problem querying the databases');
				//TODO: delete from stormpath also!
				return;
			}
			res.redirect('/home');
		});
});

// Trip page
router.get('/trip', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var trip;
	var tripid = req.query.id;
	query = "SELECT NAME, to_char(START_DATE, 'MM/DD/YYYY') AS START_DATE, OWNER FROM TRIPS WHERE ID="+tripid;
	console.log(query);
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		trip = results;
		console.log(trip);
		res.render('trip', {title: 'Trip', user: req.user, trip: trip, tripid: tripid});
	});
});

// Invite friends to trips
router.get('/invite', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var tripid = req.query.tripid;
	console.log(tripid);
	query = "WITH USER_FRIENDS_INVITED AS ( \
		SELECT U.ID, U.USERNAME, U.FIRST_NAME, U.EMAIL, TU.STATUS \
		FROM USERS U \
		INNER JOIN TRIPS_USERS TU \
		ON U.ID = TU.USER_ID \
		WHERE TU.USER_ID_REQUEST = "+userid+" \
		AND TU.TRIP_ID = "+tripid+" \
		), \
		USER_FRIENDS AS ( \
			SELECT U.ID, U.USERNAME, U.FIRST_NAME, U.EMAIL, 'Not Invited' as STATUS \
			FROM FRIENDS F, USERS U \
			WHERE \
			F.STATUS = 'Accepted' AND \
			((F.USER_ID1 = U.ID AND F.USER_ID2 = "+userid+") \
				OR (F.USER_ID2 = U.ID AND F.USER_ID1 = "+userid+")) AND \
				U.ID NOT IN (SELECT ID FROM USER_FRIENDS_INVITED)) \
				SELECT * FROM USER_FRIENDS_INVITED \
				UNION \
				SELECT * FROM USER_FRIENDS";
	console.log(query);
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		console.log(results);
		var friend_status = results;
		res.render('invite', {title: 'Invite', user: req.user, friend_status: friend_status, tripid: tripid});
	});
});

router.get('/tripinvite', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var inviteduser = req.query.user;
	var tripid = req.query.tripid;
	query = "INSERT INTO TRIPS_USERS VALUES ('"+inviteduser+"', '"+tripid+"', NULL, 'Pending', '"+userid+"')";
	console.log(query);
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		res.redirect('/trip?id='+tripid);
	});
});

// view albums
router.get('/albums', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var tripid = req.query.tripid;
	var albums;
	console.log(tripid);
	
	// get trip details
	query = "SELECT NAME, to_char(START_DATE, 'MM/DD/YYYY') AS START_DATE, OWNER FROM TRIPS WHERE ID="+tripid;
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		trip = results;
		console.log(trip);
		query = "SELECT A.NAME, A.ID, A.PRIVACY FROM ALBUMS A WHERE A.TRIP_ID="+tripid;
		conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		albums = results;
		console.log(results);
		res.render('albums', {title: 'Trip', user: req.user, trip: trip, tripid: tripid, albums: albums});
	});
	});
});

//view a single album
router.get('/album', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var tripid = req.query.tripid;
	var albumid = req.query.albumid;
	var photos;
	query = "SELECT NAME, to_char(START_DATE, 'MM/DD/YYYY') AS START_DATE, OWNER FROM TRIPS WHERE ID="+tripid;
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		trip = results;
		query = "SELECT P.ID AS PHOTO_ID, P.LIKES, to_char(P.PIC_DATE, 'MM/DD/YYYY') AS PIC_DATE, P.TAGLINE, P.URL \
			FROM PHOTOS P \
			WHERE P.ALBUM_ID = "+albumid+"ORDER BY P.PIC_DATE DESC";
		conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		photos = results;
		console.log(photos);
		res.render('album', {title: 'Content', user: req.user, trip: trip, tripid: tripid, photos: photos});
	});
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
