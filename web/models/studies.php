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
    $useLocalTransaction = !$dbh->inTransaction();

    try {
        if($useLocalTransaction){
            $dbh->beginTransaction();
        }
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

        if($useLocalTransaction){
            $dbh->commit();
        }

        return $id;
    } catch(PDOException $e){
        if($useLocalTransaction){
            $dbh->rollback();
            error("There was an error adding study info to the database",
                [$e->getMessage()]);
        } else {
            throw new Exception("There was an error adding study info to ". 
                "the database. ". $e->getMessage() . ".");
        }
    }
}

/**
 * Retrieves info about the studies a user is associated with. 
 * 
 * @param userId The id of the user to lookup; if null, the id of the currently  
 *               logged in user is used.
 * @return A list of studies the user is associated with:
 *           - study_id
 *           - participant_id
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
            error("Cannot fetch studies without a user id.");
        }
        $userId = $user["id"];
    } 
    try {
        $statement = $dbh->prepare(
            "select studies.id as study_id, ". 
                "study_participants.id as participant_id, ". 
                "name, begin_at, end_at, ". 
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
 * Retrieves basic info about all the studies in the database. 
 * 
 * @return A list of studies the user is associated with:
 *           - id
 *           - name
 *           - begin_at
 *           - end_at
 *           - created_at
 */
function getAllStudies(){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "select * from studies");
        $success = $statement->execute();
           
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
 * Gets all of the data associated with a given study from the database.
 * 
 * @param studyId The id of the study.
 * @return An array of records, one per record in the  outer join of  
 *         `study_data` and `study_participant_steps`. Each record has
 *         the following fields:
 * 
 *           - study_id (studies.id)
 *           - study_begin_at (studies.begin_at)
 *           - study_end_at (studies.end_at)
 *           - study_name (studies.name)
 *           - study_data_id (study_data.id)
 *           - step_id (study_data.step_id)
 *           - step_label (study_steps.step_label)
 *           - base_annotation_id (could be null) (study_steps.base_annotation_id)
 *           - step_url (could be null) (study_steps.step_url)
 *           - participant_id (study_data.study_participant_id)
 *           - participant_group_id (study_participants.group_id)
 *           - participant_group_label (study_groups.label)
 *           - step_started_at (study_participant_steps.started_at)
 *           - step_completed_at (study_participant_steps.completed_at)
 *           - text_id (could be null) (annotations.text_id)
 *           - text_title (could be null) (texts.title)
 *           - annotation_id (could be null) 
 *                           (study_participant_steps.annotation_id)
 *           - annotation_label (could be null) (annotations.label)
 *           - study_data_uploaded_at (study_data.created_at)
 *           - study_data (could be null) (annotations.data)
 */
