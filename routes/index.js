var express = require('express');
var router = express.Router();
var passport = require('passport');
var stormpath = require('stormpath');

// set up bing
var bing = require('node-bing-api')({ accKey: "9o1S2RG4wO5WVkQUFDrTt7SoJCZ5Syr9gbRdWqBxB9M" });

// set up yelp
var yelp = require("yelp").createClient({
  consumer_key: "UTCI8OcuhaN7Cqph8_8siw", 
  consumer_secret: "di1gM3PyTD0mAxabO38On_qnMu8",
  token: "4k8dhwLMlnDuRE9kFB1tPJewMdluEnKS",
  token_secret: "rqhR7uU4k4xFa57VQLbfIVPwo2w"
});

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

//Set up mongoDB
/*var Db = require('mongodb').Db,
 MongoClient = require('mongodb').MongoClient,
 Server = require('mongodb').Server,
 ReplSetServers = require('mongodb').ReplSetServers,
 ObjectID = require('mongodb').ObjectID,
 Binary = require('mongodb').Binary,
 GridStore = require('mongodb').GridStore,
 Grid = require('mongodb').Grid,
 Code = require('mongodb').Code,
 BSON = require('mongodb').pure().BSON,
 assert = require('assert');

var mongodb_conn;
var requestdb = require('request');

MongoClient.connect('mongodb://127.0.0.1:27017/test', function(err, mongodb) {
	if(err) {
		console.log("Error connecting to mongodb: ", err);
	    return;
	}
	console.log('connected to mongodb');
	mongodb_conn = mongodb;
});*/


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
	var newsfeed;
	var recommendations;
	var friendrec;
	var alltrips;
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
			query = "WITH CURRENT_USERS_FRIENDS AS ( \
				SELECT U.ID AS USER_ID, U.USERNAME AS USERNAME, U.FIRST_NAME AS FIRST_NAME, U.EMAIL AS EMAIL, F.STATUS AS STATUS \
				FROM FRIENDS F, USERS U \
				WHERE \
				F.STATUS = 'Accepted' AND \
				((F.USER_ID1 = U.ID AND F.USER_ID2 = "+userid+") \
				OR (F.USER_ID2 = U.ID AND F.USER_ID1 = "+userid+")) \
				), \
				PIC_LIKES AS (SELECT PHOTO_ID, COUNT(*) AS LIKES \
				FROM PHOTOS_LIKES PL \
				GROUP BY PHOTO_ID), \
				VID_LIKES AS (SELECT VIDEO_ID, COUNT(*) AS LIKES \
				FROM VIDEOS_LIKES VL \
				GROUP BY VIDEO_ID), \
				VIDS AS ( \
				SELECT V.ID AS ID, VL.LIKES AS LIKES, to_char(V.VIDEO_DATE , 'MM/DD/YYYY') AS DISPLAY_CONTENT_DATE, V.VIDEO_DATE AS CONTENT_DATE, V.TAGLINE AS TAGLINE, A.NAME AS ALBUM_NAME, T.NAME AS TRIP_NAME, V.URL AS CONTENT_URL, 'Video' AS CONTENT_TYPE, LISTAGG(CUF.FIRST_NAME, ',' ) WITHIN GROUP (ORDER BY V.ID) AS USER_NAMES \
				FROM VIDEOS V \
				INNER JOIN ALBUMS A \
				ON V.ALBUM_ID = A.ID \
				INNER JOIN TRIPS T \
				ON T.ID = A.TRIP_ID \
				INNER JOIN TRIPS_USERS TU \
				ON TU.TRIP_ID = T.ID \
				INNER JOIN CURRENT_USERS_FRIENDS CUF \
				ON CUF.USER_ID = TU.USER_ID \
				LEFT OUTER JOIN \
				VID_LIKES VL \
				ON VL.VIDEO_ID = V.ID \
				WHERE V.PRIVACY = 1 AND \
				A.PRIVACY = 1 AND \
				T.PRIVACY = 1 \
				GROUP BY V.ID, VL.LIKES, V.VIDEO_DATE, V.TAGLINE, A.NAME, T.NAME, V.URL \
				ORDER BY V.VIDEO_DATE DESC), \
				PICS AS ( \
				SELECT P.ID AS ID, PL.LIKES AS LIKES, to_char(P.PIC_DATE, 'MM/DD/YYYY') AS DISPLAY_CONTENT_DATE, P.PIC_DATE AS CONTENT_DATE, P.TAGLINE AS TAGLINE, A.NAME AS ALBUM_NAME, T.NAME AS TRIP_NAME, P.URL AS CONTENT_URL, 'Photo' AS CONTENT_TYPE, LISTAGG(CUF.FIRST_NAME, ',' ) WITHIN GROUP (ORDER BY P.ID) AS USER_NAMES \
				FROM PHOTOS P \
				INNER JOIN ALBUMS A \
				ON P.ALBUM_ID = A.ID \
				INNER JOIN TRIPS T \
				ON T.ID = A.TRIP_ID \
				INNER JOIN TRIPS_USERS TU \
				ON TU.TRIP_ID = T.ID \
				INNER JOIN CURRENT_USERS_FRIENDS CUF \
				ON CUF.USER_ID = TU.USER_ID \
				LEFT OUTER JOIN \
				PIC_LIKES PL \
				ON PL.PHOTO_ID = P.ID \
				WHERE P.PRIVACY = 1 AND \
				A.PRIVACY = 1 AND \
				T.PRIVACY = 1 \
				GROUP BY P.ID, PL.LIKES, P.PIC_DATE, P.TAGLINE, A.NAME, T.NAME, P.URL \
				ORDER BY P.PIC_DATE DESC) \
				SELECT ID, LIKES, DISPLAY_CONTENT_DATE, CONTENT_DATE, TAGLINE, ALBUM_NAME, TRIP_NAME, CONTENT_URL, CONTENT_TYPE, USER_NAMES \
				FROM PICS \
				UNION \
				SELECT ID, LIKES, DISPLAY_CONTENT_DATE, CONTENT_DATE, TAGLINE, ALBUM_NAME, TRIP_NAME, CONTENT_URL, CONTENT_TYPE, USER_NAMES \
				FROM VIDS \
				ORDER BY CONTENT_DATE DESC";
				conn.execute(query, [], function(err, results) {
			if(err) {
				console.log('Error executing query: ', err);
				res.send('There was a problem querying the databases');
				return;
			}
			newsfeed = results;
			console.log(newsfeed);
			query = "WITH USER_TRIP_TYPES AS ( \
						SELECT DISTINCT T.TRIP_TYPE \
						FROM TRIPS_USERS TU \
						INNER JOIN TRIPS T \
						ON T.ID = TU.TRIP_ID \
						WHERE TU.USER_ID = "+userid+" \
						) \
						SELECT DISTINCT T.ID, T.NAME, U.FIRST_NAME, U.LAST_NAME, T.TRIP_TYPE \
						FROM TRIPS T \
						INNER JOIN TRIPS_USERS TU \
						ON TU.TRIP_ID = T.ID \
						INNER JOIN USERS U \
						ON U.ID = T.OWNER \
						WHERE T.TRIP_TYPE IN \
						(SELECT TRIP_TYPE FROM USER_TRIP_TYPES) \
						AND T.PRIVACY = 1 \
						AND TU.TRIP_ID NOT IN \
						(SELECT TU.TRIP_ID \
						FROM TRIPS_USERS TU \
						WHERE TU.USER_ID = "+userid+")";
				conn.execute(query, [], function(err, results) {
			if(err) {
				console.log('Error executing query: ', err);
				res.send('There was a problem querying the databases');
				return;
			}
			recommendations = results;
			console.log(recommendations);
			query = "WITH USERS_FRIENDS AS ( \
					SELECT U.ID \
					FROM FRIENDS F, USERS U \
					WHERE \
					F.STATUS = 'Accepted' AND \
					((F.USER_ID1 = U.ID AND F.USER_ID2 = "+userid+") \
					OR (F.USER_ID2 = U.ID AND F.USER_ID1 = "+userid+")) \
					), \
					FRIENDS_OF_FRIENDS AS ( \
					SELECT FF.ID \
					FROM FRIENDS F, USERS U, USERS FF \
					WHERE \
					F.STATUS = 'Accepted' AND \
					((F.USER_ID1 = FF.ID AND F.USER_ID2 = U.ID) \
					OR (F.USER_ID2 = FF.ID AND F.USER_ID1 = U.ID)) \
					AND U.ID IN \
					(SELECT ID FROM USERS_FRIENDS) \
					) \
					SELECT DISTINCT FF.ID, U.FIRST_NAME, U.LAST_NAME \
					FROM FRIENDS_OF_FRIENDS FF \
					INNER JOIN USERS U \
					ON U.ID = FF.ID \
					WHERE FF.ID NOT IN \
					(SELECT ID FROM USERS_FRIENDS)";
				conn.execute(query, [], function(err, results) {
					if(err) {
						console.log('Error executing query: ', err);
						res.send('There was a problem querying the databases');
						return;
					}
					friendrec = results;
					query = "SELECT T.ID, T.NAME, to_char(T.START_DATE, 'MM/DD/YYYY') AS START_DATE \
						FROM TRIPS_USERS TU \
						INNER JOIN TRIPS T \
						ON T.ID = TU.TRIP_ID \
						WHERE TU.USER_ID = "+userid+" \
						AND TU.STATUS LIKE 'Accepted'";
						conn.execute(query, [], function(err, results) {
					if(err) {
						console.log('Error executing query: ', err);
						res.send('There was a problem querying the databases');
						return;
					}
					alltrips = results;
					console.log(alltrips);
			res.render('home', {title: 'Home', user: req.user, mytrips: mytrips, friends: friends, newsfeed: newsfeed, recommendations: recommendations, friendrec: friendrec, alltrips: alltrips});
		});
		});
		});
		});
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
	res.render('search', {title: 'Search', user:req.user, users: '', trips: '', bingresults: '', yelpresults: ''});
});

