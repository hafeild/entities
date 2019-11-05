#!/bin/bash

sep=":"

for arg in $@; do 
    if [ "$arg" == "-s" ]; then
        defaultConfig=""
    fi
done

if [ -d "/c/" ] || [ -d "C:" ]; then 
    sep=";"
fi

class=$1; shift

CLASSPATH="" java -cp "bin/${sep}lib/*${sep}book-nlp/book-nlp.jar${sep}book-nlp/lib/*" \
    edu/endicott/cs/entities/$class $@
