<?php
// File:    texts.php
// Author:  Hank Feild
// Date:    10-Oct-2018 (updated 03-Nov-2019)
// Purpose: Handles model operations for texts.


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
 * Adds a new text to the metadata table as well as to the file system in the
 * text_storage location specified in the configuration file (see $CONFIG). If 
 * the text exists and the error flags are not set, an error will occur. If
 * the tokenization_error flag is set, then no error will occur and the existing
 * text entry will be returned.
 * 
 * @param md5sum The MD5 sum of the text file.
 * @param file The current (temporary) path to the text file on disk.
 * @param title The title of the text.
 * @param user_id The id of the user adding the text.
 *
 * @return The text metadata. 
 */
function addText($md5sum, $file, $title, $user_id){
    global $CONFIG;
    $dbh = connectToDB();
    try{

    $dbh->beginTransaction();

    // // Check if another file with this signature exists; if not, add the file.
    // $statement = $dbh->prepare(
    //     "select * from texts where md5sum = :md5sum");
    // checkForStatementError($dbh, $statement, 
    //     "Error preparing md5sum db statement.");
    // $statement->execute(array(":md5sum" => $md5sum));
    // checkForStatementError($dbh, $statement, "Error checking md5sum of text.");
    // $row = $statement->fetch(\PDO::FETCH_ASSOC);

    // Add a new entry for this upload.
    $statement = $dbh->prepare("insert into texts".
        "(title,md5sum,created_at,uploaded_by, tokenization_in_progress, ". 
        "tokenization_error,updated_at) ".
        "values(:title, :md5sum, :time, :user_id, '0', '0', :time)");
    $statement->execute(array(
        ":md5sum"  => $md5sum, 
        ":title"   => $title,
        ":time"    => curDateTime(),
        ":user_id" => $user_id
    ));
    checkForStatementError($dbh, $statement, 
        "Error adding upload information to db.");
    $id = $dbh->lastInsertId();


    $textDirectory = getTextDirectory($md5sum);
    $textContentFile = $textDirectory ."/original.txt";
    $tokenizedFile = $textDirectory ."/tokens.txt";
    $inProcessingLock = $textDirectory ."/.processing";

    // Check if this text already exists.
    if(file_exists($textDirectory) && file_exists($textContentFile)){

        $dbh->commit();

        // If the text hasn't been tokenized or is being tokenized but stalled
        // out, mark it as needing to be processed.
        $needsProcessing = !file_exists($tokenizedFile) && 
            (!file_exists($inProcessingLock) || 
             time() - filetime($inProcessingLock) > 10);
        return [getTextMetadata($id), $needsProcessing];


    } else {


        // Make the directory rwxrwx--- for user:group www-data:www-data.
        if(!mkdir($textDirectory, 0770, true)){
            $dbh->rollBack();
            error("Could not create a directory for the new text.");
        } else {
            chmod($textDirectory, 0770);
            // chmod($CONFIG->text_storage, 0770);
            // chmod($CONFIG->text_storage ."/$md5sum", 0770);
            if(!move_uploaded_file($file, $textContentFile)){
                $dbh->rollBack();
                error("Could not move the uploaded file on the server.");
            } else {
                chmod($textContentFile, 0770);
                $dbh->commit();
                return [getTextMetadata($id), true];
            }
        }
    }
    } catch(Exception $e){
        $dbh->rollBack();
        error("Error adding text metadata: ". $e->getMessage(),
            ["In addText($md5sum, $file, $title, $user_id)"]);
    }
}

/**
 * Generates a directory prefix using the first 5 characters of the filename.
 * E.g., the filename "lemons.txt" will have the directory prefix: "l/e/m/o/n".
 * 
 * @param filename The name fo the file.
 * @return The first 5 characters of the filename separated by /s.
 */
function getFilenameDirectoryPrefix($filename) {
    return join("/", preg_split('//', substr($filename, 0, 5), -1, 
        PREG_SPLIT_NO_EMPTY));
}

function getTextDirectory($md5sum){
    global $CONFIG;
    return $CONFIG->text_storage ."/". 
        getFilenameDirectoryPrefix($md5sum) ."/$md5sum";
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
    $text = getTextMetadata($id);

    // TODO This should be annotation specific.
    return getTextDirectory($text["md5sum"]) ."/tokens.json";
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
        $params = [
            ":id" => $id,
            ":updated_at" => curDateTime()
        ];
        $updates = ["updated_at = :updated_at"];

        if($isPublic !== null){
            $params[":is_public"] = boolToString($isPublic);
            array_push($updates, "is_public = :is_public");
        }
        if($title != null){
            $params[":title"] = $title;
            array_push($updates, "title = :title");
        }

        $statement = $dbh->prepare(
            "update texts set ". implode(", ", $updates) . 
                " where id = :id");
        $statement->execute($params);

    } catch(Exception $e){
        error("Error updating text metadata: ". $e->getMessage(),
            ["In updateText($id, $isPublic, $title)"]);
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
                "(text_id, user_id, permission, created_at,updated_at) values ". 
                "(:text_id, :user_id, :permission, :time, :time)");
        $success = $statement->execute([
            ":text_id"    => $textId,
            ":user_id"    => $userId,
            ":permission" => $permission,
            ":time" => curDateTime()
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

?>