// Search results
router.post('/search', function(req, res) {
	var search_string = req.body.searchquery;
	var search_type = req.body.search;
	console.log(search_string);
	console.log(search_type);
	var users;
	var trips;
	var bingresults;
	var yelpresults;
	console.log(userid);
	if(search_type == 'local') {
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
		console.log('Search start: ' + new Date()/1000);
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
				console.log('Search end: ' + new Date()/1000);
				res.render('search', {title:'Search', user:req.user, users: users, trips: trips, bingresults: '', yelpresults: ''});
			});
		});
	}
	else if(search_type == 'bing') {
		bing.search(search_string, function(error, results, body){
  		bingresults = body.d.results;
  		console.log(bingresults);
  		res.render('search', {title:'Search', user:req.user, users: '', trips: '', bingresults: bingresults, yelpresults: ''});
		}, {
    	top: 20,  // Number of results (max 50)
  	});
	}
	else if(search_type == 'yelp') {
		yelp.search({term: "food", limit: 20, sort: 2, location: search_string}, function(error, data) {
  		console.log(error);
  		if(error.statusCode != 400)
  		{
  			console.log(data.businesses);
	  		yelpresults = data.businesses;
	  		res.render('search', {title:'Search', user:req.user, users: '', trips: '', bingresults: '', yelpresults: yelpresults});
			}
			else {
				console.log('here');
				res.render('search', {title:'Search', user:req.user, users: '', trips: '', bingresults: '', yelpresults: ''});
			}
		});
	}
});

