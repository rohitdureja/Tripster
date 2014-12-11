WITH PICS AS (SELECT P.ID, P.LIKES, P.PIC_DATE, P.TAGLINE, P.URL, 'Photo' AS CONTENT_TYPE
FROM PHOTOS P
WHERE P.ALBUM_ID = 103
ORDER BY P.PIC_DATE DESC),
VIDS AS (
SELECT V.ID, V.LIKES, V.VIDEO_DATE, V.TAGLINE, V.URL, 'Video' AS CONTENT_TYPE
FROM VIDEOS V
WHERE V.ALBUM_ID = 103
ORDER BY V.VIDEO_DATE DESC
)
SELECT * FROM PICS UNION SELECT * FROM VIDS;

/*With likes from photos_likes table*/

WITH PIC_LIKES AS (SELECT PHOTO_ID, COUNT(*) AS LIKES
FROM PHOTOS_LIKES PL 
INNER JOIN PHOTOS P  
ON PL.PHOTO_ID = P.ID
INNER JOIN ALBUMS A
ON A.ID = P.ALBUM_ID
WHERE A.ID = 103
GROUP BY PHOTO_ID),

VID_LIKES AS (SELECT VIDEO_ID, COUNT(*) AS LIKES
FROM VIDEOS_LIKES VL
INNER JOIN VIDEOS V  
ON VL.VIDEO_ID = V.ID
INNER JOIN ALBUMS A
ON A.ID = V.ALBUM_ID
WHERE A.ID = 103
GROUP BY VIDEO_ID),

PICS AS (SELECT P.ID, PL.LIKES, P.PIC_DATE, P.TAGLINE, P.URL, 'Photo' AS CONTENT_TYPE
FROM PHOTOS P
LEFT OUTER JOIN
PIC_LIKES PL
ON PL.PHOTO_ID = P.ID
WHERE P.ALBUM_ID = 103
ORDER BY P.PIC_DATE DESC),

VIDS AS (
SELECT V.ID, VL.LIKES, V.VIDEO_DATE, V.TAGLINE, V.URL, 'Video' AS CONTENT_TYPE
FROM VIDEOS V
LEFT OUTER JOIN
VID_LIKES VL
ON VL.VIDEO_ID = V.ID

WHERE V.ALBUM_ID = 103
ORDER BY V.VIDEO_DATE DESC
)
SELECT * FROM PICS UNION SELECT * FROM VIDS;
