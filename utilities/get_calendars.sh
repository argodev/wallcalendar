#!/bin/bash
# simple script to pull down the collection of calendars (*.ics files) that we use to support our family wall calendar

# read in the parameters from our environment file
source env.sh

# little helper function:
# - takes path to calendar
# - takes output path to calendar
# - downloads file to temp location
# - if, and only if, the file download is successful (non-0 byte length), 
#   replace the current "production" ICS file
function get_calendar {
	echo "Retreiving ${1}..."
	tmpfile=$(mktemp)
	echo "Storing in ${tmpfile}"
	target="${CALENDAR_OUT_DIR}${1}.ics"

	# download the file
	wget ${2} -O ${tmpfile}

	# if the file is not empty, move it
	if [[ -s ${tmpfile} ]]; 
	then
		echo "Download Successful. Deploying File..."
		chmod +r ${tmpfile}
		mv -f ${target} ${target}.bak;
		mv -f ${tmpfile} ${target};
	fi
}

# Get our main family calendar
get_calendar "family" ${FAMILY_CALENDAR_URI}

# Get our "meals" calendar
get_calendar "meals" ${MEALS_CALENDAR_URI}

# Get the general holidays calendar
get_calendar "holidays" ${HOLIDAYS_CALENDAR_URI}

# Get our school calendar
get_calendar "hva" ${SCHOOL_CALENDAR_URI}