// User profile
router.get('/profile', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var profile_user;
	var uid;
	var dreamlocations;
	var friends;
	if(req.query.uid != null) {
		uid = req.query.uid;
		console.log(uid);
		query = "select users.ID, users.FIRST_NAME, users.LAST_NAME from users where users.ID = "+uid;
		console.log(query);
	}
	else {
		query = "select users.ID, users.FIRST_NAME, users.LAST_NAME from users where users.USERNAME = '"+req.user.username+"'";
		console.log(query);
	}
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			return;
		}
		profile_user = results;
		console.log(profile_user);
		query = "SELECT DISTINCT L.ID, L.NAME \
					FROM DREAM_LOCATIONS DL \
					INNER JOIN LOCATIONS L ON DL.LOCATION_ID = L.ID \
					WHERE DL.USER_ID = "+profile_user[0].ID;
		console.log(query);
		conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			return;
		}
		dreamlocations = results;
		query = "SELECT U.ID, U.USERNAME, U.FIRST_NAME, U.LAST_NAME, U.EMAIL, F.STATUS AS STATUS FROM FRIENDS F, USERS U WHERE F.STATUS = 'Accepted' AND ((F.USER_ID1 = U.ID AND F.USER_ID2 = "+profile_user[0].ID+") OR (F.USER_ID2 = U.ID AND F.USER_ID1 = "+profile_user[0].ID+"))";
		conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			return;
		}
		friends = results;
			res.render('profile', {title: 'Profile', user: req.user, profile_user: profile_user, userid: userid, dreamlocations: dreamlocations, friends: friends});
		});
	});
	});
});

