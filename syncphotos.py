#! /usr/bin/python3

import dropbox

# constants
SRC_PATH = '/Photos/wallcalendar/'
DST_PATH = '/var/www/html/images/'

# setup the account information
dbx = dropbox.Dropbox("dQdA-EOc6jAAAAAAAAEAmw8IyHEi8Z2VbqZrFZxZtlcWzcbEPVP5IDRMrsB43HP0")

# list the files in our target folder
for entry in dbx.files_list_folder(SRC_PATH).entries:
    # TODO: Do we already have this file?
    with open(DST_PATH + entry.name, 'wb') as f:
        _, res = dbx.files_get_thumbnail(SRC_PATH + entry.name, dropbox.files.ThumbnailFormat('jpeg'), size=dropbox.files.ThumbnailSize('w2049h1536'), mode=dropbox.files.ThumbnailMode('strict'))
        f.write(res.content)


# for each file found, grab the thumbnail
