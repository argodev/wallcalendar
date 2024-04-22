#! /bin/bash

# read in the parameters from our environment file
source env.sh
source utils.sh

# use to get hyper-local weather
tmpfile=$(mktemp)
echo "Storing in ${tmpfile}"
curl -G "${HL_URL}" -u ${HL_CREDS} --data-urlencode "db=homeassistant" --data-urlencode "q=SELECT \"value\" FROM \"sensor.creekside_manor_temp\" GROUP BY * ORDER BY DESC LIMIT 1" > ${tmpfile}
safe_replace_file ${tmpfile} ./local_weather.json
cat ./local_weather.json