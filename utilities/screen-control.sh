#!/bin/bash
#
# NOTE: screen-control.log will grow, consider disabling the output or delete it periodically
#

echo `date` "Called with $1" >> ~/screen-control.log

STATE=`vcgencmd display_power`

if [ ! -z "$1" ] && [ $1 = "toggle" ]; then

  echo `date` "Toggling screen."
  echo `date` "Toggling screen." >> ~/screen-control.log

  if [[ $STATE == *"TV is off"* ]]; then

    echo `date` "Screen is off, turning on."
    echo `date` "Screen is off, turning on." >> ~/screen-control.log
    vcgencmd display_power 1
  else

    echo `date` "Screen is on, turning off."
    echo `date` "Screen is on, turning off." >> ~/screen-control.log
    vcgencmd display_power 0
  fi

  # BUG: Not sure why, but if screen is on, and a toggle is triggered, context menu sometimes appears.
  # The Escape key is the windows left key and will hide the context menu.
  export DISPLAY=:0.0

elif [ ! -z "$1" ] && [ $1 = "on" ]; then

  if [[ $STATE == *"TV is off"* ]]; then

    echo `date` "Screen is off, turning on."
    echo `date` "Screen is off, turning on." >> ~/screen-control.log
    vcgencmd display_power 1
  else

    echo `date` "Screen is on, doing nothing."
    echo `date` "Screen is on, doing nothing." >> ~/screen-control.log
  fi

  # BUG: Not sure why, but if screen is on, and a toggle is triggered, context menu sometimes appears.
  # The Escape key is the windows left key and will hide the context menu.
  export DISPLAY=:0.0

elif [ ! -z "$1" ] && [ $1 = "off" ]; then

  if [[ $STATE == *"TV is off"* ]]; then

    echo `date` "Screen is off, doing nothing."
    echo `date` "Screen is off, doing nothing." >> ~/screen-control.log
  else
    echo `date` "Screen is on, turning off."
    echo `date` "Screen is on, turning off." >> ~/screen-control.log
    vcgencmd display_power 0
  fi

  # BUG: Not sure why, but if screen is on, and a toggle is triggered, context menu sometimes appears.
  # The Escape key is the windows left key and will hide the context menu.
  export DISPLAY=:0.0

else
  # Print usage
  echo
  vcgencmd display_power
  echo
  echo usage:
  echo $0 on
  echo $0 off
  echo $0 toggle
fi

