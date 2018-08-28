<?php

header('Content-type: application/json');

// Read in the config file.
$CONFIG_FILE = "../conf.json";
$configFD = fopen($CONFIG_FILE, "r") or 
    error("Error reading configuration file.");
// Strip out comments before parsing the config file.
$CONFIG = json_decode(preg_replace("#[ \t]*//[^\n]*(\n|$)#", "\n", 
    fread($configFD,filesize($CONFIG_FILE))));
fclose($configFD);

$dbh = null;

// Extracts the requested path. Assumes the URI is in the format: 
// .../api.php/<path>, where <path> is what is extracted.
if(isset($_SERVER['REQUEST_URI']))
    $path = preg_replace("#^.*/api.php#", "", $_SERVER['REQUEST_URI']);
else
    $path = "";

// Determine the method. If the request is POST, then there should be a
// "_method" parameter which will hold the method to use (POST, PATCH, or 
// DELETE).
$method = $_SERVER['REQUEST_METHOD'];
if($method === "POST" && key_exists("_method", $_POST)){
    $method = $_POST["_method"];
}

// Available REST routes.
$routes = array(
    // Get list of processed files
    array("pattern"   => "#^/texts/?$#", 
          "method"    => "GET", 
          "call"      => getTexts),

    // Store text file; send back whether processed or not
    array("pattern" => "#^/texts/?$#", 
          "method" => "POST", 
          "call" => postText),

    // Get entity list for file
    array("pattern" => "#^/texts/(\d+)/?#", 
          "method" => "GET", 
          "call" => getEntities),

    array("pattern" => "#^/texts/(\d+)/?#", 
          "method" => "PATCH", 
          "call" => editEntity),

#     "entities" => array("method" => "POST", "call" => addEntity),

    // Check progress of file
);


// Valid requests:
foreach($routes as $route){
    $matches = null;
    if(preg_match($route["pattern"], $path, $matches) > 0 && 
            $method === $route["method"]){

        // Extract parameters.
        $params = null;
        if($method === "GET"){
            $params = $_GET;
        } else {
            $params = $_POST;
        }

        // Call the controller.
        echo json_encode($route["call"]($path, $matches, $params));

        exit();
    }
}

// We've only reached this point if the route wasn't recognized.
error("Route not found: $path.");

/**
 * Dies and prints a JSON object with these fields:
 *   - success (set to false)
 *   - message (the error message passed in as an argument)
 * 
 * @param message The error message to include with the message field.
 * @param additionalData A string or array with additional information in it.
 *                       Optional; defaults to "".
 * @param success Sets the success value; defaults to false.
 */
function error($message, $additionalData="", $success=false){
    die(json_encode(array(
        "success" => $success,
        "message"   => $message,
        "additional_data" => $additionalData
    )));
}

/**
 * An alias for error.
 */
function success($message, $additionalData=""){
    error($message, $additionalData, true);
}

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
        "created_at datetime)"
    );
    checkForStatementError($dbh, $status, "Error creating users table.");

    // Create metadata table.
    $status = $dbh->exec("create table if not exists metadata(".
            "id integer primary key autoincrement,".
            "title varchar(256),".
            "md5sum char(16) unique,".
            "processed integer(1),".
            "uploaded_at datetime,".
            "processed_at datetime,".
            "uploaded_by integer, ".
            "foreign key(uploaded_by) references users(id)".
        ")"
    );
    checkForStatementError($dbh, $status, "Error creating metadata table.");
}

/**
 * @return The value corresponding to the given key if the key exists;
 *         otherwise the default is returned.
 */
function getWithDefault($array, $key, $default){
    if(key_exists($key, $array)){
        return $array[$key];
    }
    return $default;
}

