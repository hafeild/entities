<?php
// File:    account.php
// Author:  Hank Feild
// Date:    Nov. 2018
// Purpose: Handles signing up, logging in, and logging out.

require_once("init.php");
require_once("model.php");

// Maps actions to the functions that will carry them out.
$ACTION_MAP = array(
    "signup"        => "signup", 
    "login"         => "login", 
    "logout"        => "logout"
);

// Call the correct action.
if(array_key_exists("action", $_POST) && 
        array_key_exists($_POST["action"], $ACTION_MAP)){
    $ACTION_MAP[$_POST["action"]]($_POST);
} elseif($loggedInUser == null){
    redirectToLogin();
}

/**
 * Signs the user up. Requires that $data has the following keys:
 *  - username
 *  - password
 */
function signup($data){
    logout($data, false);

    // Make sure their passwords match.
    if($data["password"] != $data["password2"]){
        redirectToSignup("Make sure your passwords match.");
    }

    // Make sure the username is okay.
    $user = getUserInfo($data["username"]);
    if($user != null){
        redirectToSignup("That username is taken. Try a different one.");
    }

    // Add the user.
    addNewUser($data["username"], 
        password_hash($data["password"], PASSWORD_BCRYPT));

    // Redirect them to the login page.
    redirectToLogin("", "Account created! Now log in.");
}

/**
 * Logs the user in. Requires that $data has the following keys:
 *  - username
 *  - password
 */
function login($data){
    global $user;
    logout($data, false);

    // Authenticate the user.
    $user = getUserInfo($data["username"]);
    if(!password_verify($data["password"], $user["password"])){
        redirectToLogin("Invalid username or password.");
    }

    // Generate an authentication token.
    $authToken = bin2hex(random_bytes(25));
    setUserAuthToken($user['id'], $authToken);
    if(array_key_exists("remember-me", $data))
        setcookie("WEI", $authToken, time()+60*60*24*14); // 2 weeks.
    else
        setcookie("WEI", $authToken);

    redirectToApp();
}

/**
 * Logs the user out.
 */
function logout($data, $redirect=true){
    global $user;

    if($user != null){
        setUserAuthToken($user['id'], "");
        setcookie("WEI", "", time() - 3600);
    }

    if($redirect)
        redirectToLogin();
}


/**
 * If no user is logged in, redirects to the login page.
 */
function bootUserIfNotLoggedIn(){
    global $user;
    if($user == null){
        redirectToLogin();
    }
}

/**
 * Redirects to the login page, adding in provided errors or messages.
 */
function redirectToLogin($error="", $message="") {
    redirectToPage("login.html", $error, $message);
}

/**
 * Redirects to the signup page, adding in provided errors or messages.
 */
function redirectToSignup($error="", $message="") {
    redirectToPage("signup.html", $error, $message);
}

/**
 * Redirects to the main app page, adding in provided errors or messages.
 */
function redirectToApp($error="", $message="") {
    redirectToPage("/", $error, $message);
}

/**
 * Redirects to the given page, adding in provided errors or messages.
 */
function redirectToPage($page, $error="", $message="") {
    $params = "";
    if($error != "" || $message != ""){
        $params = "?";
        if($error != "")
            $params .= "error=". rawurlencode($error) ."&";
        if($message != "")
            $params .="message=". rawurlencode($message);
    }
    echo '
    <!DOCTYPE html>
    <html>
    <head>
        <meta http-equiv="refresh" content="0; url='. $page . $params .'" />
    </head>
    </html>
    <html>
    ';
    exit();
}


?>