function getStudyData($studyId){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare("
select studies.id as study_id, studies.begin_at as study_begin_at, 
    studies.end_at as study_end_at, 
    studies.name as study_name,
	study_steps.id as step_id, 
    study_steps.label as step_label, 
    study_step_orderings.ordering as step_ordering, 
    study_steps.base_annotation_id as base_annotation_id,
	study_steps.url as step_url, 
    study_participants.id as participant_id, 
    study_participants.group_id as participant_group_id, 
	study_groups.label as participant_group_label, 
    study_participant_steps.started_at as step_started_at,
	study_participant_steps.completed_at as step_completed_at, 
    texts.id as text_id, texts.title as text_title, 
    annotations.id as annotation_id, 
	annotations.label as annotation_label, 
    study_data.id as study_data_id, 
    study_data.created_at as study_data_uploaded_at, 
    study_data.data as study_data
from studies join study_steps on studies.id = study_steps.study_id
	join study_participant_steps 
        on study_steps.id = study_participant_steps.step_id
	join study_participants
        on study_participant_steps.study_participant_id = study_participants.id
	join study_groups on studies.id = study_groups.study_id and 
        study_groups.id = study_participants.group_id
	join study_step_orderings on study_groups.id = study_step_orderings.group_id
        and study_steps.id = study_step_orderings.step_id
	left join annotations on annotations.id = study_steps.base_annotation_id
	left join texts on annotations.text_id = texts.id
	left join study_data on study_data.step_id = study_steps.id and 
        study_data.study_participant_id = study_participants.id
where studies.id = :study_id
order by study_participants.id, study_step_orderings.ordering, 
    study_data.created_at");
        $success = $statement->execute([
            ":study_id" => $studyId
        ]);
           
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    } catch(PDOException $e){
        error("There was an error reading the study data from the database",
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
    $useLocalTransaction = !$dbh->inTransaction();

    try {

        if($useLocalTransaction){ 
            $dbh->beginTransaction(); 
        }
        $statement = $dbh->prepare(
            "insert into study_groups(study_id, label, created_at) values ". 
                "(:study_id, :label, :created_at)");
        $success = $statement->execute([
            ":study_id" => $studyId,
            ":label" => $label,
            ":created_at" => curDateTime()
        ]);
        $id = $dbh->lastInsertId();

        if($useLocalTransaction){
            $dbh->commit();
        }
        
        return $id;
    } catch(PDOException $e){
        if($useLocalTransaction){
            $dbh->rollback();
            error("There was an error adding study group info to the database",
                [$e->getMessage()]);
        } else {
            throw new Exception("There was an error adding study group info ". 
                "to the database. ". $e->getMessage() .".");
        }
    }
}

/**
 * Adds a new study step entry. 
 * 
 * @param studyId The id of the study the step will be associated with.
 * @param label The step's label.
 * @param baseAnnotationId The id of the annotation (if any) this step is 
 *                         is associated with. Default: null.
 * @param url The url (if any) this step will link to. Default: null.
 * @return The id of the step.
 */
function addStudyStep($studyId, $label, $baseAnnotationId=null, $url=null){
    $dbh = connectToDB();
    $useLocalTransaction = !$dbh->inTransaction();

    try {

        if($useLocalTransaction){ 
            $dbh->beginTransaction(); 
        }
        $statement = $dbh->prepare(
            "insert into study_steps(study_id, label, base_annotation_id, ". 
                "url, created_at) values ". 
                "(:study_id, :label, :base_annotation_id, :url, :created_at)");
        $success = $statement->execute([
            ":study_id"           => $studyId,
            ":label"              => $label,
            ":base_annotation_id" => $baseAnnotationId,
            ":url"                => $url,
            ":created_at"         => curDateTime()
        ]);
        $id = $dbh->lastInsertId();

        if($useLocalTransaction){
            $dbh->commit();
        }
        
        return $id;
    } catch(PDOException $e){

        if($useLocalTransaction){
            $dbh->rollback();
            error("There was an error adding study step info to the database",
                [$e->getMessage()]);
        } else {
            throw new Exception("There was an error adding study step info to ". 
                "the database. ". $e->getMessage() .".");
        }
    }
}

/**
 * Retrieves the list of steps/tasks for the given study and user. 
 * 
 * @param studyId The id of the study.
 * @param userId The id of the user to lookup; if null, the id of the currently  
 *               logged in user is used.
 * @return Info about the steps associated with the specified study in the order
 *         they are assigned for the user:
 *              - id (of the step)
 *              - participant_id
 *              - label
 *              - started_at
 *              - completed_at
 *              - created_at
 *              - annotation_id
 *              - url
 *              - order
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
            "select sp.id as participant_id, ". 
                "ss.id as id, ss.label as label, ". 
                "sps.started_at as started_at, ". 
                "sps.completed_at as completed_at, ". 
                "sps.created_at as created_at, ". 
                "sps.annotation_id as annotation_id, ss.url as url, ". 
                "sso.ordering as ordering ".
                "from study_participants as sp ". 
                "join study_step_orderings as sso ". 
                "on sp.group_id = sso.group_id ". 
                "join study_steps as ss on sso.step_id = ss.id ". 
                "join study_participant_steps as sps on ". 
                "ss.id = sps.step_id and sp.id = sps.study_participant_id ".
                "where sp.user_id = :user_id ". 
                "order by ordering asc");
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
 * Retrieves info about a participant step. 
 * 
 * @param participantId The id of the participant (id from the study_participant
 *                      table).
 * @param stepId The id of the step.
 * @return An object with these fields:
 *              - step_id
 *              - participant_id
 *              - study_id
 *              - started_at
 *              - completed_at
 *              - created_at
 *              - annotation_id
 *              - label
 *              - url
 *              - base_annotation_url
 */
function getStudyParticipantStep($participantId, $stepId){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "select study_participant_id as participant_id, * ". 
                "from study_participant_steps join study_steps ". 
                "on study_steps.id = step_id ". 
                "where study_participant_id = :study_participant_id ". 
                "and step_id = :step_id");
        $success = $statement->execute([
            ":study_participant_id" => $participantId,
            ":step_id"              => $stepId
        ]);
           
        return $statement->fetch(PDO::FETCH_ASSOC);
    } catch(PDOException $e){
        error("There was an error reading study participant step info from ". 
            "the database", [$e->getMessage()]);
    }
}

/**
 * Marks the given step completed. 
 * 
 * @param participantId The id of the participant (id from the study_participant
 *                      table).
 * @param stepId The id of the step.
 */
function markStudyStepCompleted($participantId, $stepId){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "update study_participant_steps set completed_at = :completed_at ". 
                "where study_participant_id = :study_participant_id ". 
                "and step_id = :step_id");
        $success = $statement->execute([
            ":completed_at"         => curDateTime(),
            ":study_participant_id" => $participantId,
            ":step_id"              => $stepId
        ]);
           
        return $statement->fetch(PDO::FETCH_ASSOC);
    } catch(PDOException $e){
        error("There was an error updating study participant completion time ". 
            "in the database", [$e->getMessage()]);
    }
}


/**
 * Marks the given step as having started. 
 * 
 * @param participantId The id of the participant (id from the study_participant
 *                      table).
 * @param stepId The id of the step.
 */