// edit user profile
router.get('/editprofile', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var locations;
	query = "SELECT ID, NAME FROM LOCATIONS ORDER BY NAME";
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			return;
		}
		locations = results;
		res.render('editprofile', {title: 'Edit', user: req.user, locations: locations});
	});
});

// save profile changes
router.post('/editprofile', function(req, res) {
	var firstname = req.body.firstname;
	var lastname = req.body.lastname;
	var dream_location_1 = req.body.dream_location_1;
	var dream_location_2 = req.body.dream_location_2;
	console.log(firstname);
	console.log(lastname);
	console.log(dream_location_1);
	console.log(dream_location_2);
	query = "UPDATE USERS SET FIRST_NAME = '"+firstname+"',LAST_NAME = '"+lastname+"' WHERE ID = "+userid;
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			return;
		}
		if(dream_location_1!="") {
			query = "INSERT INTO DREAM_LOCATIONS VALUES ("+userid+","+dream_location_1+")";
			console.log(query);
			conn.execute(query, [], function(err, results) {
				if(err) {
					console.log('Error executing query: ', err);
					res.send('There was a problem querying the databases');
					return;
				}
				if(dream_location_2 != "") {
					query = "INSERT INTO DREAM_LOCATIONS VALUES ("+userid+","+dream_location_2+")";
					console.log(query);
				}
				conn.execute(query, [], function(err, results) {
					if(err) {
						console.log('Error executing query: ', err);
						res.send('There was a problem querying the databases');
						return;
					}
					res.redirect('/profile');
				});
			});	
		}
	});
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
	var locations;
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	console.log(new Date()/1000);
	query = "SELECT ID, NAME FROM LOCATIONS ORDER BY NAME";
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			return;
		}
		console.log(new Date()/1000);
		locations = results;
		res.render('createtrip', {title: 'Create', user:req.user, locations: locations});
	});
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
	var location = req.body.locations;
	var tripid;

	console.log(tripname);
	console.log(type);
	console.log(startdate);
	console.log(enddate);
	console.log(privacy);
	console.log(location);
	query = "SELECT last_number FROM user_sequences WHERE sequence_name = 'TRIPID_SEQ'";
			conn.execute(query, [], function(err, results) {
			if(err) {
				console.log('Error executing query: ', err);
				res.send('There was a problem querying the databases');
				//TODO: delete from stormpath also!
				return;
			}
			tripid = results[0].LAST_NUMBER;
			console.log(tripid);
			query = "INSERT INTO TRIPS VALUES (TRIPID_SEQ.NEXTVAL,'"+tripname+"','"+startdate+"','"+enddate+"','"+privacy+"','"+type+"',"+userid+")";
			console.log(query);
			conn.execute(query, [], function(err, results) {
			if(err) {
				console.log('Error executing query: ', err);
				res.send('There was a problem querying the databases');
				//TODO: delete from stormpath also!
				return;
			}
			query = "INSERT INTO TRIPS_USERS VALUES ("+userid+","+tripid+", NULL, 'Owner', "+userid+")";
			conn.execute(query, [], function(err, results) {
			if(err) {
				console.log('Error executing query: ', err);
				res.send('There was a problem querying the databases');
				//TODO: delete from stormpath also!
				return;
			}
			query = "INSERT INTO TRIPS_LOCATIONS VALUES("+location+","+tripid+")";
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
		});
		});
});

