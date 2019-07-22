# When Entities Interact

Eventually, this will be a web application for annotating interactions between
entities in text in a semi-automated way. For example, you can use it to
extract a social network from a novel in which characters are nodes and edges
indicate how often two characters speak to each other throughout the novel.

Currently, only the character extraction is supported. The interface allows
the user to upload a text for processing, then displays the characters with
alias groups (all the different ways a character is mentioned). The user can
then alter the groups by splitting, merging, and deleting alias groups. Each
alias group will make up a node in the final social network (the extraction of
which has yet to be implemented).

# Installing

Clone this directory onto a webserver that has PHP 5.5+ and Java JDK 1.8 or
higher installed. 

Copy `conf-EXAMPLE.json` to `conf.json` and edit it. Note that you can must
choose where to store original texts (must be writable by the apache user) and
what database to use to store metadata. Any database that can be used with PHP
Data Objects is okay to use.

Install https://github.com/dbamman/book-nlp with the supporting models. Copy or
symlink the `book-nlp` directory to the `when-entities-interact` directory
(`book-nlp` should be a subdirectory).

Make a copy or simlink to the `book-nlp/files/` directory in the 
`when-entities-interact` directory.

Download remaining dependencies and compile the Java side of things by running:

    ./make.sh




# Development

To start up a development server, use the built in PHP server. From the
`web/` directory, enter:

    php -S localhost:3535 routes.php

Then open a browser and go to: http://localhost:3535. You can change the port
number to something other than 3535 if you wish.






