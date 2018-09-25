#!/bin/bash

sep=":"

if [ -d "/c/" ] || [ -d "C:" ]; then 
  sep=";"
fi

CLASSPATH="" java -cp "bin/${sep}lib/*${sep}book-nlp/book-nlp.jar${sep}book-nlp/lib/*" \
    edu/endicott/cs/wei/BookNLPServer $@