// Trip page
router.get('/trip', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var trip;
	var tripfeed;
	var tripid = req.query.id;
	query = "SELECT NAME, to_char(START_DATE, 'MM/DD/YYYY') AS START_DATE, OWNER FROM TRIPS WHERE ID="+tripid;
	console.log(query);
	console.log(new Date()/1000);
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		trip = results;
		console.log(trip);
		query = "WITH PIC_LIKES AS (SELECT PHOTO_ID, COUNT(*) AS LIKES \
			FROM PHOTOS_LIKES PL \
			INNER JOIN PHOTOS P \
			ON PL.PHOTO_ID = P.ID \
			INNER JOIN ALBUMS A \
			ON A.ID = P.ALBUM_ID \
			WHERE A.TRIP_ID = "+tripid+" \
			GROUP BY PHOTO_ID), \
			VID_LIKES AS (SELECT VIDEO_ID, COUNT(*) AS LIKES \
			FROM VIDEOS_LIKES VL \
			INNER JOIN VIDEOS V \
			ON VL.VIDEO_ID = V.ID \
			INNER JOIN ALBUMS A \
			ON A.ID = V.ALBUM_ID \
			WHERE A.TRIP_ID = "+tripid+" \
			GROUP BY VIDEO_ID), \
			PICS AS (SELECT P.ID, P.ALBUM_ID AS ALBUM_ID, PL.LIKES, to_char(P.PIC_DATE, 'MM/DD/YYYY') AS DISPLAY_CONTENT_DATE, P.PIC_DATE AS CONTENT_DATE, P.TAGLINE, P.URL, 'Photo' AS CONTENT_TYPE \
			FROM PHOTOS P \
			INNER JOIN ALBUMS A \
			ON P.ALBUM_ID = A.ID \
			LEFT OUTER JOIN \
			PIC_LIKES PL \
			ON PL.PHOTO_ID = P.ID \
			WHERE A.TRIP_ID = "+tripid+" \
			ORDER BY P.PIC_DATE DESC), \
			VIDS AS ( \
			SELECT V.ID, V.ALBUM_ID AS ALBUM_ID, VL.LIKES, to_char(V.VIDEO_DATE , 'MM/DD/YYYY') AS DISPLAY_CONTENT_DATE, V.VIDEO_DATE AS CONTENT_DATE, V.TAGLINE, V.URL, 'Video' AS CONTENT_TYPE \
			FROM VIDEOS V \
			INNER JOIN ALBUMS A \
			ON V.ALBUM_ID = A.ID \
			LEFT OUTER JOIN \
			VID_LIKES VL \
			ON VL.VIDEO_ID = V.ID \
			WHERE A.TRIP_ID = "+tripid+" \
			ORDER BY V.VIDEO_DATE DESC \
			) \
			SELECT ID, ALBUM_ID, LIKES, DISPLAY_CONTENT_DATE, CONTENT_DATE, TAGLINE, URL, CONTENT_TYPE \
			FROM PICS UNION SELECT * FROM VIDS \
			ORDER BY CONTENT_DATE DESC";
		conn.execute(query, [], function(err, results) {
			if(err) {
				console.log('Error executing query: ', err);
				res.send('There was a problem querying the databases');
				//TODO: delete from stormpath also!
				return;
			}
			tripfeed = results;
			console.log(tripfeed);
			query = "WITH USER_FRIENDS_INVITED AS ( \
				SELECT U.ID, U.USERNAME, U.FIRST_NAME, U.LAST_NAME, U.EMAIL, TU.STATUS \
				FROM USERS U \
				INNER JOIN TRIPS_USERS TU \
				ON U.ID = TU.USER_ID \
				WHERE TU.USER_ID_REQUEST = "+userid+" \
				AND TU.TRIP_ID = "+tripid+" \
				), \
				USER_FRIENDS AS ( \
					SELECT U.ID, U.USERNAME, U.FIRST_NAME, U.LAST_NAME, U.EMAIL, 'Not Invited' as STATUS \
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
				console.log(new Date()/1000);
				console.log(results);
				var friend_status = results;
				res.render('trip', {title: 'Trip', user: req.user, trip: trip, tripid: tripid, tripfeed: tripfeed, friend_status: friend_status});
			});
		});
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
	console.log(query);
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		trip = results;
		query = "WITH PIC_LIKES AS (SELECT PHOTO_ID, COUNT(*) AS LIKES \
		FROM PHOTOS_LIKES PL \
		INNER JOIN PHOTOS P \
		ON PL.PHOTO_ID = P.ID \
		INNER JOIN ALBUMS A \
		ON A.ID = P.ALBUM_ID \
		WHERE A.ID = "+albumid+" \
		GROUP BY PHOTO_ID), \
		VID_LIKES AS (SELECT VIDEO_ID, COUNT(*) AS LIKES \
		FROM VIDEOS_LIKES VL \
		INNER JOIN VIDEOS V \
		ON VL.VIDEO_ID = V.ID \
		INNER JOIN ALBUMS A \
		ON A.ID = V.ALBUM_ID \
		WHERE A.ID = "+albumid+" \
		GROUP BY VIDEO_ID), \
		PICS AS (SELECT P.ID, PL.LIKES, to_char(P.PIC_DATE, 'MM/DD/YYYY') AS PIC_DATE, P.TAGLINE, P.URL, 'Photo' AS CONTENT_TYPE \
		FROM PHOTOS P \
		LEFT OUTER JOIN \
		PIC_LIKES PL \
		ON PL.PHOTO_ID = P.ID \
		WHERE P.ALBUM_ID = "+albumid+" \
		ORDER BY P.PIC_DATE DESC), \
		VIDS AS ( \
		SELECT V.ID, VL.LIKES, to_char(V.VIDEO_DATE, 'MM/DD/YYYY') AS VIDEO_DATE, V.TAGLINE, V.URL, 'Video' AS CONTENT_TYPE \
		FROM VIDEOS V \
		LEFT OUTER JOIN \
		VID_LIKES VL \
		ON VL.VIDEO_ID = V.ID \
		WHERE V.ALBUM_ID = "+albumid+" \
		ORDER BY V.VIDEO_DATE DESC \
		) \
		SELECT * FROM PICS UNION SELECT * FROM VIDS";
		console.log(query);
		conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		photos = results;
		console.log(photos);
		res.render('album', {title: 'Content', user: req.user, trip: trip, tripid: tripid, photos: photos, albumid: albumid});
	});
	});
});


