#! /bin/bash

# first param should be the URL to query
# second param should be the target file
function safe_get_replace_file {
  #echo "URL: ${1}"
  #echo "FILE: ${2}"
  echo "Trying to update file ${2}..."
  tmpfile=$(mktemp)
  echo "Storing in ${tmpfile}"

  # download the file
  wget ${1} -O ${tmpfile}

  # if the file is not empty, move it
  if [[ -s ${tmpfile} ]];
  then
    echo "Download Successful. Deploying File..."
    chmod +r ${tmpfile}
    mv -f ${2} ${2}.bak;
    mv -f ${tmpfile} ${2};
  fi
}