function markStudyStepStarted($participantId, $stepId){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "update study_participant_steps set started_at = :started_at ". 
                "where study_participant_id = :study_participant_id ". 
                "and step_id = :step_id");
        $success = $statement->execute([
            ":started_at"         => curDateTime(),
            ":study_participant_id" => $participantId,
            ":step_id"              => $stepId
        ]);
           
        return $statement->fetch(PDO::FETCH_ASSOC);
    } catch(PDOException $e){
        error("There was an error updating study participant start time ". 
            "in the database", [$e->getMessage()]);
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
            ":group_id"    => $groupId,
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
 * @return The created participant id.
 */
function addStudyParticipant($userId, $studyId, $groupId){
    $dbh = connectToDB();
    $useLocalTransaction = !$dbh->inTransaction();

    try {
        if($useLocalTransaction){
            $dbh->beginTransaction();
        }
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
        
        $id = $dbh->lastInsertId();        

        if($useLocalTransaction){
            $dbh->commit();
        }
        return $id;
    } catch(PDOException $e){
        if($useLocalTransaction){
            $dbh->rollback();
            error("There was an error adding participant info to the database",
                [$e->getMessage()]);
        } else {
            throw new Exception("There was an error adding participant info ". 
                "to the database. ". $e->getMessage() .".");
        }
    }

}

/**
 * Retrieves info about a study participant. 
 * 
 * @param userId The id of the user (participant).
 * @param studyId The id of the study.
 * @return An object with these fields:
 *              - participant_id
 *              - user_id
 *              - group_id
 *              - study_id
 *              - created_at
 */
function getStudyParticipant($userId, $studyId){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "select id as participant_id, user_id, group_id, study_id, ". 
                "created_at from study_participants where user_id = :user_id ". 
                "and study_id = :study_id");
        $success = $statement->execute([
            ":user_id" => $userId,
            ":study_id" => $studyId
        ]);
           
        return $statement->fetch(PDO::FETCH_ASSOC);
    } catch(PDOException $e){
        error("There was an error reading study participant info from ". 
            "the database", [$e->getMessage()]);
    }
}


/**
 * Adds a new study participant entry.
 * 
 * @param participantId The id of the participant (from the study_participants 
 *                      table).
 * @param stepId The id of the step.
 * @param annotationId The id of the participant-specific annotation (not the 
 *                     base annotation id specified in the study_steps table). 
 *                     This can be null, e.g., if the corresponding step isn't 
 *                     associated with an annotation.
 */
function addStudyParticipantStep($participantId, $stepId, $annotationId=null){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "insert into study_participant_steps(". 
                "study_participant_id, step_id, annotation_id, created_at) ". 
                "values (:study_participant_id, :step_id, :annotation_id, ". 
                ":created_at)");
        $success = $statement->execute([
            ":study_participant_id" => $participantId,
            ":step_id"              => $stepId,
            ":annotation_id"        => $annotationId,
            ":created_at"           => curDateTime()
        ]);
        
    } catch(PDOException $e){
        error("There was an error adding participant step info to the database",
            [$e->getMessage()]);
    }
}


/**
 * Retrieves info about a study step. 
 * 
 * @param stepId The id of the step.
 * @param groupId The id of the group this ordering is for.
 * @return An object with these fields:
 *              - step_id
 *              - group_id
 *              - created_at
 *              - ordering
 */
function getStudyStepOrdering($stepId, $groupId){
    $dbh = connectToDB();

    try {
        $statement = $dbh->prepare(
            "select * from study_step_orderings where step_id = :step_id ". 
                "and group_id = :group_id");
        $success = $statement->execute([
            ":group_id" => $groupId,
            ":step_id" => $stepId
        ]);
           
        return $statement->fetch(PDO::FETCH_ASSOC);
    } catch(PDOException $e){
        error("There was an error reading study step ordering info from ". 
            "the database", [$e->getMessage()]);
    }
}

/**
 * Inserts the given data as a record into the study_data table.
 * 
 * @param participantId The id of the participant (from the study_participants
 *                      table).
 * @param stepId The id of the step.
 * @param data A JSON string consisting of interaction data.
 * @param The id of the created database recorded..
 */
function addStudyData($participantId, $stepId, $data){
    $dbh = connectToDB();
    $useLocalTransaction = !$dbh->inTransaction();

    try {
        if($useLocalTransaction){
            $dbh->beginTransaction();
        }
        $statement = $dbh->prepare(
            "insert into study_data(". 
                "study_participant_id, step_id, data, created_at) ". 
                "values (:study_participant_id, :step_id, :data, :created_at)");
        $success = $statement->execute([
            ":study_participant_id" => $participantId,
            ":step_id"              => $stepId,
            ":data"                 => $data,
            ":created_at"           => curDateTime()
        ]);
        $id = $dbh->lastInsertId();        

        if($useLocalTransaction){
            $dbh->commit();
        }
        return $id;
    } catch(PDOException $e){
        if($useLocalTransaction){
            $dbh->rollback();
            error("There was an error adding study data info to the database",
                [$e->getMessage()]);
        } else {
            throw new Exception("There was an error adding study data info ". 
                "to the database. ". $e->getMessage() .".");
        }
    }
}

?>