#!/bin/bash

sleep 4

INSTALLATION_CONFIG=~/.VenindoConfigured

if [ -f $INSTALLATION_CONFIG ]; then
	. $INSTALLATION_CONFIG
	directory=$DIR
else
	directory=/home/$USER/Documents/ventilator-device
fi

bootfile=$directory/config/logs/.boot

FILE_CONFIG=$directory/config/app.config.js
APP_CONFIG=$(cat $FILE_CONFIG)

IP_MODBUS=$(echo $APP_CONFIG | grep -oP "ip[\s\:]+[\'\"](\d*\.\d*\.\d*\.\d*)[\'\"]" | grep -oP "\d*\.\d*\.\d*\.\d*")

if ls -l /dev/serial/by-id > /dev/null; then
	echo "SERIAL PORT AVAILABLE"

	DEV_SERIAL_PATH="/dev/serial/by-id"
	COM_PORT=$(echo $APP_CONFIG | grep -oP "port[\s\:]+[\'\"](.*?)[\'\"]" | sed -rn "s#port##p" | tr -d "\'\"[:space:]\:")
	AVAILABLE_PORT=${DEV_SERIAL_PATH}"/"$(ls ${DEV_SERIAL_PATH} | grep -P "FTDI" | tail -1)

	if [[ ! -c $COM_PORT ]]; then
		echo "PORT [$COM_PORT] DOESNT EXIST"
		sed -i "s#$COM_PORT#$AVAILABLE_PORT#g" $FILE_CONFIG
	fi
else
	echo "NO SERIAL PORT AVAILABLE"
fi

if [[ ! -z $IP_MODBUS ]]; then
	NMAP=$(nmap -sn $IP_MODBUS | grep -oi "Host is up")
	if [[ ! -z $NMAP ]]; then
		echo $IP_MODBUS" IS VALID IP"
	else
		echo $IP_MODBUS" IS INVALID. Trying to find valid IP from 120-135"
		IP_CLASS=$(echo $IP_MODBUS | grep -oP "\d*\.\d*\.\d*\.")
		CORRECT_IP=$(nmap -sn ${IP_CLASS}120-135 | grep -oP "$IP_CLASS\d*" | tail -1)
		sed -i "s#$IP_MODBUS#$CORRECT_IP#g" $FILE_CONFIG
	fi
else
	IP_CLASS="192.168.88."
	CORRECT_IP=$(nmap -sn ${IP_CLASS}120-135 | grep -oP "$IP_CLASS\d*" | tail -1)
	while [[ -z $CORRECT_IP ]]; do
		sleep 1
		CORRECT_IP=$(nmap -sn ${IP_CLASS}120-135 | grep -oP "$IP_CLASS\d*" | tail -1)
	done
	sed -ri "s#ip[[:space:]]+\:[[:space:]]+[\'\"]+#ip\ \:\ \'$CORRECT_IP\'#g" $FILE_CONFIG
fi

#change directory
cd $directory

# create .boot file as a flag system starts from first boot
echo "1" > "$bootfile"

#start app
npm start
