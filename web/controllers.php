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
 *      * created_at
 *      * uploaded_by
 *      * annotation_count
 *      * tokenization_in_progress
 *      * tokenization_error
 *      * is_public
 * 
 * @param path Ignored.
 * @param matches Ignored.
 * @param params The parameters for the request. Accepted parameters:
 *                  - start_id
 *                  - end_id
 *                  - count (defaults to -1, which means all)
 * @param format The format of the response, 'json' or 'html'. 
 * @param data An associative array to pass on to the renderer (for HTML).
 * @param errors An array of errors to display on the rendered page 
 *               (for calling this from, e.g., `postTexts()`).
 * @param messages An array of messages to display on the rendered page 
 *                 (for calling this from, e.g., `postTexts()`).
 * @return If format is 'json', returns an associative array with the fields
 *         outlines above; otherwise, returns nothing.
 */
public static function getTexts($path, $matches, $params, $format,
        $data = [],  $errors = [], $messages = []){
    global $user;

    // Redirect the user to the studies page if they are a study participant.
    if($user){
        $userStudies = getStudies($user["id"]);
        if($userStudies && count($userStudies) > 0){
            Controllers::redirectTo("/studies/");
        }
    }

    $startID = getWithDefault($params, "start_id", 1);
    $endID = getWithDefault($params, "end_id", -1);
    $count = getWithDefault($params, "count", -1);

    $dbh = connectToDB();
    $rowsReturned = 0;
    $lastID = -1;

    $results = $data;
    $results["success"] = true;
    $results["start_id"] = $startID;
    $results["request_params"] = $params;
    $results["texts"] = [];

    // Get the number of total uploads.
    $statement = $dbh->prepare("select count(*) from texts");
    checkForStatementError($dbh,$statement,"Error getting number of uploads.");

    $statement->execute();
    $results["upload_count"] = $statement->fetch()[0];

    try {
        if($endID >= 1){
            $statement = $dbh->prepare(
                "select texts.*, annotation_count, permission from texts ". 
                "join (select text_id,count(text_id) as annotation_count ". 
                "from texts join annotations on text_id = texts.id group by ". 
                "text_id) as A on texts.id = A.text_id ".
                "left join (select text_id, permission from text_permissions ". 
                "where user_id = :user_id) as B on B.text_id = texts.id ".
                "where texts.id between :start_id and :end_id");
            $statement->execute([
                ":start_id" => $startID, 
                ":end_id" => $endID,
                ":user_id" => ($user ==  null ? null : $user.id)
            ]);
        } else {
            $statement = $dbh->prepare(
                // "select * from texts where id >= :start_id");
                "select texts.*, annotation_count, permission from texts ". 
                "join (select text_id,count(text_id) as annotation_count ". 
                "from texts join annotations on text_id = texts.id group by ". 
                "text_id) as A on texts.id = A.text_id ". 
                "left join (select text_id, permission from text_permissions ". 
                "where user_id = :user_id) as B on B.text_id = texts.id ".
                "where texts.id >= :start_id");
            $statement->execute([
                ":start_id" => $startID, 
                ":user_id" => ($user ==  null ? null : $user["id"])
            ]);
        }
    } catch(Exception $e){
        error("Error getting list of texts: ". $e->getMessage());
    }

    while(($count == -1 || $rowsReturned < $count) 
            && $row = $statement->fetch(\PDO::FETCH_ASSOC)){
        array_push($results["texts"], $row);
        $lastID = $row["id"];
        $rowsReturned++;
    }

    $results["row"] = $row;

    $results["end_id"] = $lastID;
    $results["returned_count"] = $rowsReturned;

    if($format == "json"){
        return $results;
    } else {
        Controllers::render("Texts", "views/texts.php", $results, 
            $errors, $messages);
    }
}


/**
 * Displays the metadata for the given text if the current user has permission 
 * to view it. Returned fields include:
 * 
 *  - success (true/false)
 *  - text (objects of text metadata)
 *      * id
 *      * title
 *      * md5sum
 *      * tokenization_in_progress
 *      * tokenization_error
 *      * created_at
 *      * processed_at
 *      * uploaded_by
 *      * is_public
 * 
 * @param path Ignored.
 * @param matches First match (index 1) must be the id of the text to retrieve
 *                metadata for.
 * @param params Ignored.
 * @param format The format of the response, 'json' or 'html' (unsupported).
 * @return If format is 'json', returns an associative array with the fields
 *         outlines above; otherwise, returns nothing.
 */
