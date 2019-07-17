<?php
// File:    model-annotations-sql.php
// Author:  Hank Feild
// Date:    15-Oct-2018
// Purpose: Handles model operations for the text annotation API. 

require_once("model.php");

/**
 * Makes a connection to the annotation database.
 */
function connectToAnnotationDB(){
    try{
        $dbh = connectToDB();

        $status = $dbh->exec("create table if not exists annotations(".
            "id integer primary key autoincrement,".
            "text_id integer,".
            "created_by integer,".
            "annotation text,".
            "parent_annotation_id integer,".
            "method text,".
            "label text,".
            "created_at datetime,".
            "updated_at datetime,".
            "automated_method_in_progress boolean default FALSE,". 
            "automated_method_error boolean default FALSE,".
            "foreign key(created_by) references users(id),".
            "foreign key(text_id) references texts(id)".
        ")");

        return $dbh;
    } catch(Exception $e){
        error("Failed to create annotation table ". $e->getMessage());
    }
}

/**
 * Adds a new annotation to the database.
 * 
 * @param userId The id of the user.
 * @param textId The id of the text.
 * @param parentAnnotationId The id of the annotation this is adapted from;
 *               use null if this is the root annotation for this text.
 * @param annotation The annotation to save. Should have the following fields:
 *       - entities
 *          <entityId>: {name, group_id}
 *       - groups
 *          <groupId>: {name}
 *       - locations
 *          <locationId>: {start, end, entity_id}
 *       - interactions
 *          <interactionId>: {locations, label}
 * @param method A description of the method used for this, e.g.,
 *               "manual", "automatic", "unannotated".
 * @param label A descriptive name for the annotation, e.g. "BookNLP".
 * @param automatedMethodInProgress Optional (default is false).
 * @return The id of the newly added annotation.
 */
function addAnnotation($userId, $textId, $parentAnnotationId, $annotation,
    $method, $label, $automatedMethodInProgress=false){

    $dbh = connectToAnnotationDB();

    try{
        $statement = $dbh->prepare(
            "insert into annotations(" .
                "text_id, created_by, parent_annotation_id, annotation, ". 
                "method, label, created_at, updated_at, ". 
                "automated_method_in_progress) values(:text_id, :user_id, ". 
                ":parent_annotation_id, :annotation, :method, :label, ". 
                "DATETIME('now'), DATETIME('now'), ". 
                ":automated_method_in_progress)");
        $statement->execute([
            ":text_id"              => $textId,
            ":user_id"              => $userId,
            ":parent_annotation_id" => $parentAnnotationId,
            ":annotation"           => json_encode($annotation),
            ":method"               => $method,
            ":label"                => $label,
            ":automated_method_in_progress" => $automatedMethodInProgress
        ]);
        return $dbh->lastInsertId();
    } catch(Exception $e){
        error("Error adding annotation: ". $e->getMessage());
    }
}
/**
 * Retrieves annotation metadata.
 * 
 * @param textId (OPTIONAL) If present, restricts the annotations returned to 
 *               just those associated with the given text id.
 * @return An array of annotation metadata. Each element has the fields:
 *      * annotation_id
 *      * parent_annotation_id
 *      * text_title
 *      * text_id
 *      * username (owner)
 *      * user_id  (owner)
 *      * method
 *      * label
 *      * created_at
 *      * updated_at
 *      * automated_method_in_progress
 *      * automated_method_error
 */
