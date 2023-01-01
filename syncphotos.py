#! /usr/bin/python3

import time
import json
import logging
import dropbox
import os
from os.path import exists

# constants
SRC_PATH = '/Photos/_wallcalendar/'
DST_PATH = 'webapp/images/'


def get_thumbs():
    # setup the account information
    logging.info("Connecting to Dropbox...")
    dbx = dropbox.Dropbox("dQdA-EOc6jAAAAAAAAEAmw8IyHEi8Z2VbqZrFZxZtlcWzcbEPVP5IDRMrsB43HP0")
    imagedata = []

    # list the files in our target folder
    logging.info(f"Enumerating files in {SRC_PATH}")
    for entry in dbx.files_list_folder(SRC_PATH).entries:
        if not exists(os.path.join(DST_PATH, entry.name)):
            logging.info(f"File not found locally, retreiving {entry.name}")
            with open(DST_PATH + entry.name, 'wb') as f:
                _, res = dbx.files_get_thumbnail(SRC_PATH + entry.name, 
                                                 dropbox.files.ThumbnailFormat('jpeg'), 
                                                 size=dropbox.files.ThumbnailSize('w960h640'),
                                                 mode=dropbox.files.ThumbnailMode('strict'))
                f.write(res.content)
        # add to list
        imagedata.append(f"images/{entry.name}")
    
    # update html/whatever with new list???
    data = {"images": imagedata }
    with open('webapp/imagedata.json', 'w') as outfile:
        json.dump(data, outfile)


def main():
    log_format = '[%(asctime)s] %(levelname)s %(message)s'
    logging.basicConfig(format=log_format, level=logging.INFO)
    logging.info('** Family Calendar Photo Sync System Starting **')
    start_time = time.time()

    get_thumbs()

    logging.info("Script Finished")
    logging.info("Elapsed Time: %s seconds ", (time.time() - start_time))

if __name__ == "__main__":
    main()