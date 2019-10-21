<?php
// File:    model.php
// Author:  Hank Feild
// Date:    10-Oct-2018
// Purpose: Handles model operations for the text annotation API. 
require_once("model-annotations-sql.php");

$dbh = null;

/**
 * Checks if status is false and, if so, reports the error info along with the
 * given error message before dying.
 * 
 * @param dbh The PDO database handle.
 * @param status The status to check (false = error).
 * @param error The error message to prepend to the database error info.
 */
function checkForStatementError($dbh, $status, $error){
    if($status===false){ 
        error($error ." :: ". $dbh->errorInfo()[2]); 
    }
}

/**
 * @return The current timestamp in the format Y-m-d H:i:s.
 */
function curDateTime() {
    // return new DateTime();
   return (new DateTime())->format("Y-m-d H:i:s");
}

/**
 * Maps a boolean to the string literal true or false.
 * 
 * @param bool The boolean to map.
 * @return true -> "true" or false -> "false".
 */
function boolToString($bool){
    return $bool ? "1" : "0";
}

/**
 * Connects to the database as specified in the config file (see $CONFIG_FILE
 * above).
 * 
 * @return A PDO object for the database.
 */
function connectToDB(){
    global $CONFIG;
    global $dbh;

    if($dbh === null){
        try {
            if($CONFIG->authentication){
                $dbh = new PDO($CONFIG->dsn, 
                    $CONFIG->username, $CONFIG->password);
            } else {
                $dbh = new PDO($CONFIG->dsn);
            }

            // Raise exceptions when errors are encountered.
            $dbh->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        } catch (PDOException $e) {
            error("Connection failed: ". $e->getMessage() . 
                "; dsn: ". $CONFIG->dsn);
        }
    }
    return $dbh;
}

/**
 * Extracts the metadata for the text with the given id from the database. 
 * 
 * @param id The id of the text to fetch.
 * @return An associative array of book metadata with these fields:
 *      * id
 *      * title
 *      * md5sum
 *      * tokenization_in_progress
 *      * tokenization_error
 *      * created_at
 *      * processed_at
 *      * uploaded_by
 *      * uploaded_by_username
 *      * is_public
 */
function getTextMetadata($id){
    $dbh = connectToDB();

    try{
        $statement = $dbh->prepare("select texts.*, username as ". 
            "uploaded_by_username from texts join users on texts.id = :id and ". 
            "users.id = texts.uploaded_by");
        $statement->execute([":id" => $id]);

        return $statement->fetch(PDO::FETCH_ASSOC);
    } catch(PDOException $e) {
        error("Error getting text metadata: ". $e->getMessage());
    }

}

/**
 * Returns the Book-NLP annotation data based on the given text id.
 * 
 * @param id The id of the text whose annotation should be retrieved.
 * @return An annotation with the following keys:
 *      * text
 *          - (all columns from the texts table)
 *      * annotation
 *          - entities
 *          - groups
 *          - ties
 *          - locations
 */
// function getOriginalAnnotation($id){
//     global $CONFIG;

//     // $results = [];

//     $row = getTextMetadata($id);
//     if(!$row){
//         error("We could not find a text with the id $id.");
//     }
//     return $row;

//     // $results["text"] = $row;

//     // if($row["processed"] == 1){
//     //     //$filename = $CONFIG->text_storage."/".$row["md5sum"].".ids.json.book";
//     //     $filename = $CONFIG->text_storage."/".$row["md5sum"].".entities.json";
//     //     $fd = fopen($filename, "r");
//     //     $results["annotation"] = json_decode(fread($fd,filesize($filename)));
//     //     fclose($fd);
//     // }

//     // return $results;
// }

/**
 * Adds a new text to the metadata table as well as to the file system in the
 * text_storage location specified in the configuration file (see $CONFIG).
 * 
 * @param md5sum The MD5 sum of the text file.
 * @param file The current (temporary) path to the text file on disk.
 * @param title The title of the text.
 * @param user_id The id of the user adding the text.
 */
