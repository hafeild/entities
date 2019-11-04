<?php
// File:    users.php
// Author:  Hank Feild
// Date:    10-Oct-2018
// Purpose: Handles model operations for users.


/////////////////////////////////
// User control.
/////////////////////////////////

/**
 * Saves the data for the given username. 
 * 
 * @param username The username.
 * @param password The password hash for the user.
 */
function addNewUser($username, $password){
    $dbh =  connectToDB();

    try {
        $statement = $dbh->prepare(
            "insert into users(username, password, created_at, updated_at) ".
            "values(:username, :password, :time, :time)");

        $success = $statement->execute(array(
            ":username" => $username, 
            ":password" => $password,
            ":time"     => curDateTime()
        ));
    } catch(PDOException $e){
        error("There was an error saving to the database: ". $e->getMessage());
    }
}

/**
 * Retrieves data for the given username. 
 * 
 * @param username The username to lookup.
 * @return The data associated with the given username, or null if the username
 *         doesn't exist. The returned data is an associative array with these
 *         fields:
 *           - id
 *           - username
 *           - password
 *           - auth_token
 */
function getUserInfo($username){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "select * from users where username = :username");
        $success = $statement->execute(array(
            ":username" => $username));
           
        return $statement->fetch(PDO::FETCH_ASSOC);
    } catch(PDOException $e){
        error("There was an error reading from the database: ". $e->getMessage());
    }
}

/**
 * Retrieves data for the given auth token. 
 * 
 * @param auth_token The auth token to look the user up by.
 * @return The data associated with the given username, or null if the username
 *         doesn't exist. The returned data is an associative array with these
 *         fields:
 *           - id
 *           - username
 *           - password
 *           - auth_token
 */
function getUserInfoByAuthToken($auth_token){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "select * from users where auth_token = :auth_token");
        $success = $statement->execute(array(
            ":auth_token" => $auth_token));
           
        return $statement->fetch(PDO::FETCH_ASSOC);
    } catch(PDOException $e){
        error("There was an error reading from the database: ". 
            $e->getMessage());
    }
}

/**
 * Retrieves data for the given auth token. 
 * 
 * @param userId The id of the user.
 * @param authToken The auth token to assign the user.
 */
function setUserAuthToken($userId, $authToken){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "update users set auth_token = :auth_token ".
                "where id = :user_id");
        $success = $statement->execute(array(
            ":user_id"    => $userId,
            ":auth_token" => $authToken));
    } catch(PDOException $e){
        error("There was an error updating the database: ". $e->getMessage());
    }
}


?>
