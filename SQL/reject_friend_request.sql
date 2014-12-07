/*1st id : user for which request is rejected, 2nd id is for current user*/
UPDATE FRIENDS F
SET F.STATUS = 'Rejected'
WHERE F.USER_ID1 = 1001 AND F.USER_ID2 = 1000;