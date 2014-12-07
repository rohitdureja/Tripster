export OCI_HOME=/Applications/oracle/instantclient_11_2
export OCI_LIB_DIR=$OCI_HOME
export OCI_INCLUDE_DIR=$OCI_HOME/sdk/include
export OCI_VERSION=11
export NLS_LANG=AMERICAN_AMERICA.UTF8

VAR=$(pwd)

cd $OCI_LIB_DIR
ln -s libclntsh.dylib.11.1 libclntsh.dylib
ln -s libocci.dylib.11.1 libocci.dylib

cd $VAR
npm install oracle