function lookupAnnotations($textId = null){
    $dbh = connectToAnnotationDB();

    $filter = "";
    if($textId != null)
        $filter = "and text_id = :text_id";

    try{
        $statement = $dbh->prepare(
            "select annotations.id as annotation_id, title as text_title, ".
                "text_id, username, users.id as user_id, ". 
                "parent_annotation_id, method, label, annotations.created_at, ". 
                "updated_at, ". 
                "automated_method_in_progress, automated_method_error ". 
                "from annotations ".
                "join users join texts where text_id = texts.id and ".
                "users.id = created_by $filter");
        $statement->execute([':text_id' => $textId]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    } catch(Exception $e){
        error("Error retrieving annotations: ". $e->getMessage());
    }
}


/**
 * Retrieves all annotation metadata by the given user.
 * 
 * @param userId The id of the user.
 * @return An array of annotation metadata. Each element has the fields:
 *          - annotation_id
 *          - title
 *          - text_id
 *          - username (owner)
 *          - user id  (owner)
 *          - parent_annotation_id
 */
function lookupAnnotationsByUser($userId){
    $dbh = connectToAnnotationDB();

    try{
        $statement = $dbh->prepare(
            "select annotations.id as annotation_id, title, text_id, username, ".
                "user.id as user_id, parent_annotation_id from annotations ".
                "join users join texts where text_id = texts.id and ".
                "users.id = created_by and created_by = :user_id");
        $statement->execute([
            ":user_id" => $userId,
        ]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    } catch(Exception $e){
        error("Error retrieving annotation: ". $e->getMessage());
    }
}

/**
 * Retrieves all the annotation metadata for the given text.
 * 
 * @param textId The id of the text.
 * @return An array of annotation metadata. Each element has the fields:
 *          - annotation_id
 *          - title
 *          - text_id
 *          - username (owner)
 *          - user id  (owner)
 *          - parent_annotation_id
 */
function lookupAnnotationsByText($textId){
    $dbh = connectToAnnotationDB();

    try{
        $statement = $dbh->prepare(
            "select annotations.id as annotation_id, title, text_id, username, ".
                "user.id as user_id, parent_annotation_id from annotations ".
                "join users join texts where text_id = texts.id and ".
                "users.id = created_by and text_id = :text_id");
        $statement->execute([
            ":text_id" => $textId,
        ]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    } catch(Exception $e){
        error("Error retrieving annotation: ". $e->getMessage());
    }
}

/**
 * Retrieves the annotation with the given id.
 * 
 * @param id The id of the annotation.
 * @return An array of annotation metadata. Each element has the fields:
 *          - annotation_id
 *          - title
 *          - text_id
 *          - username (owner)
 *          - user_id  (owner)
 *          - parent_annotation_id
 *          - annotation
 *              * entities
 *              * groups
 *              * interactions
 *              * locations
 */
function lookupAnnotation($id){
    $dbh = connectToAnnotationDB();

    try{
        $statement = $dbh->prepare(
            "select annotations.id as annotation_id, title, text_id, username, ".
                "users.id as user_id, parent_annotation_id, annotation ".
                "from annotations ".
                "join users join texts where text_id = texts.id and ".
                "users.id = created_by and annotations.id = :id");
        $statement->execute([
            ":id" => $id,
        ]);

        $res = $statement->fetch(PDO::FETCH_ASSOC);
        
        // Convert annotation value into a PHP array.
        $res["annotation"] = json_decode($res["annotation"], true);
        return $res;

    } catch(Exception $e){
        error("Error retrieving annotation: ". $e->getMessage());
    }
}

/**
 * Updates an existing annotation in the database. Checks that the user
 * requesting the change owns the annotation.
 * 
 * @param annotationId The id of the annotation.
 * @param userId The id of the user making the change.
 * @param updater The function to call (should be short as the whole thing
 *                occurs in a transaction).
 */
function updateAnnotation($annotationId, $userId, $updater){
    $dbh = connectToAnnotationDB();

    $dbh->beginTransaction();

    $annotationData = lookupAnnotation($annotationId);

    if($annotationData["user_id"] != $userId){
        $dbh->rollback();
        error("User $userId is not authorized to modify the annotation with id ".
            $annotationId);
    }

    try{
        $statement = $dbh->prepare(
            "update annotations set annotation = :annotation ".
                "where id = :id");
        $statement->execute([
            ":id" => $annotationId,
            ":annotation" => json_encode($updater($annotationData["annotation"]), true)
        ]);
        $dbh->commit();

    } catch(Exception $e){
        $dbh->rollback();
        error("Error updating annotation: ". $e->getMessage());
    }
}