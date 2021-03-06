#!/bin/bash

defaultConfig="-s config/settings.jsonc"
sep=":"

for arg in $@; do 
    if [ "$arg" == "-s" ]; then
        defaultConfig=""
    fi
done

if [ -d "/c/" ] || [ -d "C:" ]; then 
    sep=";"
fi

CLASSPATH="" java -cp "bin/${sep}lib/*${sep}book-nlp/book-nlp.jar${sep}book-nlp/lib/*" \
    edu/endicott/cs/entities/EntiTiesDispatcher $defaultConfig $@
