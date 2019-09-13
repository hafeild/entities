# EntiTies

Eventually, this will be a web application for annotating relationships between
entities in text in a semi-automated way. For example, you can use it to
extract a social network from a novel in which characters are nodes and edges
indicate how often two characters speak to each other throughout the novel.

Currently, only the character extraction is supported. The interface allows
the user to upload a text for processing, then displays the characters with
alias groups (all the different ways a character is mentioned). The user can
then alter the groups by splitting, merging, and deleting alias groups. Each
alias group will make up a node in the final social network (the extraction of
which has yet to be implemented).

# Installing and running

## Step 1. 
Clone this directory onto a webserver that has PHP 5.5+ and Java JDK 8 or
higher installed. 

## Step 2. 
Copy `conf-EXAMPLE.json` to `conf.json` and edit it. Note that you can must
choose where to store original texts (must be writable by the apache user) and
what database to use to store metadata. Any database that can be used with PHP
Data Objects is okay to use.

## Step 3.
Install https://github.com/dbamman/book-nlp with the supporting models in the
`entities` directory:

    git clone https://github.com/dbamman/book-nlp

    ## As per the BookNLP README, acquire and install the models:
    cd book-nlp
    curl https://nlp.stanford.edu/software/stanford-corenlp-full-2017-06-09.zip -O
    unzip stanford-corenlp-full-2017-06-09.zip
    mv stanford-corenlp-full-2017-06-09/stanford-corenlp-3.8.0-models.jar lib/
    cd ..
    

## Step 4. 
Make a copy or symlink to the `book-nlp/files/` directory in the 
`entities` directory. E.g.,

    ln -s book-nlp/files .

## Step 5.
Download remaining dependencies and compile the Java side of things by running:

    ./make.sh

## Step 6.
Start the BookNLPServer by running the `run-java-server.sh` script:

    ./run-java-server.sh

# Development

To start up a development server, go into the `web` directory and use the built 
in PHP server. 

    cd web/
    php -S localhost:3535 routes.php

Then open a browser and go to: http://localhost:3535. You can change the port
number to something other than 3535 if you wish.


# Annotation storage format

Annotations are stored in JSON organized as follows:

```
{
    ## These are the distinct entities prior to co-reference resolution (so
    ## Peter Pan, Peter, and Pan are each an entity). It is not required that
    ## an entity have any corresponding location.
    entities: {
        id: {
            name: "",
            group_id: ""
        }
    }

    ## Each group is a set of entities that refer to the same canonical entity.
    ## E.g., Peter Pan, Peter, and Pan might all belong to the same group.
    groups: {
        id: {
            name: ""
        }
    }

    ## These are the locations where entities (not groups) are mentioned.
    locations: {
        id: {
            start: 0,
            end: 0,
            entity_id: ""
        }
    }
    
    ## These describe relationships or edges between two entities (not groups).
    ## Ideally, these are marked in the text (start and end) and involve two
    ## entity locations. However, an explicit location in the text is not
    ## required.
    ties: {
        id: {
            start: 0, // optional
            end: 0, // optional
            source_entity: {
                // ONE of the following two.
                location_id: ""
                entity_id: ""
            },
            target_entity: {
                // ONE of the following two.
                location_id: ""
                entity_id: ""
            },
            label: "",
            weight: 0.0, // optional; default 1.0
            directed: false  // optional; default: false
        }
    }
}
```


