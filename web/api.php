<?php
// File:    api.php
// Author:  Hank Feild
// Date:    Sep. 2018
// Purpose: Handles routing for text annotation API. 

header('Content-type: application/json');

require_once("init.php");
require_once("model.php");
require_once("model-annotations-sql.php");
require_once("controllers.php");


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
    controller\generateRoute("GET", "#^/texts/?(\?.*)?$#", controller\getTexts),

    // Store text file; send back whether processed or not
    controller\generateRoute("POST", "#^/texts/??$#", controller\postText),

    // Store text file; send back whether processed or not
    controller\generateRoute("GET", "#^/texts/(\d+)/?$#", controller\getText),

    // Get entity list for file
    controller\generateRoute("GET", "#^/texts/(\d+)/entities/?#", getEntities),

    // Updates properties of an entity.
    //generateRoute("PATCH", "#^/texts/(\d+)/entities/?#", editEntity),
    controller\generateRoute("PATCH", "#^/annotations/(\d+)/entities/(\d+)/?#", editEntity),
    controller\generateRoute("PATCH", "#^/annotations/(\d+)/?#", controller\editAnnotation),

    // Adds a new annotation.
    controller\generateRoute("POST", "#^/texts/(\d+)/annotations/?$#", controller\postAnnotation),

    // Gets a list of all annotations.
    controller\generateRoute("GET", "#^/annotations/?$#", controller\getAnnotations),

    // Retrieves the requested annotation.
    controller\generateRoute("GET", "#^/annotations/(\d+)/?$#", controller\getAnnotation)

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




?>