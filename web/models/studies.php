<?php
// File:    studies.php
// Author:  Henry Feild
// Date:    03-Nov-2019
// Purpose: Provides functions that interface with the study-related database
//          tables.


/**
 * Retrieves info about the studies a user is associated with. 
 * 
 * @param userId The id of the user to lookup; if null, the id of the currently  
 *               logged in user is used.
 * @return A list of studies the user is associated with:
 *           - id
 *           - name
 *           - begin_at
 *           - end_at
 *           - created_at
 *           - group_id
 */
function getStudies($userId=null){
    global $user;
    $dbh = connectToDB();

    if($userId == null){
        if(!$user){
            error("Cannot fetch studies withough a user id.");
        }
        $userId = $user["id"];
    } 
    try {
        $statement = $dbh->prepare(
            "select studies.id as id, name, begin_at, end_at, ". 
                "studies.created_at, group_id from study_participants ". 
                "join studies on studies.id = study_id ". 
                "where user_id = :user_id");
        $success = $statement->execute([
            ":user_id" => $userId
        ]);
           
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    } catch(PDOException $e){
        error("There was an error reading study info from the database",
            [$e->getMessage()]);
    }
}

/**
 * Retrieves info about a study. 
 * 
 * @param studyId The id of the study.
 * @return An object with these fields:
 *           - id
 *           - name
 *           - begin_at
 *           - end_at
 *           - created_at
 */
function getStudy($studyId){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "select * from studies where id = :id");
        $success = $statement->execute([
            ":id" => $studyId
        ]);
           
        return $statement->fetch(PDO::FETCH_ASSOC);
    } catch(PDOException $e){
        error("There was an error reading study info from the database",
            [$e->getMessage()]);
    }
}

/**
 * Retrieves the list of steps/tasks for the given study and user. 
 * 
 * @param studyId The id of the study.
 * @param userId The id of the user to lookup; if null, the id of the currently  
 *               logged in user is used.
 * @return Info about the study and the associated steps in the order they are 
 *         assigned for the user:
 *           - study (object with the following fields)
 *              * id
 *              * name
 *              * begin_at
 *              * end_at
 *              * created_at
 *              * group_id
 *           - steps (array of step objects, each with the following fields)
 *              * id
 *              * label
 *              * created_at
 * 
 */
function getSteps($studyId, $userId=null){
    global $user;
    $dbh = connectToDB();

    if($userId == null){
        if(!$user){
            error("Cannot fetch studies withough a user id.");
        }
        $userId = $user["id"];
    } 
    try {
        $statement = $dbh->prepare(
            "select studies.id as study_id, name, begin_at, end_at, ". 
                "created_at, group_id from study_participants join studies ". 
                "on study.id = study_id where user_id = :user_id");
        $success = $statement->execute([
            ":user_id" => $userId
        ]);
           
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    } catch(PDOException $e){
        error("There was an error reading study info from the database",
            [$e->getMessage()]);
    }
}

?>