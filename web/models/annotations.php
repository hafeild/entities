<?php
// File:    annotations.php
// Author:  Hank Feild
// Date:    15-Oct-2018
// Purpose: Handles model operations for the text annotation API. 


/**
 * Makes a connection to the annotation database.
 */
function connectToAnnotationDB(){
    try{
        $dbh = connectToDB();
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
 *       - ties
 *          <tieId>: {start, end, 
 *                    source_entity: {location_id: "" | entity_id: ""}, 
 *                    target_entity: {location_id: "" | entity_id: ""}, 
 *                    label, weight, directed}
 * @param method A description of the method used for this, e.g.,
 *               "manual", "automatic", "unannotated".
 * @param method_metadata A JSON string containing metadata information, such as
 *                        algorithm, version, parameters, etc.
 * @param label A descriptive name for the annotation, e.g. "BookNLP".
 * @param automatedMethodInProgress Optional (default is false).
 * @return The id of the newly added annotation.
 */
function addAnnotation($userId, $textId, $parentAnnotationId, $annotation,
    $method, $method_metadata, $label, $automatedMethodInProgress=false){

    $dbh = connectToAnnotationDB();
    try{
        $statement = $dbh->prepare(
            "insert into annotations(" .
                "text_id, created_by, parent_annotation_id, annotation, ". 
                "method, method_metadata, label, created_at, updated_at, ". 
                "automated_method_in_progress, automated_method_error) ". 
                "values(:text_id, :user_id, ". 
                ":parent_annotation_id, :annotation, :method, ".
                ":method_metadata, :label, ". 
                ":timestamp, :timestamp, ". 
                ":automated_method_in_progress, '0')");
        $statement->execute([
            ":text_id"             => $textId,
            ":user_id"             => $userId,
            ":parent_annotation_id"=> $parentAnnotationId,
            ":annotation"          =>json_encode($annotation,JSON_FORCE_OBJECT),
            ":method"              => $method,
            ":method_metadata"     => $method_metadata,
            ":label"               => $label,
            ":automated_method_in_progress"
                                   => boolToString($automatedMethodInProgress),
                                   
            ":timestamp"           => curDateTime()
        ]);
        return $dbh->lastInsertId();
    } catch(Exception $e){
        error("Error adding annotation: ". $e->getMessage(), [
            
            ":text_id"             => $textId,
            ":user_id"             => $userId,
            ":parent_annotation_id"=> $parentAnnotationId,
            ":annotation"          =>json_encode($annotation,JSON_FORCE_OBJECT),
            ":method"              => $method,
            ":method_metadata"     => $method_metadata,
            ":label"               => $label,
            ":automated_method_in_progress" 
                                   => boolToString($automatedMethodInProgress),
            ":timestamp"           => curDateTime()
        ]);
    }
}
/**
 * Retrieves annotation metadata for all annotations a user has access to.
 * Can be optionally filtered by text.
 * 
 * @param textId (OPTIONAL) If present, restricts the annotations returned to 
 *               just those associated with the given text id.
 * @return An array of annotation metadata. Each element has the fields:
 *      * annotation_id
 *      * parent_annotation_id
 *      * text_title
 *      * text_id
 *      * text_md5sum
 *      * username (owner)
 *      * user_id  (owner)
 *      * method
 *      * method_metadata (specific to method and algorithm used)
 *      * label
 *      * created_at
 *      * updated_at
 *      * is_public
 *      * automated_method_in_progress
 *      * automated_method_error
 *      * permission (of the current user)
 * 
 */
function lookupAnnotations($textId = null){
    global $user;
    $dbh = connectToAnnotationDB();

    $filter = "";
    if($textId != null)
        $filter = "where text_id = :text_id";

    try{
        $statement = $dbh->prepare(
            "select annotations.id as annotation_id, title as text_title, ".
                "md5sum as text_md5sum, text_id,username,users.id as user_id, ". 
                "parent_annotation_id, method, method_metadata, label, ". 
                "annotations.created_at, annotations.updated_at, ". 
                "annotations.is_public, ". 
                "automated_method_in_progress, automated_method_error, ". 
                "permission from annotations ".
                "join users on users.id = created_by ". 
                "join texts on text_id = texts.id ".
                "left join (select annotation_id, permission ". 
                "from annotation_permissions where user_id = :user_id) as A ". 
                "on A.annotation_id = annotations.id ".
                "$filter order by annotation_id");
        $statement->execute([
            ":text_id" => $textId,
            ":user_id" => ($user == null ? null : $user["id"])
        ]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    } catch(Exception $e){
        error("Error retrieving annotations: ". $e->getMessage(),
            ["In lookupAnnotations($textId)"]);
    }
}


/**
 * Retrieves all annotation metadata by the given user.
 * 
 * @param userId The id of the user.
 * @return An array of annotation metadata. Each element has the fields:
 *      * annotation_id
 *      * parent_annotation_id
 *      * text_title
 *      * text_id
 *      * text_md5sum
 *      * username (owner)
 *      * user_id  (owner)
 *      * method
 *      * method_metadata (specific to method and algorithm)
 *      * label
 *      * created_at
 *      * updated_at
 *      * is_public
 *      * automated_method_in_progress
 *      * automated_method_error
 */
function lookupAnnotationsByUser($userId){
    $dbh = connectToAnnotationDB();

    try{
        $statement = $dbh->prepare(
            "select annotations.id as annotation_id, title as text_title, ".
            "md5sum as text_md5sum, text_id, username, users.id as user_id, ". 
            "parent_annotation_id, method, method_metadata, label, ".
            "annotations.created_at, annotations.updated_at, ". 
            "annotations.is_public, ". 
            "automated_method_in_progress, automated_method_error ". 
            "from annotations ".
            "join users on users.id = created_by". 
            "join texts on text_id = texts.id and created_by = :user_id");
        $statement->execute([
            ":user_id" => $userId,
        ]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    } catch(Exception $e){
        error("Error retrieving annotation: ". $e->getMessage(),
            ["In lookupAnnotationsByUser($userId)"]);
    }
}

/**
 * Retrieves all the annotation metadata for the given text.
 * 
 * @param textId The id of the text.
 * @return An array of annotation metadata. Each element has the fields:
 *      * annotation_id
 *      * parent_annotation_id
 *      * text_title
 *      * text_id
 *      * text_md5sum
 *      * username (owner)
 *      * user_id  (owner)
 *      * method
 *      * method_metadata
 *      * label
 *      * created_at
 *      * updated_at
 *      * is_public
 *      * automated_method_in_progress
 *      * automated_method_error
 */
function lookupAnnotationsByText($textId){
    $dbh = connectToAnnotationDB();

    try{
        $statement = $dbh->prepare(
            "select annotations.id as annotation_id, title as text_title, ".
            "md5sum as text_md5sum, text_id, username, users.id as user_id, ". 
            "parent_annotation_id, method, method_metadata, label, ". 
            "annotations.created_at, annotations.updated_at, ". 
            "annotations.is_public, ". 
            "automated_method_in_progress, automated_method_error ". 
            "from annotations ".
            "join users on users.id = created_by ". 
            "join texts on text_id = texts.id and ".
            "where text_id = :text_id");
        $statement->execute([
            ":text_id" => $textId,
        ]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    } catch(Exception $e){
        error("Error retrieving annotation: ". $e->getMessage(),
            ["In lookupAnnotationsByText($textId)"]);
    }
}

/**
 * Retrieves the annotation with the given id.
 * 
 * @param id The id of the annotation.
 * @return An associative array of annotation metadata with these fields:
 *      * annotation_id
 *      * parent_annotation_id
 *      * text_title
 *      * text_id
 *      * text_md5sum
 *      * username (owner)
 *      * user_id  (owner)
 *      * method
 *      * method_metadata
 *      * label
 *      * created_at
 *      * updated_at
 *      * is_public
 *      * automated_method_in_progress
 *      * automated_method_error
 *      * annotation
 *           - entities
 *           - groups
 *           - ties
 *           - locations
 */
function lookupAnnotation($id){
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
            "join texts on text_id = texts.id ".
            "where annotations.id = :id");
        $statement->execute([
            ":id" => $id,
        ]);

        $res = $statement->fetch(PDO::FETCH_ASSOC);
        
        // Convert annotation value into a PHP array.
        if($res != null){
            $res["annotation"] = json_decode($res["annotation"], true);
        }
        return $res;

    } catch(Exception $e){
        error("Error retrieving annotation: ". $e->getMessage(),
            ["In lookupAnnotation($id)"]);
    }
}

/**
 * Updates an existing annotation in the database. Checks that the user
 * requesting the change owns the annotation.
 * 
 * @param annotationId The id of the annotation.
 * @param userId The id of the user making the change.
 * @param updater The function to call (should be short as the whole thing
 *                occurs in a transaction). Can be null if the annotation JSON
 *                is not being updated.
 * @param isPublic Boolean. Whether this annotation is publicly viewable or not.
 *                 Defaults to null (ignored).
 * @param label The label (name) of the annotation. Defaults to null (ignored). 
 */
function updateAnnotation($annotationId, $userId, $updater, $isPublic = null, 
                          $label = null){
    $dbh = connectToAnnotationDB();
    $useLocalTransaction = !$dbh->inTransaction();

    if($useLocalTransaction){
        $dbh->beginTransaction();
    }

    $annotationData = lookupAnnotation($annotationId);

    try{
        $params = [
            ":id" => $annotationId,
            ":updated_at" => curDateTime()
        ];
        $updates = ["updated_at = :updated_at"];
        if($isPublic !== null){
            $params[":is_public"] =  boolToString($isPublic);
            array_push($updates, "is_public = :is_public");
        }
        if($updater != null){
            $params[":annotation"] = json_encode(
                $updater($annotationData["annotation"]), true);
            array_push($updates, "annotation = :annotation");
        }
        if($label !== null){
            $params[":label"] = $label;
            array_push($updates, "label = :label");
        }
        
        $statement = $dbh->prepare(
            "update annotations set ". implode(", ", $updates) . 
                " where id = :id");

        $statement->execute($params);
        if($useLocalTransaction){
            $dbh->commit();
        }

    } catch(Exception $e){
        if($useLocalTransaction){
            $dbh->rollback();
            error("Error updating annotation: ". $e->getMessage(),
                ["In updateAnnotation($annotationId, $userId, updater)"]);
        } else {
            throw new Exception("Error updating annotation: ". 
                $e->getMessage() .".");
        }
    }
}

/**
 * Sets the automatic annotation progress and error flags for an annotation.
 * 
 * @param annotationId The id of the annotation to update.
 * @param inProgressFlag The value to set the `automated_method_in_progress`
 *                      column to.
 * @param errorFlag The value to set the `automated_method_error` column to.
 */
function setAnnotationFlags($annotationId, $inProgressFlag, $errorFlag) {
    $dbh = connectToAnnotationDB();
    try{
        $statement = $dbh->prepare(
            "update annotations set ".
                "automated_method_in_progress = :in_progress, ".
                "automated_method_error = :error, updated_at = :updated_at ".
                "where id = :id");
        $statement->execute([
            ":id"           => $annotationId,
            ":in_progress"  => boolToString($inProgressFlag),
            ":error"        => boolToString($errorFlag),
            ":updated_at" => curDateTime()
        ]);

    } catch(Exception $e){
        error("Error updating annotation: ". $e->getMessage(), 
            ["In setAnnotationFlags($annotationId, ". 
            "$inProgressFlag, $errorFlag)"]);
    }
}

/**
 * F
 * @param textId The id of the text whose blank slate annotation should be 
 *               retrieved.
 * @return The blank slate annotation, which includes these fields:
 *      * annotation_id
 *      * parent_annotation_id
 *      * text_title
 *      * text_id
 *      * text_md5sum
 *      * username (owner)
 *      * user_id  (owner)
 *      * method
 *      * method_metadata
 *      * label
 *      * created_at
 *      * updated_at
 *      * is_public
 *      * automated_method_in_progress
 *      * automated_method_error
 *      * annotation
 *           - entities
 *           - groups
 *           - ties
 *           - locations
 */
function getBlankSlateAnnotation($textId){
    $dbh = connectToAnnotationDB();

    try{
        $statement = $dbh->prepare(
            "select annotations.id as annotation_id, title as text_title, ".
                "md5sum as text_md5sum, text_id, username, ". 
                "users.id as user_id, ". 
                "parent_annotation_id, method, method_metadata, label, ". 
                "annotations.created_at, annotations.updated_at, ".
                "annotations.is_public, ". 
                "automated_method_in_progress, automated_method_error ". 
                "from annotations ".
                "join users on users.id = created_by ". 
                "join texts on text_id = texts.id and ".
                "where text_id = :text_id and parent_annotation_id = ''");
        $statement->execute([
            ":text_id" => $textId,
        ]);

        return $statement->fetch(PDO::FETCH_ASSOC);
    } catch(Exception $e){
        error("Error retrieving annotation: ". $e->getMessage(),
            ["In lookupAnnotationsByText($textId)"]);
    }
}


////////////////////////////////////////////////////////////////////////////////
// Annotation permissions.
////////////////////////////////////////////////////////////////////////////////

/**
 * Extracts the permission data for the given user and annotation. 
 * 
 * @param userId The id of the user.
 * @param annotationId The id of the annotation.
 * @return An associative array of permission data with these fields:
 *      * id (permission id)
 *      * user_id
 *      * annotation_id
 *      * permission
 *      * created_at
 */
function getAnnotationPermission($userId, $annotationId){

    try{
        $dbh = connectToDB();
        $statement = $dbh->prepare("select * from annotation_permissions ". 
            "where annotation_id = :annotation_id and user_id = :user_id");
        $statement->execute([
            ":annotation_id" => $annotationId,
            ":user_id" => $userId
        ]);
        return $statement->fetch(PDO::FETCH_ASSOC);

    } catch(PDOException $e){
        error("There was an error retrieving permissions for the given ". 
            "annotation: ". $e->getMessage());
    }
}

/**
 * Extracts the data for the given annotation permission id. 
 * 
 * @param permissionId The id of the annotation permission.
 * @return An associative array of permission data with these fields:
 *      * id (permission id)
 *      * user_id
 *      * text_id
 *      * permission
 *      * created_at
 */
function getAnnotationPermissionById($permissionId){

    try{
        $dbh = connectToDB();
        $statement = $dbh->prepare("select * from annotation_permissions ". 
            "where id = :id");
        $statement->execute([
            ":id" => $permissionId
        ]);
        return $statement->fetch(PDO::FETCH_ASSOC);

    } catch(PDOException $e){
        error("There was an error retrieving the given permission: ". 
            $e->getMessage());
    }
}

/**
 * Extracts the permission data for the given annotation. 
 * 
 * @param annotationId The id of the text.
 * @return An list of associative arrays of permission data with these fields:
 *      * id (permission id)
 *      * user_id
 *      * username
 *      * annotation_id
 *      * permission
 *      * created_at
 */
function getAnnotationPermissions($annotationId){

    try{
        $dbh = connectToDB();
        $statement = $dbh->prepare("select annotation_permissions.*, username ". 
            "from annotation_permissions ". 
            "join users on user_id = users.id ". 
            "where annotation_id = :annotation_id");
        $statement->execute([
            ":annotation_id" => $annotationId
        ]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);

    } catch(PDOException $e){
        error("There was an error retrieving permissions on the given ". 
            "annotation: ". $e->getMessage());
    }
}

/**
 * Adds an annotation permission.
 * 
 * @param userId The id of the user to add the permission for.
 * @param annotationId The id of the annotation to add the permission to.
 * @param permission The permission level (integer):
 *                      - 0: none
 *                      - 1: read
 *                      - 2: write
 *                      - 3: owner
 * @return The id of the newly created permission.
 */
function addAnnotationPermission($userId, $annotationId, $permission){
    $dbh = connectToDB();
    $useLocalTransaction = !$dbh->inTransaction();
    
    if($useLocalTransaction){
        $dbh->beginTransaction();
    }

    try {
        $statement = $dbh->prepare(
            "insert into annotation_permissions". 
                "(annotation_id, user_id, permission, created_at, updated_at) ". 
                "values (:annotation_id, :user_id, :permission, :time, ". 
                ":time)");
        $success = $statement->execute([
            ":annotation_id"    => $annotationId,
            ":user_id"    => $userId,
            ":permission" => $permission,
            ":time" => curDateTime()
        ]);

        $permissionId = $dbh->lastInsertId();

        if($useLocalTransaction){
            $dbh->commit();
        }

        return $permissionId;

    } catch(PDOException $e){
        if($useLocalTransaction){
            $dbh->rollback();
            error("There was an error adding the annotation permission: ". 
                $e->getMessage());
        } else {
            throw new Exception("There was an error adding the annotation ". 
                "permission: ". $e->getMessage() .".");
        }
    }
}


/**
 * Updates the permission level of the given annotation permission. 
 * 
 * @param id The id of the annotation permission.
 * @param permission The permission level (integer):
 *                      - 0: none
 *                      - 1: read
 *                      - 2: write
 *                      - 3: owner
 */
function setAnnotationPermission($id, $permission){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "update annotation_permissions set permission = :permission, ".
                "updated_at = :updated_at where id = :id");
        $success = $statement->execute([
            ":id"    => $id,
            ":permission" => $permission,
            ":updated_at" => curDateTime()
        ]);
    } catch(PDOException $e){
        error("There was an error updating the annotation permission: ". 
            $e->getMessage());
    }
}

/**
 * Deletes the given annotation permission. 
 * 
 * @param id The id of the annotation permission.
 */
function deleteAnnotationPermission($id){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "delete from annotation_permissions where id = :id");
        $success = $statement->execute([
            ":id"    => $id
        ]);
    } catch(PDOException $e){
        error("There was an error deleting the annotation permission: ". 
            $e->getMessage());
    }
}

?>