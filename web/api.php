<?php

header('Content-type: application/json');

// Read in the config file.
$CONFIG_FILE = "../conf.json";
$configFD = fopen($CONFIG_FILE, "r") or 
    error("Error reading configuration file.");
// Strip out comments before parsing the config file.
$CONFIG = json_decode(preg_replace("#([ \t]*//[^\n]*(\n|$))|(^\s*$)#", "\n", 
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
$routes = [
    // Get list of processed files
    generateRoute("GET", "#^/texts/?(\?.*)?$#", getTexts),

    // Store text file; send back whether processed or not
    generateRoute("POST", "#^/texts/??$#", postText),

    // Store text file; send back whether processed or not
    generateRoute("GET", "#^/texts/(\d+)/?$#", getText),

    // Get entity list for file
    generateRoute("GET", "#^/texts/(\d+)/entities/?#", getEntities),

    // Updates properties of an entity.
    generateRoute("PATCH", "#^/texts/(\d+)/entities/?#", editEntity),

#     "entities" => array("method" => "POST", "call" => addEntity),

    // Check progress of file
];


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

    // Create texts metadata table.
    $status = $dbh->exec("create table if not exists texts(".
            "id integer primary key autoincrement,".
            "title varchar(256),".
            "md5sum char(16) unique,".
            "processed integer(1),".
            "error integer(1),".
            "uploaded_at datetime,".
            "processed_at datetime,".
            "uploaded_by integer, ".
            "foreign key(uploaded_by) references users(id)".
        ")"
    );
    checkForStatementError($dbh, $status, "Error creating texts table.");

    // Create annotations table.
    $status = $dbh->exec("create table if not exists annotations(".
            "id integer primary key autoincrement,".
            "text_id integer,".
            "user_id integer, ".
            "foreign key(text_id) references texts(id), ".
            "foreign key(user_id) references users(id)".
        ")"
    );
    checkForStatementError($dbh, $status, "Error creating annotations table.");

    // Create entity_groups table.
    $status = $dbh->exec("create table if not exists entity_groups(".
            "id integer primary key autoincrement,".
            "name varchar(45))");
    checkForStatementError($dbh, $status, "Error creating entity_groups table.");

    // Create entities table.
    $status = $dbh->exec("create table if not exists entities(".
            "id integer primary key autoincrement,".
            "entity_group_id integer,".
            "annotation_id integer, ".
            "foreign key(entity_group_id) references entity_groups(id), ".
            "foreign key(annotation_id) references annotations(id)".
        ")"
    );
    checkForStatementError($dbh, $status, "Error creating entities table.");


    // Create entity_locations table.
    $status = $dbh->exec("create table if not exists entity_locations(".
            "id integer primary key autoincrement,".
            "word_offset_start integer,".
            "word_offset_end integer,".
            "entity_id integer, ".
            "foreign key(entity_id) references entities(id)".
        ")"
    );
    checkForStatementError($dbh, $status, "Error creating entity_locations table.");

    // Create entity_interactions table.
    $status = $dbh->exec("create table if not exists entity_interactions(".
            "id integer primary key autoincrement,".
            "entity_a_location integer,".
            "entity_b_location integer,".
            "interaction_desc varchar(255), ".
            "foreign key(entity_a_location) references entity_locations(id), ".
            "foreign key(entity_b_location) references entity_locations(id)".
        ")"
    );
    checkForStatementError($dbh, $status, "Error creating entity_interactions table.");

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
    $startID = getWithDefault($params, "start_id", 1);
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
    $statement = $dbh->prepare("select count(*) from texts");
    checkForStatementError($dbh,$statement,"Error getting number of uploads.");

    $statement->execute();
    $results["upload_count"] = $statement->fetch()[0];

    if($endID >= 1){
        $statement = $dbh->prepare(
            "select * from texts where id between :start_id and :end_id");
            $statement->execute(array(":start_id" => $startID, 
                ":end_id" => $endID));
        } else {
        $statement = $dbh->prepare(
            "select * from texts where id >= :start_id");
            $statement->execute(array(":start_id" => $startID));
        }
    checkForStatementError($dbh,$statement,"Error getting texts.");

    while(($count == -1 || $rowsReturned < $count) 
            && $row = $statement->fetch(PDO::FETCH_ASSOC)){
        array_push($results["texts"], $row);
        $lastID = $row["id"];
        $rowsReturned++;
    }

    $results["row"] = $row;

    $results["end_id"] = $lastID;
    $results["returned_count"] = $rowsReturned;

    return $results;
}

/**
 * Displays the metadata for the texts that have been processed or are
 * currently in process. Returned fields include:
 * 
 *  - success (true/false)
 *  - text (objects of text metadata)
 *      * id
 *      * title
 *      * md5sum
 *      * processed (true/false; false means actively being processed)
 *      * uploaded_at
 *      * processed_at
 *      * uploaded_by
 * 
 * @param path Ignored.
 * @param matches First match (index 1) must be the id of the text to retrieve
 *                metadata for.
 * @param params Ignored.
 */
function getText($path, $matches, $params){
    global $CONFIG;

    if(count($matches) < 2){
        error("Must include the id of the text in URI.");
    }

    $id = $matches[1];
    $dbh = connectToDB();
    $results = array(
        "success" => true
    );

    $statement = $dbh->prepare("select * from texts where id = :id");
    checkForStatementError($dbh,$statement,"Error preparing db statement.");
    $statement->execute(array(":id" => $id));
    checkForStatementError($dbh,$statement,"Error getting text metadata.");

    $row = $statement->fetch(PDO::FETCH_ASSOC);

    if(!$row){
        error("No text with id $id found in the database.");
    }

    $results["text"] = $row;

    if("".$row["processed"] == "1"){
        $filename = $CONFIG->text_storage."/".$row["md5sum"].".ids.json.book";
        $fd = fopen($filename, "r");
        $results["character_info"] = json_decode(fread($fd,filesize($filename)));
        fclose($fd);
    }

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
        "select * from texts where md5sum = :md5sum");
    checkForStatementError($dbh, $statement, 
        "Error preparing md5sum db statement.");
    $statement->execute(array(":md5sum" => $md5sum));
    checkForStatementError($dbh, $statement, "Error checking md5sum of text.");
    $row = $statement->fetch(PDO::FETCH_ASSOC);
    if($row){
        $dbh->rollBack();
        error("This text has already been uploaded.", $row);
    } else {
        $statement = $dbh->prepare("insert into texts".
            "(title,md5sum,processed,error,uploaded_at,processed_at,uploaded_by) ".
            "values(:title, :md5sum, 0, 0, DATETIME('now'), null, null)");
        checkForStatementError($dbh, $statement, 
            "Error preparing upload db statement.");
        $statement->execute(array(
            ":md5sum" => $md5sum, 
            ":title" => $params["title"]
        ));
        checkForStatementError($dbh, $statement, 
            "Error adding upload information to db.");
        $id = $dbh->lastInsertId();

        if(!rename($tmpFile, $CONFIG->text_storage ."/$md5sum.txt")){
            $dbh->rollBack();
            error("Could not move the uploaded file on the server.");
        } else {
            $dbh->commit();

            // Kick off the processing.
            $result = processText($id, $md5sum);

            if($result["success"] === true)
                success("File uploaded and is being processed", 
                    array("id"=>$id, "md5sum"=>$md5sum));
            else
                error("File stored, but not processed.", $result["error"]);
        }
    }
}

