SELECT *
FROM FRIENDS F
INNER JOIN USERS U 
ON F.USER_ID2 = U.ID 
WHERE F.USER_ID1 = 3
