#!/bin/bash

mkdir -p bin lib

if [ ! -f "lib/sqlite-jdbc-3.23.1.jar" ] || [ ! -f "lib/mysql-connector-java-8.0.12.jar" ]; then
    cd lib
    curl http://central.maven.org/maven2/org/xerial/sqlite-jdbc/3.23.1/sqlite-jdbc-3.23.1.jar -O
    curl http://central.maven.org/maven2/mysql/mysql-connector-java/8.0.12/mysql-connector-java-8.0.12.jar -O
    cd ..
fi


sourceFiles=$(find src/main/java -name *.java)

sep=":"

if [ -d "/c/" ] || [ -d "C:" ]; then 
  sep=";"
fi

echo "CLASSPATH=\"\" javac -cp \"lib/*${sep}book-nlp/book-nlp.jar${sep}book-nlp/lib/*\" -d bin/ $sourceFiles"

CLASSPATH="" javac -cp "lib/*${sep}book-nlp/book-nlp.jar${sep}book-nlp/lib/*" \
    -d bin/ $sourceFiles
