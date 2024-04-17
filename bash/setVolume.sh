#!/bin/bash

execute="/usr/bin/amixer"
eval $execute" -c "$1" set "$2" "$3"%"
