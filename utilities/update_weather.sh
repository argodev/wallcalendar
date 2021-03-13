#! /bin/bash

# read in the parameters from our environment file
source env.sh
source utils.sh

URL="https://api.openweathermap.org/data/2.5/onecall?lat=${MY_LAT}&lon=${MY_LON}&units=imperial&exclude=minutely,hourly&appid=${OWM_KEY}"

safe_get_replace_file ${URL} ../webapp/current_weather.json
