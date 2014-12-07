/*
"UPDATE FRIENDS F \
SET F.STATUS = 'Pending' \
WHERE (F.USER_ID1 = "+current_user+" AND F.USER_ID2 = "+requested_user+")" \
OR (F.USER_ID2 = "+current_user+" AND F.USER_ID1 = "+requested_user+")"
*/
UPDATE FRIENDS F
SET F.STATUS = 'Pending'
WHERE (F.USER_ID1 = 1000 AND F.USER_ID2 = 1001)
OR (F.USER_ID2 = 1000 AND F.USER_ID1 = 1001);