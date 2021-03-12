#! /bin/bash

# read in the parameters from our environment file
# go to this page: https://www.wunderground.com/maps/radar/current/usa
# and then select the region you are interested in from the drop-down
# list. In my case, the "KY - Bowling Green" option was best. Once the
# screen refreshes, note the location ID at the end of the URL. Again, in
# my case, this was "bwg". This will then be the ID that should be used
# to populate the WUG_RADAR_REGION environment variable used below.
source env.sh


#!/bin/bash
# simple script to pull down the collection of calendars (*.ics files)
# that we use to support our family wall calendar

# need to write a function that handles the following:
function get_radar_image {
  echo "Retreiving radar for ${1}..."
  tmpfile=$(mktemp)
  echo "Storing in ${tmpfile}"
  target="../webapp/radar.png"

  # download the file
  wget https://s.w-x.co/staticmaps/wu/wxtype/county_loc/${1}/animate.png -O ${tmpfile}

  # if the file is not empty, move it
  if [[ -s ${tmpfile} ]];
  then
    echo "Download Successful. Deploying File..."
    chmod +r ${tmpfile}
    mv -f ${target} ${target}.bak;
    mv -f ${tmpfile} ${target};
  fi
}

get_radar_image ${WUG_RADAR_REGION}