// view a photo
router.get('/photo', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var album;
	var photos;
	var comment;
	var photoData;
	var photoid = req.query.photoid;
	var albumid = req.query.albumid;
	var tripid = req.query.tripid;
	console.log(photoid);
	console.log(albumid);
	console.log(tripid);
	query = "SELECT A.NAME, A.ID, A.PRIVACY FROM ALBUMS A WHERE A.TRIP_ID="+tripid+"AND A.ID = "+albumid;
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		album = results;
		console.log(album);
		query = "WITH LIKE_COUNT AS ( \
			SELECT PHOTO_ID, COUNT(*) AS LIKE_COUNT \
			FROM PHOTOS_LIKES \
			WHERE PHOTO_ID = "+photoid+" \
			GROUP BY PHOTO_ID), \
			STATUS AS ( \
			SELECT PHOTO_ID, 'LIKED' AS STATUS \
			FROM PHOTOS_LIKES PL \
			WHERE PHOTO_ID = "+photoid+" AND USER_ID = "+userid+"), \
			PIC AS ( \
			SELECT P.ID, P.URL \
			FROM PHOTOS P \
			WHERE P.ID = "+photoid+" ) \
			SELECT P.ID, P.URL, LC.LIKE_COUNT, S.STATUS \
			FROM PIC P \
			LEFT OUTER JOIN LIKE_COUNT LC \
			ON P.ID = LC.PHOTO_ID \
			LEFT OUTER JOIN STATUS S \
			ON LC.PHOTO_ID = S.PHOTO_ID";
		console.log(query);
		conn.execute(query, [], function(err, results) {
			if(err) {
				console.log('Error executing query: ', err);
				res.send('There was a problem querying the databases');
				//TODO: delete from stormpath also!
				return;
			}
			photos = results;
			console.log(photos);
			//Needs to talk to cache here
			//Right now, photo clicks are not being counted, every pic is being cached in binary format
			//When reuqested for, the binary data is being converted to base64 data is being served
			//Once the basic photo display works, we need to send jpg/fig/png in addition to base64 data
			fname = photos[0].ID+'.txt';
			GridStore.exist(mongodb_conn,fname,function(err,result){
				assert.equal(null, err);
				if(result == true){
					console.log('The file exists');
					GridStore.read(mongodb_conn, fname, function(err,fileData){
						photoData = fileData.toString('base64');
						//console.log(photoData);
					});
					//router.use(express.static('/Users/sibiv/Downloads/'));
				}else{
					console.log('The file doesnt exist');
					var gridStore = new GridStore(mongodb_conn,fname,'w');
					gridStore.open(function(err,gridStore){
						assert.equal(null, err);
						requestdb(photos[0].URL, function (error, response, body) {
					    	var image = new Buffer(body, 'binary');
					    	photoData = image.toString('base64');
					    	//console.log(photoData);
						    // Write some data to the file
						    gridStore.write(image, function(err, gridStore) {
						      	assert.equal(null, err);
						      	// Close (Flushes the data to MongoDB)
						      	gridStore.close(function(err, result) {
						        	assert.equal(null, err);
						        });
						    });
						});
					});
				}
			});

			query = "SELECT PC.PHOTO_ID, U.FIRST_NAME, U.LAST_NAME, U.ID, PC.PHOTO_COMMENT, to_char(PC.COMMENT_DATE, 'MM/DD/YYYY') AS COMMENT_DATE FROM PHOTOS_COMMENTS PC \
				INNER JOIN USERS U \
				ON U.ID = PC.COMMENTER_ID \
				WHERE PC.PHOTO_ID = "+photoid+" \
				ORDER BY PC.COMMENT_DATE DESC";
			console.log(query);
			conn.execute(query, [], function(err, results) {
				if(err) {
					console.log('Error executing query: ', err);
					res.send('There was a problem querying the databases');
					//TODO: delete from stormpath also!
					return;
				}
				comment = results;
				console.log(comment);
				res.render('photo', {title: 'Photo', user: req.user, album: album, photos: photos, tripid: tripid, comments: comment, photoData: photoData});
			});
		});
	});
});

