export OCI_HOME=~/oracle/instantclient_11_2
export OCI_LIB_DIR=$OCI_HOME
export OCI_INCLUDE_DIR=$OCI_HOME/sdk/include
export OCI_VERSION=11
export NLS_LANG=AMERICAN_AMERICA.UTF8

VAR=$(pwd)

cd $OCI_LIB_DIR
ln -s libclntsh.so.11.1 libclntsh.so
ln -s libocci.so.11.1 libocci.so

sudo apt-get install libaio1

echo '/home/ubuntu/oracle/instantclient_11_2' | sudo tee -a /etc/ld.so.conf.d/oracle_instant_client.conf
sudo ldconfig

cd $VAR
npm install oracle
