UPDATE TRIPS_USERS TU
SET TU.STATUS = 'Pending'
WHERE TU.USER_ID = 'ID OF USER TO WHOM REQUEST IS SENT'
AND TU.USER_ID_REQUEST = 'ID OF the sender of the request'
AND TU.TRIP_ID = 'ID of the trip';