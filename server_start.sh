#!/bin/bash
source .env

./iptable_setup.sh

nodemon
