#!/bin/bash

CLASSPATH="" java -cp "bin/:lib/*:book-nlp/book-nlp.jar:book-nlp/lib/*" \
    edu/endicott/cs/wei/BookNLPServer
