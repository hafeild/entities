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
 * @param annotation The annotation to save. Should have the following fields:
 *          - entities
 *          - groups
 *          - interactions
 *          - locations
 * @return The id of the newly added annotation.
 */
function addAnnotation($userId, $textId, $annotation){
    $dbh = connectToAnnotationDB();

    try{
        $statement = $dbh->prepare(
            "insert into annotations(text_id, created_by, annotation) ".
                "values(:text_id, :user_id, :annotation)");
        $statement->execute([
            ":text_id" => $textId,
            ":user_id" => $userId,
            ":annotation" => json_encode($annotation)
        ]);
        return $dbh->lastInsertId();
    } catch(Exception $e){
        error("Error adding annotation: ". $e->getMessage());
    }
}
/**
 * Retrieves all the annotation metadata.
 * 
 * @return An array of annotation metadata. Each element has the fields:
 *          - annotation_id
 *          - title
 *          - text_id
 *          - username (owner)
 *          - user id  (owner)
 */
function lookupAnnotations(){
    $dbh = connectToAnnotationDB();

    try{
        $statement = $dbh->prepare(
            "select annotations.id as annotation_id, title, text_id, username, ".
                "users.id as user_id from annotations ".
                "join users join texts where text_id = texts.id and ".
                "users.id = created_by");
        $statement->execute();

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
 */
function lookupAnnotationsByUser($userId){
    $dbh = connectToAnnotationDB();

    try{
        $statement = $dbh->prepare(
            "select annotations.id as annotation_id, title, text_id, username, ".
                "user.id as user_id from annotations ".
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
 */
function lookupAnnotationsByText($textId){
    $dbh = connectToAnnotationDB();

    try{
        $statement = $dbh->prepare(
            "select annotations.id as annotation_id, title, text_id, username, ".
                "user.id as user_id from annotations ".
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
                "users.id as user_id, annotation from annotations ".
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