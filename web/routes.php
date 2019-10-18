<?php
// File: routes.php
// Author: Hank Feild
// Date: 2019-05-23 (modified from Sep 2018)
// Purpose: Routes all JSON and HTML traffic.

require_once("controllers.php");
require_once("init.php");
require_once("model.php");
require_once("model-annotations-sql.php");
require_once("permissions.php");


// Extracts the requested path. Assumes the URI is in the format: 
// .../routes.php/<path>, where <path> is what is extracted.
if(isset($_SERVER['REQUEST_URI'])){
#    $path = preg_replace("#^(/routes.php)?/#", "", $_SERVER['REQUEST_URI']);
    $path = preg_replace("#^(/json)?/#", "", $_SERVER['REQUEST_URI']);
    $path = preg_replace("#\?.*$#", "", $path);
} else {
    $path = "";
}
$pathNoArguments = preg_replace("#\?.*$#", "", $path);

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
    Controllers::generateRoute(
        "GET", 
        "#^texts/?(\?.*)?$#", 
        'Controllers::getTexts'),

    // Store text file; send back whether processed or not
    Controllers::generateRoute(
        "POST", 
        "#^texts/??$#", 
        'Controllers::postText'),

    // Retrieve info about a specific text.
    Controllers::generateRoute(
        "GET", 
        "#^texts/(\d+)/?$#", 
        'Controllers::getText'),

    // Get entity list for file
    Controllers::generateRoute(
        "GET", 
        "#^texts/(\d+)/entities/?#", 
        'getEntities'),

    // Updates properties of an entity.
    //generateRoute("PATCH", "#^/texts/(\d+)/entities/?#", 'editEntity'),
    Controllers::generateRoute(
        "PATCH", 
        "#^annotations/(\d+)/entities/(\d+)/?#", 
        'editEntity'),
    Controllers::generateRoute(
        "PATCH", 
        "#^annotations/(\d+)/?#", 
        'Controllers::editAnnotation'),

    // Adds a new annotation.
    Controllers::generateRoute(
        "POST", 
        "#^texts/(\d+)/annotations/(\d+)/?$#", 
        'Controllers::postAnnotation'),

    // Gets a list of all annotations.
    Controllers::generateRoute(
        "GET", 
        "#^annotations/?$#", 
        'Controllers::getAnnotations'),
    Controllers::generateRoute(
        "GET", 
        "#^texts/(\d+)/annotations/?$#", 
        'Controllers::getAnnotations'),

    // Retrieves the requested annotation.
    Controllers::generateRoute(
        "GET", 
        "#^annotations/(\d+)/?$#", 
        'Controllers::getAnnotation'),
    Controllers::generateRoute(
        "GET", 
        "#^texts/\d+/annotations/(\d+)/?$#", 
        'Controllers::getAnnotation'),

    Controllers::generateRoute(
        "PATCH", 
        "#^texts/(\d+)?#", 
        'Controllers:editText'),

    //////////////////////////////////////////////
    // Text permissions.
    ///////////////
    // Add a new permission.
    Controllers::generateRoute(
        "POST",
        "#^texts/(\d+)/permissions#",
        "Controllers::postTextPermission"
    ),

    // Modify an existing permission.
    Controllers::generateRoute(
        "PATCH",
        "#^texts/(\d+)/permissions/(\d+)#",
        "Controllers::patchTextPermission"
    ),

    // Delete a permission.
    Controllers::generateRoute(
        "DELETE",
        "#^texts/(\d+)/permissions/(\d+)#",
        "Controllers::deleteTextPermission"
    ),

    //////////////////////////////////////////////
    // Annotation permissions.
    ///////////////
    // Add a new permission.
    Controllers::generateRoute(
        "POST",
        "#^annotations/(\d+)/permissions#",
        "Controllers::postAnnotationPermission"
    ),

    // Modify an existing permission.
    Controllers::generateRoute(
        "PATCH",
        "#^annotations/(\d+)/permissions/(\d+)#",
        "Controllers::patchAnnotationPermission"
    ),

    // Delete a permission.
    Controllers::generateRoute(
        "DELETE",
        "#^annotations/(\d+)/permissions/(\d+)#",
        "Controllers::deleteAnnotationPermission"
    )


#     "entities" => array("method" => "POST", "call" => addEntity),

    // Check progress of file
];

// echo "Path: $path<br>\n";

if($path == ""){
    $path = "texts";
} elseif(file_exists($pathNoArguments)){
    return false;
}

// Check what response format is being requested.
if(preg_match("#^/json/#", $_SERVER['REQUEST_URI']) === 1){
    header('Content-type: application/json; charset=utf-8');
    $format = "json";
} else {
    // header('Content-type: text/html; charset=utf-8');
    $format = "html";
}

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
        if($format == "json"){
            echo json_encode($route["call"]($path, $matches, $params, $format));
        } else {
            $route["call"]($path, $matches, $params, $format);
        }

        exit();
    }
}

// We've only reached this point if the route wasn't recognized.
error("Route not found: $path.");

?>
