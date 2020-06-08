<?php 
// File:    dump-study-data.php
// Author:  Henry Feild
// Date:    29-May-2020
// Purpose: Extracts data for a specific study in JSONL format. Each record in
//          the `study_data` database table contains a `data` field, which is
//          a batch of log events in a JSON array. This script unpacks them
//          such that each line in the output is a single event with these
//          fields:
//
//               - study_id (studies.id)
//               - study_begin_at (studies.begin_at)
//               - study_end_at (studies.end_at)
//               - study_name (studies.name)
//               - study_data_id (study_data.id)
//               - step_id (study_data.step_id)
//               - step_label (study_steps.step_label)
//               - base_annotation_id (could be null) (study_steps.step_label)
//               - step_url (could be null) (study_steps.step_url)
//               - participant_id (study_data.study_participant_id)
//               - participant_user_id (users.id)
//               - participant_user_name (users.user_name)
//               - participant_group_id (study_participants.group_id)
//               - participant_group_label (study_groups.label)
//               - step_started_at (study_participant_steps.started_at)
//               - step_completed_at (study_participant_steps.completed_at)
//               - text_id (could be null) (annotations.text_id)
//               - text_title (could be null) (texts.title)
//               - annotation_id (could be null) 
//                               (study_participant_steps.annotation_id)
//               - annotation_label (could be null) (annotations.label)
//               - study_data_uploaded_at (study_data.created_at)
//               - event_timestamp (extracted from study_data.data)
//               - event_name (extracted from study_data.data)
//               - event_data (json object; specific to event) (extracted from 
//                            study_data.data; could be null)


require_once(__DIR__ ."/../web/controllers.php");
require_once(__DIR__ ."/../web/init.php");
require_once(__DIR__ ."/../web/models/model-init.php");
require_once(__DIR__ ."/../web/permissions.php");

class StudyInitializer {
    function run($argv){
        // Check arguments.
        if(count($argv) > 1 && $argv[1] == "-h"){
            die("Usage: php initialize-study.php [<study id>]|-h\n\n". 
                "If <study id> is provided, dumps all logged events for that ".
                "study, one even per line, in JSONL format. If no arguments ". 
                "are provided, a list of studies is displayed and you can ". 
                "pick the one to dump. See the 'Purpose' statement at the ". 
                "top of this script for details on the format.\n\n");
        }

        if(count($argv) > 1)
            $studyId = $argv[1];
        else 
            $studyId = $this->getStudyIdFromUser();

        // Grab the data from the DB and unpack the uploaded event batches.
        $this->emitStudyDataEvents($studyId);
    }

    /**
     * Displays a list of studies and reads the user's selection. Display is
     * done to stderr so it is not captured in stdout redirects.
     * 
     * @return The study id selected by the user.
     */
    function getStudyIdFromUser(){
        $studies = getAllStudies();
        $validStudyIds = [];
        $this->print_messageln("Please select a study below:");
        foreach($studies as $study){
            $validStudyIds[''. $study["id"]] = 1;
            $this->print_messageln("  [${study["id"]}] ${study["name"]} ". 
                "(${study["begin_at"]} -- ${study["end_at"]}; created: ". 
                "${study["created_at"]})");
        }

        $this->print_message("> ");
        $option = trim(fgets(STDIN));
        while(!array_key_exists($option, $validStudyIds)){
            $this->print_messageln("Invalid study id. Please try again.");
            $this->print_message("> ");
            $option = trim(fgets(STDIN));
        }

        return $option;
    }

    /**
     * Gets the study records from the database, then unpacks all of the
     * events in each record with a non-null `study_data` field.
     * 
     * @param studyId The id of the study.
     */
    function emitStudyDataEvents($studyId){
        applyToStudyData($studyId, function($record){ 
            $this->processStudyRecord($record);
        });
    }

    /**
     * Processes a single study data record. If the record has a non-null
     * `study_data` field, then each event in `study_data` JSON array is 
     * expanded and a separate record is emitted for each event with the new 
     * fields: `event_timestamp`, `event_name`, and `event_data`. Otherwise, the
     * record is emitted  with null values for each of those three fields. The
     * `study_data` field is removed from all records before being emitted.
     * 
     * @param record The record to process.
     */
    function processStudyRecord($record){

        try{
            if($record["study_data"] == null){
                $record["event_timestamp"] = null;
                $record["event_name"] = null;
                $record["event_data"] = null;
                unset($record["study_data"]);
                echo json_encode($record, JSON_FORCE_OBJECT) ."\n";
                return;
            }
            $recordBase = $record;
            $data = json_decode($record["study_data"],  true);
            unset($recordBase["study_data"]);
            foreach($data as $event){
                $newRecord = $recordBase;
                $newRecord["event_timestamp"] = $event["timestamp"];
                $newRecord["event_name"] = $event["name"];
                unset($event["timestamp"]);
                unset($event["name"]);
                $newRecord["event_data"] = $event;
    
                echo json_encode($newRecord, JSON_FORCE_OBJECT) ."\n";
            }
        } catch(Exception $e){
            fwrite(STDERR, "Error processing record: ".
                $e->getMessage() ."\n".
                json_encode($record) ."\n" );
        }
    }



    /**
     * Prints the given message to stderr.
     * 
     * @param message The message to print.
     */
    function print_message($message){
        fwrite(STDERR, $message);
    }

    /**
     * Prints the given message to stderr, and adds a newline to the end.
     * 
     * @param message The message to print.
     */
    function print_messageln($message){
        fwrite(STDERR, $message ."\n");
    }

}

$format = "json";
(new StudyInitializer())->run($argv);
?>
