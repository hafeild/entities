<?php 
// File:    dump-annotation.php
// Author:  Henry Feild
// Date:    04-Mar-2021
// Purpose: Extracts the annotation entries for each of the given list of 
//          annotation ids. The output is in JSONL; each line is a JSON
//          object with this structure:
//
//          * annotation_id
//          * parent_annotation_id
//          * text_title
//          * text_id
//          * text_md5sum
//          * username (owner)
//          * user_id  (owner)
//          * method
//          * method_metadata
//          * label
//          * created_at
//          * updated_at
//          * is_public
//          * automated_method_in_progress
//          * automated_method_error
//          * annotation:
//            - entities
//               * <entityId>: {name, group_id}
//            - groups
//               * <groupId>: {name}
//            - locations
//               * <locationId>: {start, end, entity_id}
//            - ties
//               * <tieId>: {start, end, 
//                      source_entity: {location_id: "" | entity_id: ""}, 
//                      target_entity: {location_id: "" | entity_id: ""}, 
//                      label, weight, directed}
//


require_once(__DIR__ ."/../web/controllers.php");
require_once(__DIR__ ."/../web/init.php");
require_once(__DIR__ ."/../web/models/model-init.php");
require_once(__DIR__ ."/../web/permissions.php");

class AnnotationFetcher {
    function run($argv){
        // Check arguments.
        if(count($argv) > 1 && $argv[1] == "-h"){
            die("Usage: php dump-annotation.php [-h] [<annotation id> ". 
                "[<annotation id>...]]\n\n". 
                "If one or more annotation ids are proved, dumps all ". 
                "corresponding database entries, in JSONL format.\n\n". 
                "If no arguments are provided, a list of annotation metadata ".
                "is displayed and you can pick which ones to dump.\n\n". 
                "See the 'Purpose' statement at the top of this script for ". 
                "details on the format of the output.\n\n");
        }

        if(count($argv) > 1)
            $annotationIds = array_slice($argv, 1);
        else 
            $annotationIds = $this->getAnnotationIdsFromUser();

        // Grab the annotations from the DB and emit them.
        $this->emitAnnotations($annotationIds);
    }

    /**
     * Displays a list of annotations and reads the user's selection. Display is
     * done to stderr so it is not captured in stdout redirects.
     * 
     * @return The study id selected by the user.
     */
    function getAnnotationIdsFromUser(){
        $annotationsMetadata = $this->getAllAnnotationMetadata();
        $validAnnotationIds = [];
        $this->print_messageln("Please select one or more annotations from below:");
        foreach($annotationsMetadata as $annotationMetadata){
            $validAnnotationIds[''. $annotationMetadata["annotation_id"]] = 1;


            $this->print_messageln("[${annotationMetadata["annotation_id"]}] ".
                    "${annotationMetadata["label"]}\n". 
                "\tText: ${annotationMetadata["text_title"]}\n".
                "\tCreator: ${annotationMetadata["username"]}\n".
                "\tParent annotation: ". 
                    "${annotationMetadata["parent_annotation_id"]}\n".
                "\tMethod: ${annotationMetadata["method"]} ". 
                    "(${annotationMetadata["method_metadata"]})\n".
                "\tCreated at: ${annotationMetadata["created_at"]}\n".
                "\tUpdated at:  ${annotationMetadata["updated_at"]}");
        }

        $invalidSelection = true;
        $selections = [];
        while($invalidSelection){
            $this->print_message("> ");
            $selections = preg_split('/\s+/', trim(fgets(STDIN)));
            
            $invalidSelection = false;
            foreach($selections as $id){
                if(!array_key_exists($id, $validAnnotationIds)){
                    $this->print_messageln("$id isn't a valid id.");
                    $invalidSelection = true;
                    ;
                }
            }
        }

        return $selections;
    }

    /**
     * Gets the annotation records from the database and emits each one as
     * a separate JSON object.
     * 
     * @param ids The ids of the annotations to emit.
     */
    function emitAnnotations($ids){
        foreach($ids as $id){
            $annotation = lookupAnnotation($id);
            echo json_encode($annotation) ."\n";
        }
    }

    /**
     * Returns the metadata of all the annotations from the database.
     */
    function getAllAnnotationMetadata(){
        $dbh = connectToAnnotationDB();

        try{
            $statement = $dbh->prepare(
                "select annotations.id as annotation_id, title as text_title, ".
                "md5sum as text_md5sum, text_id, username, users.id as user_id, ". 
                "parent_annotation_id, method, method_metadata, label, ". 
                "annotations.created_at, annotations.updated_at, ". 
                "annotations.is_public, ". 
                "automated_method_in_progress, automated_method_error, annotation ". 
                "from annotations ".
                "join users on users.id = created_by ". 
                "join texts on text_id = texts.id ");
            $statement->execute();

            $res = $statement->fetchAll(PDO::FETCH_ASSOC);
            
            // Convert annotation value into a PHP array.
            foreach($res as &$row){
                $row["annotation"] = json_decode($row["annotation"], true);
            }
    
            return $res;
        } catch(Exception $e){
            error("Error retrieving annotation: ". $e->getMessage(),
                ["In getAllAnnotationMetadata()"]);
        }
    }

    /**
     * Prints the given message to stderr.
     * 
     * @param message The message to print.
     */
    function print_message($message){
        fwrite(STDERR, $message);
    }

    /**
     * Prints the given message to stderr, and adds a newline to the end.
     * 
     * @param message The message to print.
     */
    function print_messageln($message){
        fwrite(STDERR, $message ."\n");
    }

}

$format = "json";
(new AnnotationFetcher())->run($argv);
?>
