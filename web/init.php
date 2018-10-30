<?php
// File:    init.php
// Author:  Hank Feild
// Date:    10-Oct-2018
// Purpose: Holds cross-file helpers and parses the config file. 

// Read in the config file.
$CONFIG_FILE = "../conf.json";
$configFD = fopen($CONFIG_FILE, "r") or 
    error("Error reading configuration file.");
// Strip out comments before parsing the config file.
$CONFIG = json_decode(preg_replace("#([ \t]*//[^\n]*(\n|$))|(^\s*$)#", "\n", 
    fread($configFD,filesize($CONFIG_FILE))));
fclose($configFD);


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
 * @return The value corresponding to the given key if the key exists;
 *         otherwise the default is returned.
 */
function getWithDefault($array, $key, $default){
    if(key_exists($key, $array)){
        return $array[$key];
    }
    return $default;
}