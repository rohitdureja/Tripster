#!/bin/bash

rlwrap sqlplus 'tripsteradmin@(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=tripster.cx4nlyh3nrji.us-west-2.rds.amazonaws.com)(PORT=1521))(CONNECT_DATA=(SID=ORCL)))'