/**
 * Displays the metadata for the texts that have been processed or are
 * currently in process. Returned fields include:
 * 
 *  - success (true/false)
 *  - start_id (the smallest id)
 *  - end_id (the latest id)
 *  - upload_count (the number of texts that have been uploaded)
 *  - returned_count (the number of texts returned)
 *  - request_params (the params issued for this request)
 *  - texts (array of objects)
 *      * id
 *      * title
 *      * md5sum
 *      * processed (true/false; false means actively being processed)
 *      * uploaded_at
 *      * processed_at
 *      * uploaded_by
 * 
 * @param path Ignored.
 * @param matches Ignored.
 * @param params The parameters for the request. Accepted parameters:
 *                  - start_id
 *                  - end_id
 *                  - count (defaults to -1, which means all)
 */
function getTexts($path, $matches, $params){
    $startID = getWithDefault($params, "start_id", 0);
    $endID = getWithDefault($params, "end_id", -1);
    $count = getWithDefault($params, "count", -1);

    $dbh = connectToDB();
    $rowsReturned = 0;
    $lastID = -1;
    $results = array(
        "success" => true,
        "start_id" => $startID,
        "request_params" => $params,
        "texts" => array()
    );

    // Get the number of total uploads.
    $statement = $dbh->prepare("select count(*) from metadata");
    checkForStatementError($dbh,$statement,"Error getting number of uploads.");

    $statement->execute();
    $results["upload_count"] = $statement->fetch()[0];

    if($endID >= 0){
        $statement = $dbh->prepare(
            "select * from metadata where id between :start_id and :end_id");
    } else {
        $statement = $dbh->prepare(
            "select * from metadata where id >= :start_id");
    }
    $statement->execute(array(":start_id" => $startID, ":end_id" => $endID));
    checkForStatementError($dbh,$statement,"Error getting texts.");

    while(($count == -1 || $rowsReturned < $count) 
            && $row = $statement->fetch(PDO::FETCH_ASSOC)){
        array_push($results["texts"], $row);
        $lastID = $row["id"];
        $rowsReturned++;
    }

    $results["end_id"] = $lastID;
    $results["returned_count"] = $rowsReturned;

    return $results;
}

/**
 * Uploads a new text. This will fail if required parameters are missing or
 * if the text exists (based on the md5sum).
 * 
 * @param path Ignored.
 * @param matches Ignored.
 * @param params The request parameters. The following fields are allowed:
 *                  - title (required)
 *                  - file (required)
 */
function postText($path, $matches, $params){
    global $CONFIG;

    if(!key_exists("title", $params) or !key_exists("file", $_FILES)){
        error("Missing title and/or file parameters.");
    }

    $tmpFile = $_FILES["file"]["tmp_name"];
    $md5sum = md5_file($tmpFile);
    $dbh = connectToDB();

    $dbh->beginTransaction();

    // Check if another file with this signature exists; if not, add the file.
    $statement = $dbh->prepare(
        "select * from metadata where md5sum = :md5sum");
    checkForStatementError($dbh, $statement, 
        "Error preparing md5sum db statement.");
    $statement->execute(array(":md5sum" => $md5sum));
    checkForStatementError($dbh, $statement, "Error checking md5sum of text.");
    $row = $statement->fetch(PDO::FETCH_ASSOC);
    if($row){
        $dbh->rollBack();
        error("This text has already been uploaded.", $row);
    } else {
        $statement = $dbh->prepare("insert into metadata".
            "(title,md5sum,processed,uploaded_at,processed_at,uploaded_by) ".
            "values(:title, :md5sum, 0, DATETIME('now'), null, null)");
        checkForStatementError($dbh, $statement, 
            "Error preparing upload db statement.");
        $statement->execute(array(
            ":md5sum" => $md5sum, 
            ":title" => $params["title"]
        ));
        checkForStatementError($dbh, $statement, 
            "Error adding upload information to db.");
        $id = $dbh->lastInsertId();

        if(!rename($tmpFile, $CONFIG->text_storage ."/$id.txt")){
            $dbh->rollBack();
            error("Could not move the uploaded file on the server.");
        } else {
            $dbh->commit();
            // Kick off the processing.
            // TODO

            success("File uploaded and is being processed", 
                array("id"=>$id, "md5sum"=>$md5sum));
        }
    }
}



?>