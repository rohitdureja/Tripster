SELECT V.ID AS VIDEO_ID, V.LIKES, V.VIDEO_DATE, V.TAGLINE, V.URL
FROM VIDEOS V
WHERE V.ALBUM_ID = 32