public static function getText($path, $matches, $params, $format){
    global $CONFIG;

    if(count($matches) < 2){
        error("Must include the id of the text in URI.");
    }
    $id = $matches[1];
    $metadata = getTextMetadata($id);


    // Ensure this text exists.
    if(!$metadata){
        error("We could not find a text with the id $id.");
    }

    // Ensure the user has permission to view this text.
    if(!canViewText($id)){
        error("You do not have permissions to view this text.");
    }

    $results = [
        "success" => true,
        "text" => $metadata 
    ];

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
 * @param format The format of the response, 'json' or 'html' (unsupported).
 * @return If format is 'json', returns an associative array with the fields
 *         outlines above; otherwise, returns nothing.
 */
public static function postText($path, $matches, $params, $format){
    global $CONFIG, $user, $validMethods, $PERMISSIONS;

    if(!key_exists("title", $params) or !key_exists("file", $_FILES)){
        error("Missing title and/or file parameters.");
    }

    confirmUserLoggedIn();

    $tmpFile = $_FILES["file"]["tmp_name"];
    if($tmpFile === "")
        error("No name given to temporary file.", $_FILES["file"]);
    if(!file_exists($tmpFile))
        error("Tmporary file doesn't exist :(");
    $md5sum = md5_file($tmpFile);

    // Create a metadata entry for this text.
    $text = addText($md5sum, $tmpFile, $params["title"], $user["id"]);

    // If this text already existed, but had an error during tokenization, 
    // we don't need to create new permission errors or root annotaitons.
    if($text["tokenization_error"] == "0"){
        // Give the user ownership over the text.
        addTextPermission($user["id"], $text["id"], $PERMISSIONS["OWNER"]);
    
        // Add a root annotation.
        $rootAnnotationId = addAnnotation($user["id"], $text["id"], null, [
            // new stdClass() forces the empty array to show up as an object in the 
            // JSON.
            "last_entity_id"=> 0,
            "last_group_id" => 0,
            "last_tie_id"   => 0,
            "entities"      => new stdClass(), 
            "groups"        => new stdClass(),
            "locations"     => new stdClass(),
            "ties"          => new stdClass()
        ], "unannotated", generateAnnotationMethodMetadata("unannotated", []),
        generateAnnotationLabel("unannotated", []));
    }

    // Kick off the processing.
    $result = Controllers::tokenizeText($text["id"], $md5sum);

    if($result["success"] === true){
        $successMessages = ["The file has been uploaded and processed."];
        $errorMessages = [];
    } else {
        $successMessages = [];
        $errorMessages = ["File stored, but not processed.", $result["error"]];
    }

    $data = [
        "id"=>$text["id"], 
        "md5sum"=>$md5sum
    ];

    if($format == "html"){
        Controllers::getTexts($path, [], [], "html", ["uploaded_text" => $data],
            $errorMessages, $successMessages);
    } else {
        if($result["success"] === true){
            success($successMessages[0], $successMessages[1]);
        } else {
            error($errorMessages[0], $errorMessages[1]);
        }
    }

}

/**
 * Tokenizes a given text.
 * 
 * @param textId The id of the text in the metadata table.
 * @param md5sum The md5sum of the text (used as the base of the filename).
 * @return An associative array with the following keys:
 *      success -- true if the request was received and initial checks cleared,
 *                 false otherwise.
 *      error --  an error message (only if success == false)
 */
public static function tokenizeText($textId, $md5sum) {
    global $CONFIG;

    setTokenizationFlags($textId, true, false);

    $args = join("\t", [
        $textId,                // Id of the text.
        $CONFIG->text_storage  // Storage location.
    ]);

    $response = Controllers::processText($textId, $md5sum, [["token", $args]]);

    if($response["success"] === false){
        // Unsets the progress flag and sets the error flag.
        setTokenizationFlags($textId, false, true);
    }

    return $response;
}


/**
 * Runs an annotation processor to annotate the given text.
 * 
 * @param annotator The annotation processor to use. Current options are:
 *                      * booknlp -- an automatic, entity-only annotator
 *                      * booknlp+tie-window -- adds in window-based tie 
 *                                              extraction
 * @param textId The id of the text in the metadata table.
 * @param md5sum The md5sum of the text (used as the base of the filename).
 * @param annotationId The id of the annotation.
 * @return An associative array with the following keys:
 *      success -- true if the request was received and initial checks cleared,
 *                 false otherwise.
 *      error --  an error message (only if success == false)
 */
public static function runAutomaticAnnotation($annotator, $args, $textId, $md5sum, 
    $annotationId) {
    
    global $CONFIG;

    $bookNLPArgs = join("\t", [
        $textId,                // Id of the text.
        $CONFIG->text_storage,  // Storage location.
        $md5sum,                // Text name.
        $annotationId          // Annotation entry id.
    ]);

    error_log("processing text");

    $processors = [];
    if($annotator == "booknlp")
        $processors = [["booknlp", $bookNLPArgs]];
    elseif($annotator == "booknlp+tie-window")
        $processors = [
            ["booknlp", $bookNLPArgs], 
            ["tie-window", "$annotationId\t{$args["n"]}\tfalse"]
        ];
    elseif($annotator == "tie-window")
        $processors = [
            ["tie-window", "$annotationId\t{$args["n"]}\tfalse"]
        ];
    
    error_log("calling Controllers::processText($textId, $md5sum, ". 
        json_encode($processors) .")");

    // $response = Controllers::processText($textId, $md5sum, $annotator, $args);
    $response = Controllers::processText($textId, $md5sum, $processors);
    error_log("heard back: ". json_encode($response));

    if($response["success"] === false){
        // Unsets the progress flag and sets the error flag.
        setAnnotationFlags($annotationId, false, true);
    }

    return $response;
}

/**
 * Sends a request to the text processing server to process the given text.
 * This assumes the server is listening on localhost at the port described by
 * text_processing_port in the configuration file.
 * 
 * @param textId The id of the text in the metadata table.
 * @param md5sum The md5sum of the text (used as the base of the filename).
 * @param processor A map of processors to call and their arguments. These will
 *                  be sent over, along with their corresponding argument lists,
 *                  in a single request to the processor server and will be
 *                  executed as a pipeline. Processors can be any of the
 *                  following; arguments are specific to each processor (see the
 *                  relevant documentation):
 *                   * token -- basic tokenization
 *                   * booknlp -- an automatic entity-only annotation
 *                   * tie-window -- window-base tie extraction
 * @return An associative array with the following keys:
 *      success -- true if the request was received and initial checks cleared,
 *                 false otherwise.
 *      error --  an error message (only if success == false)
 */
public static function processText($textId, $md5sum, $processors) {

    global $CONFIG, $user, $validProcessors;

    // Check that this is a valid processor.
    foreach($processors as $processor)
        if(!array_key_exists($processor[0], $validProcessors))
            return array("success" => false,
                "error" => "Unrecognized processor: $processor.");

    // Open the socket.
    if(!($sock = socket_create(AF_INET, SOCK_STREAM, 0))) {
        $errorCode = socket_last_error();
        $errorMessage = socket_strerror($errorCode);
        
        return array("success" => false,
            "error" => "Couldn't create socket: [$errorCode] $errorMessage.");
    }

    // Connect to the socket.
    if(!socket_connect($sock, "127.0.0.1", $CONFIG->text_processing_port)) {
        $errorCode = socket_last_error();
        $errorMessage = socket_strerror($errorCode);
        
        return array("success" => false,
            "error" => "Could not connect: [$errorCode] $errorMessage.");
    }

    // Message to send to the automatic annotation service.
    $messageParts = [];
    foreach($processors as $processor){
        array_push($messageParts, join("\t", $processor));
    }
    $message = join("::::", $messageParts) ."\n";
 
    // Send the request.
    if(!socket_send ($sock, $message, strlen($message), 0)) {
        $errorCode = socket_last_error();
        $errorMessage = socket_strerror($errorCode);
         
        return array("success" => false,
            "error" => "Could not connect: [$errorCode] $errorMessage.");
    }
     
    // Read the reply from server
    if(socket_recv($sock, $buffer, 2045, MSG_WAITALL) === FALSE)
    {
        $errorCode = socket_last_error();
        $errorMessage = socket_strerror($errorCode);
         
        return array("success" => false,
            "error" => "Could not connect: [$errorCode] $errorMessage.");
    }

    if($buffer === "success\n")
        return array("success" => true);

    return array("success" => false, "error" => $buffer);
}

/**
 * Post a new annotation by copying the processed annotation on disk over to
 * the database. Returns the following 
 * 
 *   - success (true or false)
 *   - message (if error encountered)
 *   - additional_data (if error encountered)
 *   - id (id of new annotation)
 * 
 * @param path Ignored.
 * @param matches First match should be the text id, second should be the
 *                annotation id to fork.
 * @param params The request parameters. May include these parameters:
 *   - label -- a description of the annotation
 *   - method -- the annotation type, one of: 
 *      * manual (default)
 *      * booknlp -- BookNLP annotation (entities only); can only be forked from
 *                   root
 *      * booknlp+tie-window -- BookNLP entity extraction + Window-based tie 
 *                   extraction; can only be forked from root; should specify 
 *                   the window size (n)
 *      * tie-window -- Window-based tie extraction; should specify window size
 *                      (n)
 *   - n -- the window size for window-based tie extraction (see above)
 * @param format The format of the response, 'json' or 'html' (unsupported). 
 * @return If format is 'json', returns an associative array with the fields
 *         outlines above; otherwise, returns nothing.
 */
public static function postAnnotation($path, $matches, $params, $format){
    global $user;
    global $validMethods;
    global $validProcessors;
    global $PERMISSIONS;


    if(count($matches) < 3){
        error("Must include the ids of the text and annotation in URI.");
    }

    confirmUserLoggedIn();

    $textId = $matches[1];
    $parentAnnotationId = $matches[2];

    // Lookup text data.
    $textData = lookupAnnotation($parentAnnotationId);

    // Confirm that the user has permissions to fork this annotation. Either
    // the annotation must be public or the user must have at least read
    // permissions for it.
    if(!canViewText($matches[1])){
        error("You do not have permission to fork this annotation.");
    }

    $label = htmlentities($params["label"] ?? "");
    $method = htmlentities($params["method"] ?? "manual");

    // Stop if the specified method is invalid.
    if(!array_key_exists($method, $validMethods)){

        $error = "The annotation method '$method' is not supported.";
        if($format == "html"){
            // Reroute to the new annotation.
            Controllers::redirectTo(
                "/texts/$textId/annotations/$parentAnnotationId",
                $error, null);
        } else {
            return [
                "success" => false,
                "message" => $error
            ];
        }
    }

    // Stop if this ia a root-only annotation and it's being forked from a 
    // non-root annotation.
    if($validMethods[$method]["root_only"] && 
            !($textData["parent_annotation_id"] == "" || 
              $textData["parent_annotation_id"] == null)){

        $error =  "This fork method ($method) can only be forked from the ". 
                  "original annotation.";
        if($format == "html"){
            // Reroute to the new annotation.
            Controllers::redirectTo(
                "/texts/$textId/annotations/$parentAnnotationId",
                $error, null);
        } else {
            return [
                "success" => false,
                "message" => $error
            ];
        }
    }

    // Create a manual annotation.
    if($method == "manual"){
        // Create the new annotation.
        $newAnnotationId = addAnnotation($user["id"], $textId, 
            $parentAnnotationId, $textData["annotation"], $method,
            generateAnnotationMethodMetadata($method, []), $label);
        // Give the current user ownership.
        addAnnotationPermission($user["id"], $newAnnotationId, 
            $PERMISSIONS["OWNER"]);

        if($format == "html"){
            // Reroute to the new annotation.
            Controllers::redirectTo(
                "/texts/$textId/annotations/$newAnnotationId",
                null, "Annotation successfully forked!");
        } else {
            return [
                "success" => true,
                "id" => $newAnnotationId
            ];
        }

    // Create an automatic annotation.
    } else if($validMethods[$method]["automatic"]) {
        $args = [];

        if($method == "booknlp+tie-window" || $method == "tie-window")
            $args["n"] = htmlentities($params["n"]);

        // Copy over the annotation of the parent as long as this isn't a root-
        // only annotation.
        $annotation = null;
        if(!$validMethods[$method]["root_only"]){
            $annotation = $textData["annotation"];
        }

        // Create the new annotation.
        $newAnnotationId = addAnnotation($user["id"], $textId, 
            $parentAnnotationId, $annotation, $method, 
            generateAnnotationMethodMetadata($method, $args),
            generateAnnotationLabel($method, $args), 1);
        // Give the current user ownership.
        addAnnotationPermission($user["id"], $newAnnotationId, 
            $PERMISSIONS["OWNER"]);

        $result = Controllers::runAutomaticAnnotation($method, $args, $textId, 
            $textData["text_md5sum"], $newAnnotationId);

        if($result["success"] === true){
            $successMessages = [
                "The file has been uploaded and is being processed."
            ];
            $errorMessages = [];
        } else {
            $successMessages = [];
            $errorMessages = [
                "File stored, but not processed.", 
                $result["error"]
            ];
        }
    
        // $data = [
        //     "id"=>$text["id"], 
        //     "md5sum"=>$md5sum
        // ];
    
        if($format == "html"){
            // Controllers::getTexts($path, [], [], "html", 
            //     ["uploaded_text" => $data],
            //     $errorMessages, $successMessages);

            // TODO add id of new annotation so it can be highlighted.
            Controllers::redirectTo("/texts/$textId/annotations",
                join("<br/>", $errorMessages), join("<br/>", $successMessages));
        } else {
            if($result["success"] === true){
                success($successMessages[0], $successMessages[1]);
            } else {
                error($errorMessages[0], $errorMessages[1]);
            }
        }
    }
}

/**
 * Retrieves metadata about all of the annotations in the database, or just
 * for the text with the match at index 1 in the $matches parameter. If the
 * request format is 'html', the views/annotations.php view is rendered; 
 * the global $data variable is populated with two keys:
 *   - annotations (a list of objects as described below)
 *   - text (an object with information about the text -- only applies if a text
 *           id is provided as the first match in $matches)
 *      * id
 *      * title
 *      * md5sum
 *      * tokenization_in_progress
 *      * tokenization_error
 *      * created_at
 *      * uploaded_by
 *      * uploaded_by_username
 *      * is_public
 *     
 * If 'json', the returned 
 * object looks like this:
 * 
 *   - success (true)
 *   - annotations (list of objects, each with the following fields)
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
 * 
 * 
 * @param path Ignored.
 * @param matches Either the first match is the id of the text to fetch 
 *                annotations for, or if missing, the all annotations are 
 *                retrieved.
 * @param params The request parameters. Ignored.
 * @param format The format of the response, 'json' or 'html'.
 * @return If format is 'json', returns an associative array with the fields
 *         outlines above; otherwise, returns nothing.
 */
public static function getAnnotations($path, $matches, $params, $format){

    // Check if a particular text id was passed in.
    if(count($matches) >= 2){
        $annotations = lookupAnnotations($matches[1]);
        if($format == "html"){
            $text = getTextMetadata($matches[1]);
        }

        // Ensure the user has permission to view this text.
        if(!canViewText($matches[1])){
            error("You do not have permission to view this text or its ". 
                  "annotations.");
        }

    } else {
        $annotations = lookupAnnotations();
        $text = null;
    }

    if($format == "json"){
        return [
            "success" => true,
            "annotations" => $annotations
        ];
    } else {
        Controllers::render("Annotations", "views/annotations.php", 
            [
                "annotations" => $annotations,
                "text" => $text
            ]
        );
    }
}

/**
 * Retrieves the annotation with the given id. If the request format is 'html',
 * the views/annotation.php page is rendered with the annotation_data (see 
 * below) in the global $data variable. If 'json', the following object is
 * returned:
 * 
 *      - success (true)
 *      - annotation_data
 *          * annotation_id
 *          * parent_annotation_id
 *          * text_title
 *          * text_id
 *          * username (owner)
 *          * user_id  (owner)
 *          * method
 *          * label
 *          * created_at
 *          * updated_at
 *          * automated_method_in_progress
 *          * automated_method_error
 *          * annotation
 *              - entities
 *              - groups
 *              - ties
 *              - locations
 * 
 * @param path Ignored.
 * @param matches First group should contain the annotation id.
 * @param params The request parameters. Ignored.
 * @param format The format of the response, 'json' or 'html'.
 * @return If format is 'json', returns an associative array with the fields
 *         outlines above; otherwise, returns nothing.
 */
public static function getAnnotation($path, $matches, $params, $format){
    if(count($matches) < 2){
        error("Must include the id of the annotation in URI.");
    }

    $annotation = lookupAnnotation($matches[1]);

    // Verify this annotation exists.
    if(!$annotation){
        error("We could not find an annotation with id ${matches[1]}.");
    }

    // Verify the user has permission to view this annotation.
    if(!canViewAnnotation($annotation["annotation_id"])){
        error("You do not have permission to view this annotation.");
    }

    if($format == "json"){
        return [
            "success" => true,
            "annotation_data" => $annotation
        ];
    } else {
        $text = getTextMetadata($annotation["text_id"]);
        $text["content_file"] = getTextContentFilename($annotation["text_id"]);
        Controllers::render("Annotations", "views/annotation.php", 
            [
                "annotation" => $annotation,
                "text" => $text,
                "is_study" => false
            ],
            [], [], "annotation-page"
        );
    }
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
 *       - last_entity_id (integer)
 *       - last_group_id (integer)
 *       - last_tie_id (integer)
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
 */
public static function editAnnotation($path, $matches, $params, $format){
    global $user;
    if(count($matches) < 2){
        error("Must include the id of the annotation in URI.");
    }

    $annotationId = $matches[1];
    $annotation = lookupAnnotation($annotationId);

    // Verify this annotation exists.
    if(!$annotation){
        error("We could not find an annotation with id ${matches[1]}.");
    }

    // Verify the user has permission to modify this annotation.
    if(!canModifyAnnotation($annotation["annotation_id"])){
        error("You do not have permission to modify this annotation.");
    }

    $validUpdateFields = [
        "last_entity_id" => 1,
        "last_group_id"  => 1,
        "last_tie_id"    => 1,
        "entities"  => ["name"=>1, "group_id"=>1],
        "groups"    => ["name"=>1],
        "locations" => ["start"=>1, "end"=>1, "entity_id"=>1],
        "ties"      => ["start"=>1, "end"=>1, "source_entity"=>1, 
                        "target_entity"=>1, "label"=>1, "weight"=>1, 
                        "directed"=>1]
    ];

    // Verify that at least one valid update field is present.
    if(!(array_key_exists("data", $params) || 
         array_key_exists("is_public", $params))){

        error("You must specify at least one valid annotation field: 'data' ". 
              "or 'is_public'.");
    }

    $data = null;
    $updater = null;
    $isPublic = array_key_exists("is_public", $params) ? 
        $params["is_public"] == "true" : null;

    // If the annotation JSON is being updated, extract that data and define the
    // updater needed by the annotation model function.
    if(array_key_exists("data", $params)){
        error_log("Updating annotation $annotationId: ${params["data"]}.");
        $data = json_decode($params["data"], true);

        // Update the annotation.
        $updater = function($annotation) use(&$validUpdateFields, &$data){
            foreach($validUpdateFields as $field => $value){
                if(array_key_exists($field, $data)){
                    // Check if this is a top-level data field...
                    if($value === 1){
                        $annotation[$field] = $data[$field];

                    // ...or an object.
                    } else {
                        foreach($data[$field] as $id => $val){
                            // Check if this is being deleted.
                            if(array_key_exists($id, $annotation[$field]) && 
                                $val == "DELETE"){

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
            }
            return $annotation;
        };
    }

    updateAnnotation($annotationId, $user["id"], $updater, $isPublic);

    return [
        "success" => true
    ];
}

/**
 * Updates the text with the given id, and returns:
 *      - success (true or false)
 *      - message (if error encountered)
 *      - additional_data (if error encountered)
 * 
 * @param path Ignored.
 * @param matches First group should contain the annotation id.
 * @param params The request parameters. May include any of these:
 *                  - is_public (true or false)
 *                  - title
 */
public static function editText($path, $matches, $params, $format){
    global $user;

    if(count($matches) < 2){
        error("Must include the id of the text in URI.");
    }

    $textId = $matches[1];

    // Ensure the required parameters were given.
    if(!(array_key_exists("is_public", $params) || 
        array_key_exists("title", $params))){

        error("You must specify at least one attribute to update for this ". 
              "text, either 'is_public' or 'title'.");
    }

    $title = array_key_exists("title", $params) ? 
        htmlentities($params["title"]) : null;
    $isPublic = array_key_exists("is_public", $params) ? 
        $params["is_public"] == "true" : null;

    // Ensure the text exists.
    $textId = $matches[1];
    $text = getTextMetadata($textId);
    if(!$text){
        error("We couldn't find a text with the id $textId.");
    }

    // Ensure the user has owner permission on the text.
    if($isPublic != null && !ownsText($textId)){
        error("You do not have authorization to modify permissions on ". 
              "this text.");
    } else if(!canModifyText($textId)) {
        error("You do not have authormization to modify the metadata of ". 
              "this text.");
    }

    // Make the updates.
    updateText($textId, $isPublic, $title);

    return [
        "success" => true
    ];

}

/**
 * Adds a new permission for the given text. Responds with the following JSON:
 *      - success (true or false)
 *      - message (if error encountered)
 *      - additional_data
 *          * permission_id (id of newly added permission, if successful)
 * 
 * @param path Ignored.
 * @param matches First group should contain the text id.
 * @param params The request parameters. Should contain the following:
 * 
 *       - username (string)
 *       - permission_level (string: "READ", "WRITE", or "OWNER")
 */
public static function postTextPermission($path, $matches, $params, $format) {
    global $user, $PERMISSIONS;

    // Ensure the text id was given.
    if(count($matches) < 2){
        error("Must include the id of the text in URI.");
    }

    // Ensure the required parameters were given.
    if(!array_key_exists("username", $params) || 
        !array_key_exists("permission_level", $params)){

        error("One or both required parameters are missing; requests ". 
              "should include a username and permission_level parameter.");
    }

    $targetUsername = htmlentities($params["username"]);
    $permissionLevel = htmlentities($params["permission_level"]);

    // Ensure the text exists.
    $textId = $matches[1];
    $text = getTextMetadata($textId);
    if(!$text){
        error("We couldn't find a text with the id $textId.");
    }

    // Ensure the user has owner permission on the text.
    if(!ownsText($textId)){
        error("You do not have authorization to modify permissions on ". 
              "this text.");
    }

    // Check that the requested user exists.
    $targetUser = getUserInfo($params["username"]);
    if(!$targetUser){
        error("We couldn't find a user with the username ". 
              "${params["username"]}.");
    }

    // Make sure the user doesn't already have a permission for this text.
    $existingPermission = getTextPermission($targetUser["id"], $textId);
    if($existingPermission){
        error("A permission for user $targetUsername already exists.");
    }

    // Check the permission level is valid.
    if(!array_key_exists($permissionLevel, $PERMISSIONS)){
        error("$permissionLevel is an invalid permission level.");
    }

    // Add new permission.
    $permissionId = addTextPermission($targetUser["id"], $textId, 
        $PERMISSIONS[$permissionLevel]);

    // Send back id of new permission.
    return [
        "success" => true,
        "additional_data" => [
            "permission_id" => $permissionId
        ]
    ];
}

/**
 * Updates an existing text permission. Responds with the following JSON:
 *      - success (true or false)
 *      - message (if error encountered)
 *      - additional_data (if error encountered)
 * 
 * @param path Ignored.
 * @param matches First group should contain the text id, the second the 
 *                permission id.
 * @param params The request parameters. Should contain the following:
 * 
 *       - permission_level (string: "READ", "WRITE", or "OWNER")
 */
public static function patchTextPermission($path, $matches, $params, $format) {
     global $user, $PERMISSIONS;

    // Ensure the text and permission id were given in the URI.
    if(count($matches) < 3){
        error("Must include the id of the text and permission in URI.");
    }

    // Ensure the required parameters were given.
    if(!array_key_exists("permission_level", $params)){
        error("The permission_level parameters is missing.");
    }

    $permissionLevel = htmlentities($params["permission_level"]);

    // Ensure the text exists.
    $textId = $matches[1];
    $text = getTextMetadata($textId);
    if(!$text){
        error("We couldn't find a text with the id $textId.");
    }

    // Ensure the user has owner permission on the text.
    if(!ownsText($textId)){
        error("You do not have authorization to modify permissions on ". 
              "this text.");
    }

    // Make sure the permission exists.
    $permissionId = $matches[2];
    $existingPermission = getTextPermissionById($permissionId);
    if(!$existingPermission){
        error("We couldn't find a permission with id $permissionId.");
    }

    // Check the permission level is valid.
    if(!array_key_exists($permissionLevel, $PERMISSIONS)){
        error("$permissionLevel is an invalid permission level.");
    }

    // Update the permission.
    setTextPermission($permissionId, $PERMISSIONS[$permissionLevel]);

    return [
        "success" => true
    ];
}

/**
 * Removes an existing text permission. Responds with the following JSON:
 *      - success (true or false)
 *      - message (if error encountered)
 *      - additional_data (if error encountered)
 * 
 * @param path Ignored.
 * @param matches First group should contain the text id, the second the 
 *                permission id.
 * @param params Ignored.
 */
public static function deleteTextPermission($path, $matches, $params, $format) {
    // Ensure the text and permission ids were given in the URI.
    if(count($matches) < 3){
        error("Must include the id of the text and permission in URI.");
    }

    // Ensure the text exists.
    $textId = $matches[1];
    $text = getTextMetadata($textId);
    if(!$text){
        error("We couldn't find a text with the id $textId.");
    }

    // Ensure the user has owner permission on the text.
    if(!ownsText($textId)){
        error("You do not have authorization to modify permissions on ". 
              "this text.");
    }

    // Make sure the permission exists.
    $permissionId = $matches[2];
    $existingPermission = getTextPermissionById($permissionId);
    if(!$existingPermission){
        error("We couldn't find a permission with id $permissionId.");
    }


    // Delete the permission.
    deleteTextPermission($permissionId);

    return [
        "success" => true
    ];
}


/**
 * Adds a new permission for the given annotation. Responds with the following 
 * JSON:
 *      - success (true or false)
 *      - message (if error encountered)
 *      - additional_data
 *          * permission_id (id of newly added permission, if successful)
 * 
 * @param path Ignored.
 * @param matches First group should contain the annotaiton id.
 * @param params The request parameters. Should contain the following:
 * 
 *       - username (string)
 *       - permission_level (string: "READ", "WRITE", or "OWNER")
 */
public static function postAnnotationPermission($path, $matches, $params, 
                                                $format) {
     global $PERMISSIONS;

    // Ensure the annotation id was given.
    if(count($matches) < 2){
        error("Must include the id of the annotation in URI.");
    }

    // Ensure the required parameters were given.
    if(!array_key_exists("username", $params) || 
        !array_key_exists("permission_level", $params)){

        error("One or both required parameters are missing; requests ". 
              "should include a username and permission_level parameter.");
    }

    $targetUsername = htmlentities($params["username"]);
    $permissionLevel = htmlentities($params["permission_level"]);

    // Ensure the annotation exists.
    $annotationId = $matches[1];
    $annotation = lookupAnnotation($annotationId);
    if(!$annotation){
        error("We couldn't find an annotation with the id $annotationId.");
    }

    // Ensure the user has owner permission on the annotation.
    if(!ownsAnnotation($annotationId)){
        error("You do not have authorization to modify permissions for ". 
              "this annotation.");
    }

    // Check that the requested user exists.
    $targetUser = getUserInfo($params["username"]);
    if(!$targetUser){
        error("We couldn't find a user with the username ". 
              "${params["username"]}.");
    }

    // Make sure the user doesn't already have a permission for this annotation.
    $existingPermission = getAnnotationPermission(
        $targetUser["id"], $annotationId);
    if($existingPermission){
        error("A permission for user $targetUsername ". 
              "already exists for this annotation.");
    }

    // Check the permission level is valid.
    if(!array_key_exists($permissionLevel, $PERMISSIONS)){
        error("$permissionLevel is an invalid permission level.");
    }

    // Add new permission.
    $permissionId = addAnnotationPermission($targetUser["id"], $annotationId, 
        $PERMISSIONS[$permissionLevel]);

    // Send back id of new permission.
    return [
        "success" => true,
        "additional_data" => [
            "permission_id" => $permissionId
        ]
    ];
}

/**
 * Updates an existing annotation permission. Responds with the following JSON:
 *      - success (true or false)
 *      - message (if error encountered)
 *      - additional_data (if error encountered)
 * 
 * @param path Ignored.
 * @param matches First group should contain the annotation id, the second the 
 *                permission id.
 * @param params The request parameters. Should contain the following:
 * 
 *       - permission_level (string: "READ", "WRITE", or "OWNER")
 */
public static function patchAnnotationPermission($path, $matches, $params, 
                                                 $format) {

     global $user, $PERMISSIONS;

    // Ensure the annotation and permission id were given in the URI.
    if(count($matches) < 3){
        error("Must include the id of the annotation and permission in URI.");
    }

    // Ensure the required parameters were given.
    if(!array_key_exists("permission_level", $params)){
        error("The permission_level parameters is missing.");
    }

    $permissionLevel = htmlentities($params["permission_level"]);

    // Ensure the annotation exists.
    $annotationId = $matches[1];
    $annotation = lookupAnnotation($annotationId);
    if(!$annotation){
        error("We couldn't find an annotation with the id $annotationId.");
    }

    // If this is the root annotation, it cannot be modified.
    if($annotation["parent_annotation_id"] == null){
        error("You cannot make changes to the root annotation for a text; ". 
              "fork it first and make changes to the fork.");
    }

    // Ensure the user has owner permission on the text.
    if(!ownsAnnotation($annotationId)){
        error("You do not have authorization to modify permissions for ". 
              "this annotation.");
    }

    // Make sure the permission exists.
    $permissionId = $matches[2];
    $existingPermission = getAnnotationPermissionById($permissionId);
    if(!$existingPermission){
        error("We couldn't find a permission with id $permissionId.");
    }

    // Check the permission level is valid.
    if(!array_key_exists($permissionLevel, $PERMISSIONS)){
        error("$permissionLevel is an invalid permission level.");
    }

    // Update the permission.
    setAnnotationPermission($permissionId, $PERMISSIONS[$permissionLevel]);

    return [
        "success" => true
    ];
}

/**
 * Removes an existing annotation permission. Responds with the following JSON:
 *      - success (true or false)
 *      - message (if error encountered)
 *      - additional_data (if error encountered)
 * 
 * @param path Ignored.
 * @param matches First group should contain the annotation id, the second the 
 *                permission id.
 * @param params Ignored.
 */
public static function deleteAnnotationPermission($path, $matches, $params, 
                                                  $format) {
    // Ensure the text and permission ids were given in the URI.
    if(count($matches) < 3){
        error("Must include the id of the text and permission in URI.");
    }

    // Ensure the text exists.
    $annotationId = $matches[1];
    $annotation = lookupAnnotation($annotationId);
    if(!$annotation){
        error("We couldn't find an annotation with the id $annotationId.");
    }

    // Ensure the user has owner permission on the annotation.
    if(!ownsAnnotation($annotationId)){
        error("You do not have authorization to modify permissions for ". 
              "this annotation.");
    }

    // Make sure the permission exists.
    $permissionId = $matches[2];
    $existingPermission = getAnnotationPermissionById($permissionId);
    if(!$existingPermission){
        error("We couldn't find a permission with id $permissionId.");
    }


    // Delete the permission.
    deleteAnnotationPermission($permissionId);

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

/**
 * Renders a view using views/master.php as the page wrapper. Several attribute
 * of the view can be set (see below).
 * 
 * @param title_ The text to use in the page title. Globalized as $title.
 * @param view_ The full path to the view template to render. This should be a
 *              PHP or HTML file. E.g., "views/texts.php" will render the
 *              text.php template within the views/master.php page wrapper.
 *              This is globalized as $view.
 * @param data_ Any data needed by the view template. This is globalized as
 *              $data.
 * @param errors_ An array of error messages; Optional, defaults to []. The
 *              master page wrapper has code to handle displaying these. 
 *              Globalized as $errors.
 * @param messages_ An array of non-error messages; Optional, defaults to []. 
 *              the master page wrapper has code to handle displaying these. 
 *              Globalized as $messages.
 * @param contentClasses_ A string with classes to append to the container
 *                          wrapper in views/master.php.
 */
public static function render($title_, $view_, $data_, $errors_=[], 
    $messages_=[], $contentClasses_=""){

    global $title, $view, $data, $errors, $messages;
    $title = $title_;
    $view = $view_;
    $data = $data_;
    $errors = $errors_;
    $messages = $messages_;
    $contentClasses = $contentClasses_;

    require("views/master.php");

}

/**
 * Sends a redirect response with the given URL. As a backup, also emits
 * HTML to refresh to the new URL in the event the user's browser does not
 * respond to the Location header.
 * 
 * @param url The URL to redirect to.
 * @param error An optional error to include embedded in the URL under the
 *              GET parameter 'error'.
 * @param message An optional message to include embedded in the URL under the
 *                GET parameter 'message'.
 */
public static function redirectTo($url, $error=null, $message=null){
    if($error != null || $message != null){
        if(preg_match("/\?/", $url) !== 1){
            $url .= "?";
        }
        if($error != null){
            $url .= "&error=". urlencode($error);
        }

        if($message != null){
            $url .= "&message=". urlencode($message);
        }
    }
    header('Location: '.$url);
    die('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url='. $url .'"></head></html>');
}

////////////////////////////////////////////////////////////////////////////////
// Study controller functions.
////////////////////////////////////////////////////////////////////////////////

/**
 * Loads the study login page.
 * 
 * @param path Ignored.
 * @param matches Ignored.
 * @param params Ignored.
 * @param format Ignored.
 */
public static function studyLogin($path, $matches, $params, $format){
    require("study-login.html");
}

/**
 * Fetches a list of the studies the currently logged in user is associated 
 * with, either as the study homepage or as a JSON list of studies depending on
 * the value of the format parameter. The data structure created to be returned 
 * as JSON or passed on to the view looks like this:
 * 
 *   - success (true/false)
 *   - studies (array of objects, one per study the user is associated with)
 *      * study_id
 *      * participant_id
 *      * name
 *      * begin_at
 *      * end_at
 *      * created_at
 *      * group_id 
 * 
 * @param path Ignored.
 * @param matches Ignored.
 * @param params Ignored.
 * @param format If "html", loads the study homepage. If "json", generates a 
 *               JSON response as described above.
 */
public static function getStudies($path, $matches, $params, $format){
    global $user;

    // Direct logged out visitors to the study login.
    if($user == null) {
        if($format == "html"){
            // Reroute to the new annotation.
            Controllers::redirectTo(
                "/studies/login",
                null, null);
        } else {
            return [
                "success" => false,
                "message" => "You must be logged in to view the requested page."
            ];
        }
    }


    $results = [
        "success" => true,
        "studies" => getStudies($user["id"])
    ];

    if($format == "json"){
        return $results;
    } else {
        Controllers::render("Studies&mdash;EntiTies", "views/studies.php", 
            $results);
    }
}

/**
 * Fetches the tasks for the currently logged in user and study, either as a
 * study page or as a JSON list of tasks depending on
 * the value of the format parameter. The data structure created to be returned 
 * as JSON or passed on to the view looks like this:
 * 
 *   - success (true/false)
 *   - message (if error encountered)
 *   - additional_data
 *   - study
 *      * id
 *      * name
 *      * begin_at
 *      * end_at
 *      * created_at
 *      * group_id 
 *   - steps (list of step objects)
 *      * id
 *      * is_complete
 *      * ordering
 *      * url
 *      * participant_id
 * 
 * @param path Ignored.
 * @param matches The first match should be the study id.
 * @param params Ignored.
 * @param format If "html", loads the study homepage. If "json", generates a 
 *               JSON response as described above.
 */
public static function getStudy($path, $matches, $params, $format){
    global $user;
    if(count($matches) < 1){
        error("Must include the id of the study in URI.");
    }

    $study = getStudy($matches[1]);

    if(!$study){
        error("We cannot find a study with id '${matches[1]}. :-(");
    }

    $results = [
        "success" => true,
        "study" => $study,
        "steps" => getSteps($study["id"], $user["id"])
    ];

    if($format == "json"){
        return $results;
    } else {
        Controllers::render("${study["name"]}&mdash;EntiTies",
            "views/study.php", $results, null, null);
    }
}

/**
 * Marks a study step as completed for the currently logged in user.  The data
 * structure created to be returned as JSON looks like
 * this:
 * 
 *   - success (true/false)
 *   - message (if error encountered)
 *   - additional_data
 * 
 * @param path Ignored.
 * @param matches The first match should be the study id, the second the step 
 *                id.
 * @param params Ignored.
 * @param format If "html", loads the study steps page. If "json", generates a 
 *               JSON response as described above.
 */
public static function markStudyStepCompleted($path, $matches, $params,$format){
    global $user;
    if(count($matches) < 2){
        error("Must include the id of the study and the step in URI.");
    }

    $studyId = $matches[1];
    $stepId = $matches[2];

    // Check that the user is associated with the given study step for this
    // study.
    $participant = getStudyParticipant($user["id"], $studyId);
    if(!$participant){
        error("You do not appear to be associated with study $studyId.");
    }

    $step = getStudyParticipantStep($participant["participant_id"], $stepId);
    if(!$step){
        error("We cannot find a the requested step in the database! ". 
            "(id = $stepId).");
    }

    if($step["completed_at"] != null){
        error("It looks like you completed this step already: ". 
            prettyPrintTime($step["completed_at"]) . ".");
    }
    markStudyStepCompleted($participant["participant_id"], $stepId);

    if($format == "json"){
        return ["success" => true];
    } else {
        Controllers::redirectTo("/studies/$studyId", null, null);
    }
}

/**
 * Marks a study step as started for the currently logged in user.  The data
 * structure created to be returned as JSON looks like
 * this:
 * 
 *   - success (true/false)
 *   - message (if error encountered)
 *   - additional_data
 * 
 * @param path Ignored.
 * @param matches The first match should be the study id, the second the step 
 *                id.
 * @param params Ignored.
 * @param format If "html", loads the study steps page. If "json", generates a 
 *               JSON response as described above.
 */
public static function markStudyStepStarted($path, $matches, $params,$format){
    global $user;
    if(count($matches) < 2){
        error("Must include the id of the study and the step in URI.");
    }

    $studyId = $matches[1];
    $stepId = $matches[2];

    // Check that the user is associated with the given study step for this
    // study.
    $participant = getStudyParticipant($user["id"], $studyId);
    if(!$participant){
        error("You do not appear to be associated with study $studyId.");
    }

    $step = getStudyParticipantStep($participant["participant_id"], $stepId);
    if(!$step){
        error("We cannot find a the requested step in the database! ". 
            "(id = $stepId).");
    }

    if($step["started_at"] != null){
        error("It looks like you started this step already: ". 
            prettyPrintTime($step["started_at"]) . ".");
    }
    markStudyStepStarted($participant["participant_id"], $stepId);

    if($format == "json"){
        return ["success" => true];
    } else {
        Controllers::redirectTo("/studies/", null, null);
    }
}

public static function logStudyData($path, $matches, $params, $format){
    global $user;

    // $studyId = $params
    // $stepId = 
}


/**
 * Retrieves the study step with the given id. If the request format is 'html',
 * the views/annotation.php page is rendered with the associate annotation_data
 * (see below) in the global $data variable, or if the step is a url, a page 
 * refresh is performed. If the format is 'json', the following object is
 * returned:
 * 
 *      - success (true)
 *      - step_data
 *          * participant_id 
 *          * step_id
 *          * started_at
 *          * completed_at
 *          * created_at
 *          * annotation_id
 *          * study_id
 *          * label
 *          * url
 *          * base_annotation_id
 *      - annotation_data (can be null)
 *          * annotation_id
 *          * parent_annotation_id
 *          * text_title
 *          * text_id
 *          * username (owner)
 *          * user_id  (owner)
 *          * method
 *          * label
 *          * created_at
 *          * updated_at
 *          * automated_method_in_progress
 *          * automated_method_error
 *          * annotation
 *              - entities
 *              - groups
 *              - ties
 *              - locations
 * 
 * @param path Ignored.
 * @param matches First group should contain the annotation id.
 * @param params The request parameters. Ignored.
 * @param format The format of the response, 'json' or 'html'.
 * @return If format is 'json', returns an associative array with the fields
 *         outlines above; otherwise, returns nothing.
 */
public static function getStudyStep($path, $matches, $params, $format){
    global $user;

    if(count($matches) < 2){
        error("Must include the id of the study and the step in URI.");
    }

    $studyId = $matches[1];
    $stepId = $matches[2];


    // Check that the user is associated with the given study step for this
    // study.
    $participant = getStudyParticipant($user["id"], $studyId);
    if(!$participant){
        error("You do not appear to be associated with study $studyId.");
    }

    $step = getStudyParticipantStep($participant["participant_id"], $stepId);
    if(!$step){
        error("We cannot find a the requested step in the database! ". 
            "(id = $stepId).");
    }

    $annotation = null;
    if($step["annotation_id"]){
        $annotation = lookupAnnotation($step["annotation_id"]);

        // Verify this annotation exists.
        if(!$annotation){
            error("We could not find an annotation with id ${step["annotation_id"]}.");
        }

        // Verify the user has permission to view this annotation.
        if(!canViewAnnotation($annotation["annotation_id"])){
            error("You do not have permission to view this annotation.");
        }
    }

    if(!$step["started_at"]){
        markStudyStepStarted($step["participant_id"], $stepId);
    }

    if($format == "json"){
        return [
            "success" => true,
            "step_data" => $step,
            "annotation_data" => $annotation
        ];
    } else {
        if($annotation){
            $text = getTextMetadata($annotation["text_id"]);
            $text["content_file"] = getTextContentFilename($annotation["text_id"]);
            Controllers::render("Annotations", "views/annotation.php", 
                [
                    "annotation" => $annotation,
                    "text" => $text,
                    "is_study" => $studyId !== null,
                    "step_data" => $step
                ],
                [], [], "annotation-page"
            );
        } else {
            Controllers::redirectTo($step["url"], null, null);
        }
    }
}


}

?>
