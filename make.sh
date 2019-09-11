#!/bin/bash

mkdir -p bin lib

cd lib
if [ ! -f "sqlite-jdbc-3.23.1.jar" ]; then 
    curl http://central.maven.org/maven2/org/xerial/sqlite-jdbc/3.23.1/sqlite-jdbc-3.23.1.jar -O
fi 

if [ ! -f "mysql-connector-java-8.0.12.jar" ]; then
    curl http://central.maven.org/maven2/mysql/mysql-connector-java/8.0.12/mysql-connector-java-8.0.12.jar -O
fi

if [ ! -f "jaxb-api-2.3.1.jar" ]; then 
    curl https://repo1.maven.org/maven2/javax/xml/bind/jaxb-api/2.3.1/jaxb-api-2.3.1.jar -O
fi 

if [ ! -f "jaxb-core-2.3.0.1.jar" ]; then 
    curl https://repo1.maven.org/maven2/org/glassfish/jaxb/jaxb-core/2.3.0.1/jaxb-core-2.3.0.1.jar -O 
fi

if [ ! -f "jaxb-impl-2.3.0.1.jar" ]; then 
    curl https://repo1.maven.org/maven2/com/sun/xml/bind/jaxb-impl/2.3.0.1/jaxb-impl-2.3.0.1.jar -O
fi 

if [ ! -f "istack-commons-runtime-3.0.8.jar" ]  ; then
    curl https://repo1.maven.org/maven2/com/sun/istack/istack-commons-runtime/3.0.8/istack-commons-runtime-3.0.8.jar -O
fi

if [ ! -f "activation-1.1.1.jar" ]  ; then
    curl https://repo1.maven.org/maven2/javax/activation/activation/1.1.1/activation-1.1.1.jar -O
fi 

cd ..


sourceFiles=$(find src/main/java -name *.java)

sep=":"

if [ -d "/c/" ] || [ -d "C:" ]; then 
  sep=";"
fi

echo "CLASSPATH=\"\" javac -cp \"lib/*${sep}book-nlp/book-nlp.jar${sep}book-nlp/lib/*\" -d bin/ $sourceFiles $@"

CLASSPATH="" javac -cp "lib/*${sep}book-nlp/book-nlp.jar${sep}book-nlp/lib/*" \
    -d bin/ $sourceFiles $@