/**
 * Sends a request to the text processing server to process the given text.
 * This assumes the server is listening on localhost at the port described by
 * text_processing_port in the configuration file.
 * 
 * @param id The id of the text in the metadata table.
 * @param md5sum The md5sum of the text (used as the base of the filename).
 * @return An associative array with the following keys:
 *      success -- true if the request was received and initial checks cleared,
 *                 false otherwise.
 *      error --  an error message (only if success == false)
 */
function processText($id, $md5sum) {
    global $CONFIG;


    // Open the socket.
    if(!($sock = socket_create(AF_INET, SOCK_STREAM, 0))) {
        $errorcode = socket_last_error();
        $errormsg = socket_strerror($errorcode);
        
        return array("success" => false,
            "error" => "Couldn't create socket: [$errorcode] $errormsg.");
    }

    // Connect to the socket.
    if(!socket_connect($sock, "127.0.0.1", $CONFIG->text_processing_port)) {
        $errorcode = socket_last_error();
        $errormsg = socket_strerror($errorcode);
        
        return array("success" => false,
            "error" => "Could not connect: [$errorcode] $errormsg.");
    }

    $message = "$id\t{$CONFIG->text_storage}\t$md5sum\n";
 
    // Send the request.
    if(!socket_send ($sock, $message, strlen($message), 0)) {
        $errorcode = socket_last_error();
        $errormsg = socket_strerror($errorcode);
         
        return array("success" => false,
            "error" => "Could not connect: [$errorcode] $errormsg.");
    }
     
    // Read the reply from server
    if(socket_recv($sock, $buffer, 2045, MSG_WAITALL) === FALSE)
    {
        $errorcode = socket_last_error();
        $errormsg = socket_strerror($errorcode);
         
        return array("success" => false,
            "error" => "Could not connect: [$errorcode] $errormsg.");
    }

    if($buffer === "success\n")
        return array("success" => true);

    return array("success" => false, "error" => $buffer);
}

/**
 * Generates a route map with three fields:
 *   - method
 *   - pattern
 *   - call
 *  
 * @param method The method to match. All caps.
 * @param pattern The pattern the URI must match (including grouping of ids).
 * @param call The controller to call on a method + pattern match.
 */
function generateRoute($method, $pattern, $call){
    return [
        "method" => $method,
        "pattern" => $pattern,
        "call" => $call
    ];
}

?>