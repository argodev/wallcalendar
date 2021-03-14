#! /bin/bash

# read in the parameters from our environment file
source env.sh
source utils.sh

URL="https://api.openweathermap.org/data/2.5/onecall?lat=${MY_LAT}&lon=${MY_LON}&units=imperial&exclude=minutely,hourly&appid=${OWM_KEY}"

safe_get_replace_file ${URL} ../webapp/current_weather.json


# use to get hyper-local weather
tmpfile=$(mktemp)
echo "Storing in ${tmpfile}"
curl -G "${HL_URL}" -u ${HL_CREDS} --data-urlencode "db=homedb" --data-urlencode "q=SELECT \"outside_temp\" FROM \"local_weather\" GROUP BY * ORDER BY DESC LIMIT 1" > ${tmpfile}
safe_replace_file ${tmpfile} ../webapp/local_weather.json
