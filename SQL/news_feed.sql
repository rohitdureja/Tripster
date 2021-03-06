/*Current users friends*/
WITH CURRENT_USERS_FRIENDS AS (
SELECT U.ID AS USER_ID, U.USERNAME AS USERNAME, U.FIRST_NAME AS FIRST_NAME, U.EMAIL AS EMAIL, F.STATUS AS STATUS
FROM FRIENDS F, USERS U
WHERE
F.STATUS = 'Accepted' AND
((F.USER_ID1 = U.ID AND F.USER_ID2 = 1000) /*Replace number with current users user id*/
OR (F.USER_ID2 = U.ID AND F.USER_ID1 = 1000)) /*Replace number with current users user id*/
),

/*Likes of the photos */
PIC_LIKES AS (SELECT PHOTO_ID, COUNT(*) AS LIKES
FROM PHOTOS_LIKES PL 
GROUP BY PHOTO_ID),

VID_LIKES AS (SELECT VIDEO_ID, COUNT(*) AS LIKES
FROM VIDEOS_LIKES VL
GROUP BY VIDEO_ID),

VIDS AS (
SELECT V.ID AS ID, VL.LIKES AS LIKES, V.VIDEO_DATE AS CONTENT_DATE, V.TAGLINE AS TAGLINE, A.NAME AS ALBUM_NAME, T.NAME AS TRIP_NAME, V.URL AS CONTENT_URL, 'Video' AS CONTENT_TYPE, LISTAGG(CUF.FIRST_NAME, ', ') WITHIN GROUP (ORDER BY V.ID) AS NAMES
FROM VIDEOS V
INNER JOIN ALBUMS A
ON V.ALBUM_ID = A.ID
INNER JOIN TRIPS T
ON T.ID = A.TRIP_ID
INNER JOIN TRIPS_USERS TU
ON TU.TRIP_ID = T.ID
INNER JOIN CURRENT_USERS_FRIENDS CUF
ON CUF.USER_ID = TU.USER_ID
LEFT OUTER JOIN
VID_LIKES VL
ON VL.VIDEO_ID = V.ID
WHERE V.PRIVACY = 1 AND
A.PRIVACY = 1 AND
T.PRIVACY = 1
GROUP BY V.ID, VL.LIKES, V.VIDEO_DATE, V.TAGLINE, A.NAME, T.NAME, V.URL
ORDER BY V.VIDEO_DATE DESC),


PICS AS (
SELECT P.ID AS ID, PL.LIKES AS LIKES, P.PIC_DATE AS CONTENT_DATE, P.TAGLINE AS TAGLINE, A.NAME AS ALBUM_NAME, T.NAME AS TRIP_NAME, P.URL AS CONTENT_URL, 'Photo' AS CONTENT_TYPE, LISTAGG(CUF.FIRST_NAME, ', ') WITHIN GROUP (ORDER BY P.ID) AS NAMES
FROM PHOTOS P
INNER JOIN ALBUMS A
ON P.ALBUM_ID = A.ID
INNER JOIN TRIPS T
ON T.ID = A.TRIP_ID
INNER JOIN TRIPS_USERS TU
ON TU.TRIP_ID = T.ID
INNER JOIN CURRENT_USERS_FRIENDS CUF
ON CUF.USER_ID = TU.USER_ID
LEFT OUTER JOIN
PIC_LIKES PL
ON PL.PHOTO_ID = P.ID
WHERE P.PRIVACY = 1 AND
A.PRIVACY = 1 AND
T.PRIVACY = 1
GROUP BY P.ID, PL.LIKES, P.PIC_DATE, P.TAGLINE, A.NAME, T.NAME, P.URL
ORDER BY P.PIC_DATE DESC)


SELECT ID, LIKES, CONTENT_DATE, TAGLINE, ALBUM_NAME, TRIP_NAME, CONTENT_URL, CONTENT_TYPE, NAMES
FROM PICS 
UNION 
SELECT ID, LIKES, CONTENT_DATE, TAGLINE, ALBUM_NAME, TRIP_NAME, CONTENT_URL, CONTENT_TYPE, NAMES
FROM VIDS
ORDER BY CONTENT_DATE DESC;


