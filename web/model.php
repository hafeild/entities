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
                $dbh = new PDO($CONFIG->dsn, $CONFIG->user, $CONFIG->password);
            } else {
                $dbh = new PDO($CONFIG->dsn);
            }

            // Raise exceptions when errors are encountered.
            $dbh->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            createTables($dbh);
        } catch (PDOException $e) {
            error("Connection failed: ". $e->getMessage() . 
                "; dsn: ". $CONFIG->dsn);
        }
    }
    return $dbh;
}

/**
 * Creates database tables that don't exist.
 */
function createTables($dbh){

    // Create users table.
    $status = $dbh->exec("create table if not exists users(".
        "id integer primary key autoincrement,".
        "username varchar(50),".
        "password varchar(255),".
        "auth_token varchar(100),".
        "created_at datetime)"
    );
    checkForStatementError($dbh, $status, "Error creating users table.");

    // Create texts metadata table.
    $status = $dbh->exec("create table if not exists texts(".
            "id integer primary key autoincrement,".
            "title varchar(256),".
            "md5sum char(16) unique,".
            "uploaded_at datetime,".
            "uploaded_by integer, ".
            "foreign key(uploaded_by) references users(id)".
        ")"
    );
    checkForStatementError($dbh, $status, "Error creating texts table.");

    connectToAnnotationDB();


    // // Create annotations table.
    // $status = $dbh->exec("create table if not exists annotations(".
    //         "id integer primary key autoincrement,".
    //         "text_id integer,".
    //         "user_id integer, ".
    //         "foreign key(text_id) references texts(id), ".
    //         "foreign key(user_id) references users(id)".
    //     ")"
    // );
    // checkForStatementError($dbh, $status, "Error creating annotations table.");

    // // Create entity_groups table.
    // $status = $dbh->exec("create table if not exists entity_groups(".
    //         "id integer primary key autoincrement,".
    //         "name varchar(45))");
    // checkForStatementError($dbh, $status, "Error creating entity_groups table.");

    // // Create entities table.
    // $status = $dbh->exec("create table if not exists entities(".
    //         "id integer primary key autoincrement,".
    //         "entity_group_id integer,".
    //         "annotation_id integer, ".
    //         "foreign key(entity_group_id) references entity_groups(id), ".
    //         "foreign key(annotation_id) references annotations(id)".
    //     ")"
    // );
    // checkForStatementError($dbh, $status, "Error creating entities table.");


    // // Create entity_locations table.
    // $status = $dbh->exec("create table if not exists entity_locations(".
    //         "id integer primary key autoincrement,".
    //         "word_offset_start integer,".
    //         "word_offset_end integer,".
    //         "entity_id integer, ".
    //         "foreign key(entity_id) references entities(id)".
    //     ")"
    // );
    // checkForStatementError($dbh, $status, "Error creating entity_locations table.");

    // // Create entity_interactions table.
    // $status = $dbh->exec("create table if not exists entity_interactions(".
    //         "id integer primary key autoincrement,".
    //         "entity_a_location integer,".
    //         "entity_b_location integer,".
    //         "interaction_desc varchar(255), ".
    //         "foreign key(entity_a_location) references entity_locations(id), ".
    //         "foreign key(entity_b_location) references entity_locations(id)".
    //     ")"
    // );
    // checkForStatementError($dbh, $status, "Error creating entity_interactions table.");
}

/**
 * Extracts the metadata for the text with the given id from the database. 
 * 
 * @param id The id of the text to fetch.
 * @return An associative array of book metadata with these fields:
 *      * id
 *      * title
 *      * md5sum
 *      * processed (true/false; false means actively being processed)
 *      * uploaded_at
 *      * processed_at
 *      * uploaded_by
 *      * uploaded_by_username
 */
function getTextMetadata($id){
    $dbh = connectToDB();

    $statement = $dbh->prepare("select texts.*, username as ". 
        "uploaded_by_username from texts join users where texts.id = :id and ". 
        "users.id = texts.uploaded_by");
    checkForStatementError($dbh,$statement,"Error preparing db statement.");
    $statement->execute([":id" => $id]);
    checkForStatementError($dbh,$statement,"Error getting text metadata.");

    return $statement->fetch(PDO::FETCH_ASSOC);
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
function getOriginalAnnotation($id){
    global $CONFIG;

    $results = [];

    $row = getTextMetadata($id);
    if(!$row){
        error("No text with id $id found in the database.");
    }
    $results["text"] = $row;

    if($row["processed"] == 1){
        //$filename = $CONFIG->text_storage."/".$row["md5sum"].".ids.json.book";
        $filename = $CONFIG->text_storage."/".$row["md5sum"].".entities.json";
        $fd = fopen($filename, "r");
        $results["annotation"] = json_decode(fread($fd,filesize($filename)));
        fclose($fd);
    }

    return $results;
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
        die("There was an error saving to the database: ". $e->getMessage());
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
        die("There was an error reading from the database: ". $e->getMessage());
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
        die("There was an error reading from the database: ". $e->getMessage());
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
        die("There was an error updating the database: ". $e->getMessage());
    }
}

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
            "(title,md5sum,uploaded_at,uploaded_by) ".
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

        if(!move_uploaded_file($file, $CONFIG->text_storage ."/$md5sum.txt")){
            $dbh->rollBack();
            error("Could not move the uploaded file on the server.");
        } else {
            $dbh->commit();
            return getTextMetadata($id);
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

    try {
        $textInfo = getTextMetadata($id);
        $md5sum = $textInfo["md5sum"];
        return $CONFIG->text_storage ."/$md5sum.txt";
    } catch(PDOException $e){
        die("There was an error reading from the database: ". $e->getMessage());
    }
}