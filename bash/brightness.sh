#!/bin/bash

# get info from xrandr
connectedOutputs=$(xrandr | grep " connected" | sed -e "s/\([A-Z0-9]\+\) connected.*/\1/")

# initialize variables
execute="/usr/bin/xrandr"
brightness=$1

for display in $connectedOutputs
do
	eval $execute" --output $display --brightness $brightness"
done
