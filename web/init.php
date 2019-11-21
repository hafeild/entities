<?php
// File:    init.php
// Author:  Hank Feild
// Date:    10-Oct-2018
// Purpose: Holds cross-file helpers and parses the config file. 

require_once("controllers.php");

// Read in the config file.
$CONFIG_FILE = __DIR__ ."/../config/settings.jsonc";
$configFD = fopen($CONFIG_FILE, "r") or 
    error("Error reading configuration file.");
// Strip out comments before parsing the config file.
$CONFIG = json_decode(preg_replace("#(^[ \t]*//.*$)|(^\s*$)#m", "\n", 
    fread($configFD,filesize($CONFIG_FILE))));
fclose($configFD);

require_once(__DIR__ ."/models/model-init.php");


// Current user data.
$user = null;

// Get user credentials (if currently logged in).
if(array_key_exists("WEI", $_COOKIE)){
    if($_COOKIE["WEI"] != ""){
        $user = getUserInfoByAuthToken($_COOKIE["WEI"]);
    }
}



// Annotation methods and their associated labels.
$validMethods = [
    "manual"             => ["automatic" => false, "root_only" => false], 
    "unannotated"        => ["automatic" => false, "root_only" => false],
    "tie-window"         => ["automatic" => true,  "root_only" => false],
    "booknlp"            => ["automatic" => true,  "root_only" => true],
    "booknlp+tie-window" => ["automatic" => true,  "root_only" => true]
];

/**
 * Determines the label to give to an annotation. Includes pertinent information
 * about the method and arguments to the method.
 * 
 * @param method The method of annotation (e.g., manual, booknlp, etc.).
 * @param args Additional arguments for the method (e.g., n for tie-window).
 * @return The label to give the annotation.
 */
function generateAnnotationLabel($method, $args){
    $label = "";
    if($method == "manual")
        $label = $args["label"];
    elseif($method == "booknlp")
        $label = "BookNLP v1";
    elseif($method == "booknlp+tie-window")
        $label = "BookNLP v1 + Window-based Ties v1 (n=". 
            htmlentities($args["n"]) . ")";
    elseif($method == "unannotated")
        $label = "Blank slate";
    return $label;
}

/**
 * Determines the metadata for an annotation. Includes pertinent information
 * about the method and arguments to the method.
 * 
 * @param method The method of annotation (e.g., manual, booknlp, etc.).
 * @param args Additional arguments for the method (e.g., n for tie-window).
 * @return The metadata for the annotation; may include the following fields:
 *          - entity_extraction
 *              * algorithm
 *              * version
 *              * parameters
 *          - tie_extraction
 *              * algorithm
 *              * version
 *              * parameters
 *                  - n
 */
function generateAnnotationMethodMetadata($method, $args){
    // $data = [];
    if($method == "manual")
        $data = [];
    elseif($method == "booknlp")
        $data = [
            "entity_extraction" => ["BookNLP", "1.0"]
        ];
    elseif($method == "booknlp+tie-window")
        $data = [
            "entity_extraction" => [
                "algorithm" => "BookNLP", 
                "version" => "1.0",
                "parameters" => []
            ],
            "tie_extraction" => [
                "algorithm" => "Window", 
                "version" => "1.0", 
                "parameters" => [
                    "n" => htmlentities($args["n"])
                ]
            ]
        ];
    elseif($method == "tie-window")
        $data = [
            "tie_extraction" => [
                "algorithm" => "Window", 
                "version" => "1.0", 
                "parameters" => [
                    "n" => $args["n"]
                ]
            ]
        ];
    elseif($method == "unannotated")
        $data = [];
    return json_encode($data, JSON_FORCE_OBJECT);
}


// Supported text/annotation processors.
$validProcessors = [
    "booknlp" => 1,
    "token"   => 1,
    "tie-window" => 1
];


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
    global $format;

    $data = [
        "success" => $success,
        "message"   => $message,
        "additional_data" => $additionalData
    ];

    if($format == "json"){
        // JSON
        die(json_encode($data));
    } else {
        // HTML
        if($success)
            Controllers::render("Success", "views/success.php", $data);
        else 
            Controllers::render("Error", "views/error.php", $data);
        exit();
    }
}

/**
 * An alias for error.
 */
function success($message, $additionalData=""){
    error($message, $additionalData, true);
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
 * Checks if the user is logged in; if not, an error is generated in the 
 * appropriate format (JSON or HTML).
 */
function confirmUserLoggedIn(){
    global $user;

    if($user == null){
        error("Must be logged in to add a text.");
    }
}

/**
 * Prints a time in the format:
 * 
 * Jan. 15, 2019 at 5:32 pm
 * 
 * @param timestamp A timestamp in a normal timestamp format (one acceptable by 
 *                  date_format). E.g., YYYY-MM-DD HH:MM:SS:ssss +HH:MM.
 */
function prettyPrintTime($timestamp){
    return date_format(date_create($timestamp), 'M. j, Y \a\t g:ia');
}