function addText($md5sum, $file, $title, $user_id){
    global $CONFIG;
    $dbh = connectToDB();
    $dbh->beginTransaction();

    // Check if another file with this signature exists; if not, add the file.
    $statement = $dbh->prepare(
        "select * from texts where md5sum = :md5sum");
    checkForStatementError($dbh, $statement, 
        "Error preparing md5sum db statement.");
    $statement->execute(array(":md5sum" => $md5sum));
    checkForStatementError($dbh, $statement, "Error checking md5sum of text.");
    $row = $statement->fetch(\PDO::FETCH_ASSOC);
    if($row){
        $dbh->rollBack();
        error("This text has already been uploaded.", $row);
    } else {
        $statement = $dbh->prepare("insert into texts".
            "(title,md5sum,created_at,uploaded_by) ".
            "values(:title, :md5sum, :time, :user_id)");
        checkForStatementError($dbh, $statement, 
            "Error preparing upload db statement.");
        $statement->execute(array(
            ":md5sum"  => $md5sum, 
            ":title"   => $title,
            ":time"    => curDateTime(),
            ":user_id" => $user_id
        ));
        checkForStatementError($dbh, $statement, 
            "Error adding upload information to db.");
        $id = $dbh->lastInsertId();

        // Make the directory rwxrwx--- for user:group www-data:www-data.
        if(!mkdir($CONFIG->text_storage ."/$id", 0770, true)){
            $dbh->rollBack();
            error("Could not create a directory for the new text.");
        } else {
            if(!move_uploaded_file($file, $CONFIG->text_storage ."/$id/original.txt")){
                $dbh->rollBack();
                error("Could not move the uploaded file on the server.");
            } else {
                $dbh->commit();
                return getTextMetadata($id);
            }
        }
    }
}

/**
 * Returns the content of the text with the given id as a string.
 * 
 * @param id The id of the text.
 * @return The content of the text as a string.
 */
function getTextContentFilename($id) {
    global $CONFIG;
    $dbh = connectToDB();
    // return $CONFIG->text_storage ."/$id/original.txt";

    // TODO This should be annotation specific.
    return $CONFIG->text_storage ."/$id/tokens.json";
}


/**
 * Sets the tokenization progress and error flags for a text.
 * 
 * @param textId The id of the text to update.
 * @param inProressFlag The value to set the `tokenization_in_progress`
 *                      column to.
 * @param errorFlag The value to set the `tokenization_error` column to.
 */
function setTokenizationFlags($textId, $inProgressFlag, $errorFlag) {
    $dbh = connectToDB();
    try{
        $statement = $dbh->prepare(
            "update texts set ".
                "tokenization_in_progress = :in_progress, ".
                "tokenization_error = :error, updated_at = :updated_at ".
                "where id = :id");
        $statement->execute([
            ":id"           => $textId,
            ":in_progress"  => boolToString($inProgressFlag),
            ":error"        => boolToString($errorFlag),
            ":updated_at"   => curDateTime()
        ]);

    } catch(Exception $e){
        error("Error updating text metadata: ". $e->getMessage(),
            ["In setTokenizationFlags($textId, $inProgressFlag, $errorFlag)"]);
    }
}

/**
 * Updates the is_public and/or title attributes of a text.
 * 
 * @param id The id of the text to update.
 * @param isPublic Either '1', '0', or null; if null, no change is made.
 * @param title Either a string (the new title), or null (no change is made).
 */
function updateText($id, $isPublic, $title){
    $dbh = connectToDB();
    try{
        $params = [":id" => $id];
        $updates = [":updated_at" => curDateTime()];
        if($isPublic != null){
            $params[":is_public"] = $isPublic;
            array_push($updates, "is_public = :is_public");
        }
        if($title != null){
            $params[":title"] = $title;
            array_push($updates, "title = :title");
        }

        $statement = $dbh->prepare(
            "update texts set ". implode(", ", $updates) .", ". 
                "updated_at = :updated_at where id = :id");
        $statement->execute($params);

    } catch(Exception $e){
        error("Error updating text metadata: ". $e->getMessage(),
            ["In updateText($id, $isPublic, $title)"]);
    }
}

