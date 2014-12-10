UPDATE TRIPS_USERS TU
SET TU.STATUS = 'Rejected'
WHERE TU.USER_ID = 1 AND TU.TRIP_ID = 1; /*user accepting the request*/