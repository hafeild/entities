<?php


// Read in the config file.
$CONFIG_FILE = "../conf.json";
$configFD = fopen($CONFIG_FILE, "r") or die("Error reading configuration file.");
$config = json_decode(fread($configFD,filesize($CONFIG_FILE)));
fclose($configFD);


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
if($method === "POST"){
    $method = $_POST['_method'];
}


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
echo json_encode(array("success"=>"false", "error"=>"Route not found: $path."));

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
 * 
 * @param path Ignored.
 * @param matches Ignored.
 * @param params The parameters for the request. Accepted parameters:
 *                  - start_id
 *                  - end_id
 *                  - count (defaults to -1, which means all)
 */
function getTexts($path, $matches, $params){
    return array(
        "success" => true,
        "texts" => array(
            array("id" => 1, "title" => "Test 1"),
            array("id" => 2, "title" => "Test 2")
        )
    );
}


?>