router.post('/addcomment', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var tripid = req.query.tripid;
	var albumid = req.query.albumid;
	var photoid = req.query.photoid;
	var comment = req.body.comment;
	console.log(comment);
	query = "INSERT INTO PHOTOS_COMMENTS VALUES ("+photoid+", '"+comment+"', "+userid+", sysdate)";
	console.log(query);
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		res.redirect('/photo?tripid='+tripid+'&albumid='+albumid+'&photoid='+photoid);
	});
});

// post a like
router.get('/like', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var tripid = req.query.tripid;
	var albumid = req.query.albumid;
	var photoid = req.query.photoid;
	query = "INSERT INTO PHOTOS_LIKES VALUES ("+userid+", "+photoid+")";
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		res.redirect('/photo?tripid='+tripid+'&albumid='+albumid+'&photoid='+photoid);
	});
});

// page for creating a new album
router.get('/newalbum', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var tripid = req.query.tripid;
	var trip;
	query = "SELECT NAME, to_char(START_DATE, 'MM/DD/YYYY') AS START_DATE, OWNER FROM TRIPS WHERE ID="+tripid;
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		trip = results;
		res.render('newalbum', {title: 'New Album', user: req.user, tripid:tripid, trip: trip});
});
});


// create a new album
router.post('/createalbum', function(req, res) {
	var tripid = req.query.tripid;
	var albumname = req.body.albumname;
	var privacy = req.body.privacy=='public'?1:0;
	console.log(tripid + " " + albumname + " " + privacy);
	query = "INSERT INTO ALBUMS VALUES(ALBUMID_SEQ.nextval, "+tripid+", '"+albumname+"', "+privacy+")";
	console.log(query);
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		res.redirect('/albums?tripid='+tripid);
	});
});

// give options for adding a new photo
router.get('/newphoto', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var tripid = req.query.tripid;
	var albumid = req.query.albumid;
	var album;
	query = "SELECT A.NAME, A.ID, A.PRIVACY FROM ALBUMS A WHERE A.TRIP_ID="+tripid+"AND A.ID = "+albumid;
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		album = results;
	res.render('newphoto', {title: 'New Photo', user: req.user, album:album, tripid: tripid});
});
});

// add photo to database
router.post('/addphoto', function(req, res) {
	if(!req.user || req.user.status !== 'ENABLED') {
		error = 'Error: User not logged in!';
		res.redirect('/');
	}
	var tripid = req.query.tripid;
	var albumid = req.query.albumid;
	var photourl = req.body.photourl;
	var phototagline = req.body.phototagline;
	var photoprivacy = req.body.photoprivacy=='public'?1:0;
	query = "INSERT INTO PHOTOS VALUES (PHOTOID_SEQ.nextval, "+albumid+", '"+phototagline+"', "+photoprivacy+", sysdate, '"+photourl+"')";
	console.log(query);
	conn.execute(query, [], function(err, results) {
		if(err) {
			console.log('Error executing query: ', err);
			res.send('There was a problem querying the databases');
			//TODO: delete from stormpath also!
			return;
		}
		res.redirect('/album?tripid='+tripid+'&albumid='+albumid);
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
