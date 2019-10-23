#! /bin/bash

# read in the parameters from our environment file
# NOTE: the URIs provided are what Google gives you for a private/shared ICS file. The file looks something like:
# FAMILY_CALENDAR_URI=https://calendar.google.com/calendar/ical/blah>/private-<blah>/basic.ics
# MEALS_CALENDAR_URI=https://calendar.google.com/calendar/ical/blah>/private-<blah>/basic.ics
source env.sh

wget ${FAMILY_CALENDAR_URI} -O /var/www/html/family.ics
wget ${MEALS_CALENDAR_URI} -O /var/www/html/meals.ics