/////////////////////////////////
// User control.
/////////////////////////////////

/**
 * Saves the data for the given username. 
 * 
 * @param username The username.
 * @param password The password hash for the user.
 */
function addNewUser($username, $password){
    $dbh =  connectToDB();

    try {
        $statement = $dbh->prepare(
            "insert into users(username, password, created_at) ".
            "values(:username, :password, :time)");

        $success = $statement->execute(array(
            ":username" => $username, 
            ":password" => $password,
            ":time"     => curDateTime()
        ));
    } catch(PDOException $e){
        error("There was an error saving to the database: ". $e->getMessage());
    }
}

/**
 * Retrieves data for the given username. 
 * 
 * @param username The username to lookup.
 * @return The data associated with the given username, or null if the username
 *         doesn't exist. The returned data is an associative array with these
 *         fields:
 *           - id
 *           - username
 *           - password
 *           - auth_token
 */
function getUserInfo($username){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "select * from users where username = :username");
        $success = $statement->execute(array(
            ":username" => $username));
           
        return $statement->fetch(PDO::FETCH_ASSOC);
    } catch(PDOException $e){
        error("There was an error reading from the database: ". $e->getMessage());
    }
}

/**
 * Retrieves data for the given auth token. 
 * 
 * @param auth_token The auth token to look the user up by.
 * @return The data associated with the given username, or null if the username
 *         doesn't exist. The returned data is an associative array with these
 *         fields:
 *           - id
 *           - username
 *           - password
 *           - auth_token
 */
function getUserInfoByAuthToken($auth_token){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "select * from users where auth_token = :auth_token");
        $success = $statement->execute(array(
            ":auth_token" => $auth_token));
           
        return $statement->fetch(PDO::FETCH_ASSOC);
    } catch(PDOException $e){
        error("There was an error reading from the database: ". 
            $e->getMessage());
    }
}

/**
 * Retrieves data for the given auth token. 
 * 
 * @param userId The id of the user.
 * @param authToken The auth token to assign the user.
 */
function setUserAuthToken($userId, $authToken){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "update users set auth_token = :auth_token ".
                "where id = :user_id");
        $success = $statement->execute(array(
            ":user_id"    => $userId,
            ":auth_token" => $authToken));
    } catch(PDOException $e){
        error("There was an error updating the database: ". $e->getMessage());
    }
}

////////////////////////////////////////////////////////////////////////////////
// Text permissions.
////////////////////////////////////////////////////////////////////////////////

/**
 * Extracts the permission data for the given user and text. 
 * 
 * @param userId The id of the user.
 * @param textId The id of the text.
 * @return An associative array of permission data with these fields:
 *      * id (permission id)
 *      * user_id
 *      * text_id
 *      * permission
 *      * created_at
 */
function getTextPermission($userId, $textId){

    try{
        $dbh = connectToDB();
        $statement = $dbh->prepare("select * from text_permissions ". 
            "where text_id = :text_id and user_id = :user_id");
        $statement->execute([
            ":text_id" => $textId,
            ":user_id" => $userId
        ]);
        return $statement->fetch(PDO::FETCH_ASSOC);

    } catch(PDOException $e){
        error("There was an error retrieving permissions on the given text: ". 
            $e->getMessage());
    }
}

/**
 * Extracts the data for the given text permission id. 
 * 
 * @param permissionId The id of the text permission.
 * @return An associative array of permission data with these fields:
 *      * id (permission id)
 *      * user_id
 *      * text_id
 *      * permission
 *      * created_at
 */
