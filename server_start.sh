#!/bin/bash
source .env

./iptable_setup.sh

sudo service mongodb start

nodemon
