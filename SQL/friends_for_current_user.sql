SELECT U.ID, U.USERNAME, U.FIRST_NAME, U.EMAIL, F.STATUS AS STATUS
FROM FRIENDS F, USERS U
WHERE
F.STATUS = 'Accepted' AND
((F.USER_ID1 = U.ID AND F.USER_ID2 = 1001) /*Replace number with current users user id*/
OR (F.USER_ID2 = U.ID AND F.USER_ID1 = 1001)) /*Replace number with current users user id*/