function getTextPermissionById($permissionId){

    try{
        $dbh = connectToDB();
        $statement = $dbh->prepare("select * from text_permissions ". 
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
 * Extracts the permission data for the given text. 
 * 
 * @param textId The id of the text.
 * @return An list of associative arrays of permission data with these fields:
 *      * id (permission id)
 *      * user_id
 *      * username
 *      * text_id
 *      * permission
 *      * created_at
 */
function getTextPermissions($textId){

    try{
        $dbh = connectToDB();
        $statement = $dbh->prepare("select text_permissions.*, username ". 
            "from text_permissions ". 
            "join users on user_id = users.id ". 
            "where text_id = :text_id");
        $statement->execute([
            ":text_id" => $textId
        ]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);

    } catch(PDOException $e){
        error("There was an error retrieving permissions on the given text: ". 
            $e->getMessage());
    }
}

/**
 * Adds a text permission.
 * 
 * @param userId The id of the user to add the permission for.
 * @param textId The id of the text to add the permission to.
 * @param permission The permission level (integer):
 *                      - 0: none
 *                      - 1: read
 *                      - 2: write
 *                      - 3: owner
 * @return The id of the newly created permission.
 */
function addTextPermission($userId, $textId, $permission){
    $dbh = connectToDB();
    $dbh->beginTransaction();

    try {
        $statement = $dbh->prepare(
            "insert into text_permissions". 
                "(text_id, user_id, permission, created_at) values ". 
                "(:text_id, :user_id, :permission, :created_at)");
        $success = $statement->execute([
            ":text_id"    => $textId,
            ":user_id"    => $userId,
            ":permission" => $permission,
            ":created_at" => curDateTime()
        ]);
        $permissionId = $dbh->lastInsertId();

        $dbh->commit();

        return $permissionId;

    } catch(PDOException $e){
        $dbh->rollback();
        error("There was an error adding the text permission: ". 
            $e->getMessage(), 
            ["In addTextPermission($userId, $textId, $permission)."]);
    }
}

/**
 * Updates the permission level of the given text permission. 
 * 
 * @param id The id of the text permission.
 * @param permission The permission level (integer):
 *                      - 0: none
 *                      - 1: read
 *                      - 2: write
 *                      - 3: owner
 */
function setTextPermission($id, $permission){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "update text_permissions set permission = :permission, ".
                "updated_at = :updated_at where id = :id");
        $success = $statement->execute([
            ":id"    => $id,
            ":permission" => $permission,
            ":updated_at" => curDateTime()
        ]);
    } catch(PDOException $e){
        error("There was an error updating the text permission: ". 
            $e->getMessage());
    }
}

/**
 * Deletes the given text permission. 
 * 
 * @param id The id of the text permission.
 */
function deleteTextPermission($id){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "delete from text_permissions where id = :id");
        $success = $statement->execute([
            ":id"    => $id
        ]);
    } catch(PDOException $e){
        error("There was an error deleting the text permission: ". 
            $e->getMessage());
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
        error("There was an error retrieving permissions on the given ". 
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
 * @param annotationId The id of the annotation to add the permission to.
 * @param userId The id of the user to add the permission for.
 * @param permission The permission level (integer):
 *                      - 0: none
 *                      - 1: read
 *                      - 2: write
 *                      - 3: owner
 * @return The id of the newly created permission.
 */
function addAnnotationPermission($annotationId, $userId, $permission){
    $dbh = connectToDB();
    $dbh->beginTransaction();

    try {
        $statement = $dbh->prepare(
            "insert into annotation_permissions". 
                "(annotation_id, user_id, permission, created_at) values ". 
                "(:annotation_id, :user_id, :permission, :created_at)");
        $success = $statement->execute([
            ":annotation_id"    => $annotationId,
            ":user_id"    => $userId,
            ":permission" => $permission,
            ":created_at" => curDateTime()
        ]);

        $permissionId = $dbh->lastInsertId();

        $dbh->commit();

        return $permissionId;

    } catch(PDOException $e){
        $dbh->rollback();
        error("There was an error adding the annotation permission: ". 
            $e->getMessage());
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
