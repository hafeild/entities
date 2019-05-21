<?php

class Controllers {

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
public static function getTexts($path, $matches, $params){
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
            && $row = $statement->fetch(\PDO::FETCH_ASSOC)){
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
 *  - annotation
 *      * entities
 *      * groups
 *      * interactions
 *      * locations
 * 
 * @param path Ignored.
 * @param matches First match (index 1) must be the id of the text to retrieve
 *                metadata for.
 * @param params Ignored.
 */
public static function getText($path, $matches, $params){
    global $CONFIG;

    if(count($matches) < 2){
        error("Must include the id of the text in URI.");
    }

    $id = $matches[1];

    $results = getOriginalAnnotation($id);
    $results["success"] = true;

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
public static function postText($path, $matches, $params){
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
    $row = $statement->fetch(\PDO::FETCH_ASSOC);
    if($row){
        $dbh->rollBack();
        error("This text has already been uploaded.", $row);
    } else {
        $statement = $dbh->prepare("insert into texts".
            "(title,md5sum,processed,error,uploaded_at,processed_at,uploaded_by) ".
            "values(:title, :md5sum, 0, 0, :time, null, null)");
        checkForStatementError($dbh, $statement, 
            "Error preparing upload db statement.");
        $statement->execute(array(
            ":md5sum" => $md5sum, 
            ":title"  => $params["title"],
            ":time"   => curDateTime()
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
public static function processText($id, $md5sum) {
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
 * Post a new annotation by copying the processed annotation on disk over to
 * the database. Returns the following 
 * 
 *      - success (true or false)
 *      - message (if error encountered)
 *      - additional_data (if error encountered)
 *      - id (id of new annotation)
 * 
 * @param path Ignored.
 * @param matches First match should be the text id.
 * @param params The request parameters. Ignored.
 */
public static function postAnnotation($path, $matches, $params){
    global $user;

    if(count($matches) < 2){
        error("Must include the id of the text in URI.");
    }

    $textId = $matches[1];

    // Lookup text data.
    $textData = getOriginalAnnotation($textId);

    $id = addAnnotation($user["user_id"], $textId, $textData["annotation"]);

    return [
        "success" => true,
        "id" => $id
    ];
}

/**
 * Retrieves metadata about all of the annotations in the database. The 
 * returned object looks like this:
 *      - success (true)
 *      - annotations (list of objects, each with the following fields)
 *          * annotation_id
 *          * title
 *          * text_id
 *          * username (owner)
 *          * user id  (owner)
 * 
 * @param path Ignored.
 * @param matches Ignored.
 * @param params The request parameters. Ignored.
 */
public static function getAnnotations($path, $matches, $params){
    $annotations = lookupAnnotations();

    return [
        "success" => true,
        "annotations" => $annotations
    ];
}

/**
 * Retrieves the annotation with the given id:
 *      - success (true)
 *      - annotation_data
 *          * annotation_id
 *          * title
 *          * text_id
 *          * username (owner)
 *          * user id  (owner)
 *          * annotation
 *              - entities
 *              - groups
 *              - interactions
 *              - locations
 * 
 * @param path Ignored.
 * @param matches First group should contain the annotation id.
 * @param params The request parameters. Ignored.
 */
public static function getAnnotation($path, $matches, $params){
    if(count($matches) < 2){
        error("Must include the id of the annotation in URI.");
    }

    $annotations = lookupAnnotation($matches[1]);

    return [
        "success" => true,
        "annotation_data" => $annotations
    ];
}


/**
 * Updates the annotation with the given id, and returns:
 *      - success (true or false)
 *      - message (if error encountered)
 *      - additional_data (if error encountered)
 * 
 * @param path Ignored.
 * @param matches First group should contain the annotation id.
 * @param params The request parameters. Should contain a JSON string under
 *               "data" with the following structure:
 * 
 *       - entities
 *          <entityId>: {name, group_id}
 *       - groups
 *          <groupId>: {name}
 *       - locations
 *          <locationId>: {start, end, entity_id}
 *       - interactions
 *          <interactionId>: {locations, label}
 */
public static function editAnnotation($path, $matches, $params){
    global $user;
    if(count($matches) < 2){
        error("Must include the id of the annotation in URI.");
    }

    $validUpdateFields = [
        "entities" => ["name"=>1, "group_id"=>1],
        "groups" => ["name"=>1],
        "locations" => ["start"=>1, "end"=>1, "entity_id"=>1],
        "interactions" => ["locations"=>1, "label"=>1]
    ];

    $data = json_decode($params["data"], true);

    // Update the annotation.
    $updater = function($annotation) use(&$validUpdateFields, &$data){
        foreach($validUpdateFields as $field => $x){
            if(array_key_exists($field, $data)){
                foreach($data[$field] as $id => $val){
                    // Check if this is being deleted.
                    if(array_key_exists($id, $annotation[$field]) && $val == "DELETE"){
                        unset($annotation[$field][$id]);
                    } else {
                        // Check if this is new or updated.
                        if(!array_key_exists($id, $annotation[$field])){
                            $annotation[$field][$id] = [];
                        }
                        foreach($validUpdateFields[$field] as $subfield => $y){
                            if(array_key_exists($subfield, $val)){
                                $annotation[$field][$id][$subfield] =
                                    $val[$subfield];
                            }
                        }
                    }
                }
            }
        }
        return $annotation;
    };

    updateAnnotation($matches[1], $user["user_id"], $updater);

    return [
        "success" => true
    ];
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
public static function generateRoute($method, $pattern, $call){
    return [
        "method" => $method,
        "pattern" => $pattern,
        "call" => $call
    ];
}

}

?>