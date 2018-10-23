<?php
// File:    model-annotations-mongo.php
// Author:  Hank Feild
// Date:    15-Oct-2018
// Purpose: Handles model operations for the text annotation API. 

require_once("model.php");

$mongo = null;

/**
 * Makes a connection to the Mongo server.
 */
function connectToMongo(){
    global $mongo;

    if($mongo != null)
        return $mongo;

    try{
        $connection = new MongoDB\Driver\Manager();
        $mongo = $connection->whenEntitiesInteract;

        return $mongo;
    } catch(Exception $e){
        error("Connection to mongo failed: ". $e->getMessage());
    }
}

/**
 * Adds a new annotation to the Mongo database.
 * 
 * @param userId The id of the user.
 * @param textId The id of the text.
 * @param annotation The annotation to save. Should have the following fields:
 *          - entities
 *          - groups
 *          - interactions
 *          - locations
 */
function addAnnotation($userId, $textId, $annotation){
    $mongo = connectToMongo();

    $annotation['user_id'] = $userId;
    $annotation['text_id'] = $textId;

    try{
        $collection = $mongo->annotations;
        $collection->insert($annotation);
    } catch(Exception $e){
        error("Error adding annotation: ". $e->getMessage());
    }
}