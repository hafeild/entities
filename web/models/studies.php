<?php
// File:    studies.php
// Author:  Henry Feild
// Date:    03-Nov-2019
// Purpose: Provides functions that interface with the study-related database
//          tables.


/**
 * Adds a new study entry. 
 * 
 * @param name The study's name/label.
 * @param beginTimestamp The time participants may begin the study. Should be in
 *                       the format: "YYYY-MM-DD HH:MM:SS +HH:MM".
 * @param endTimestamp The time after which participants may no longer engage in
 *                     the study. Should be in the same format specified above.
 * @return The id of the study.
 */
function addStudy($name, $beginTimestamp, $endTimestamp){
    $dbh = connectToDB();

    try {
        $dbh->beginTransaction();
        $statement = $dbh->prepare(
            "insert into studies(name, begin_at, end_at, created_at) values ". 
                "(:name, :begin_at, :end_at, :created_at)");
        $success = $statement->execute([
            ":name" => $name,
            ":begin_at" => $beginTimestamp,
            ":end_at" => $endTimestamp,
            ":created_at" => curDateTime()
        ]);
        $id = $dbh->lastInsertId();
        $dbh->commit();

        return $id;
    } catch(PDOException $e){
        $dbh->rollback();
        error("There was an error adding study info to the database",
            [$e->getMessage()]);
    }
}

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
 * Adds a new study group entry. 
 * 
 * @param studyId The id of the study to associate the new group with.
 * @param label The group's label.
 * @return The id of the group.
 */
function addStudyGroup($studyId, $label){
    $dbh = connectToDB();

    try {
        $dbh->beginTransaction();
        $statement = $dbh->prepare(
            "insert into study_groups(study_id, label, created_at) values ". 
                "(:study_id, :label, :created_at)");
        $success = $statement->execute([
            ":study_id" => $studyId,
            ":label" => $label,
            ":created_at" => curDateTime()
        ]);
        $id = $dbh->lastInsertId();
        $dbh->commit();
        
        return $id;
    } catch(PDOException $e){
        $dbh->rollback();
        error("There was an error adding study group info to the database",
            [$e->getMessage()]);
    }
}

/**
 * Adds a new study step entry. 
 * 
 * @param label The step's label.
 * @param baseAnnotationId The id of the annotation (if any) this step is 
 *                         is associated with. Default: null.
 * @param url The url (if any) this step will link to. Default: null.
 * @return The id of the step.
 */
function addStudyStep($label, $baseAnnotationId=null, $url=null){
    $dbh = connectToDB();

    try {
        $dbh->beginTransaction();
        $statement = $dbh->prepare(
            "insert into study_steps(label, base_annotation_id, ". 
                "url, created_at) values ". 
                "(:label, :base_annotation_id, :url, :created_at)");
        $success = $statement->execute([
            ":label"              => $label,
            ":base_annotation_id" => $baseAnnotationId,
            ":url"                => $url,
            ":created_at"         => curDateTime()
        ]);
        $id = $dbh->lastInsertId();
        $dbh->commit();
        
        return $id;
    } catch(PDOException $e){
        $dbh->rollback();
        error("There was an error adding study step info to the database",
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
            error("Cannot fetch studies without a user id.");
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


/**
 * Adds a new study step order entry. 
 * 
 * @param stepId The id of the step.
 * @param groupId The id of the group this ordering belongs to.
 * @param ordering The numeric order (rank) of the step for this study group --
 *                 this indicates the order the step will be listed on the study
 *                 page. The first step listed should have an order of 1.
 */
function addStudyStepOrdering($stepId, $groupId, $ordering){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "insert into study_step_orderings(step_id, group_id, ordering, ". 
                "created_at) values ". 
                "(:step_id, :group_id, :ordering, :created_at)");
        $success = $statement->execute([
            ":step_id"     => $stepId,
            ":group_id"    => $group_id,
            ":ordering"    => $ordering,
            ":created_at"  => curDateTime()
        ]);
    } catch(PDOException $e){
        error("There was an error adding step ordering info to the database",
            [$e->getMessage()]);
    }
}

/**
 * Adds a new study participant entry.
 * 
 * @param userId The id of the user.
 * @param studyId The id of the study the user will be a participant in.
 * @param groupId The id of the group the participant is assigned to.
 */
function addStudyParticipant($userId, $studyId, $groupId){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "insert into study_participants(". 
                "user_id, study_id, group_id, created_at) ". 
                "values (:user_id, :study_id, :group_id, :created_at)");
        $success = $statement->execute([
            ":user_id" => $userId,
            ":study_id" => $studyId,
            ":group_id" => $groupId,
            ":created_at" => curDateTime()
        ]);
        
    } catch(PDOException $e){
        error("There was an error adding participant info to the database",
            [$e->getMessage()]);
    }
}

/**
 * Adds a new study participant entry.
 * 
 * @param userId The id of the user.
 * @param stepId The id of the step.
 * @param annotationId The id of the participant-specific annotation (not the 
 *                     base annotation id specified in the study_steps table). 
 *                     This can be null, e.g., if the corresponding step isn't 
 *                     associated with an annotation.
 */
function addStudyParticipantStep($userId, $stepId, $annotationId=null){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "insert into study_participant_steps(". 
                "user_id, step_id, annotation_id, created_at) ". 
                "values (:user_id, :step_id, :annotation_id, :created_at)");
        $success = $statement->execute([
            ":user_id" => $userId,
            ":step_id" => $stepId,
            ":annotation_id" => $annotationId,
            ":created_at" => curDateTime()
        ]);
        
    } catch(PDOException $e){
        error("There was an error adding participant step info to the database",
            [$e->getMessage()]);
    }
}

?>