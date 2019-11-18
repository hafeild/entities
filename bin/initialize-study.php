<?php 
// File:    initialize-study.php
// Author:  Henry Feild
// Date:    05-Nov-2019
// Purpose: Processes a study configuration file to populate the database with
//          data for a user study, including new users as needed, forks of new
//          or existing annotations/text, and all of the study information.
//          see config/study-config-EXAMPLE.jsonc for more information.
//
//          The configuration file should be in JSONC (JSON with comments)
//          format. Comments should be on a stand alone line and start with
//          0 or more whitespace and two forward slashes (//). The entire line
//          a comment resides on is removed. The JSON should be an array of 
//          objects, where each object corresponds to a single study.
//
//          The required fields are:
//
//          - name -- The name of the study; this appears in the link to the 
//                    study and at the top of the study page.
//          - starts_at -- The timestamp when the study opens; it's not 
//                         available to subjects until after this time; should 
//                         be formatted as: "YYYY-MM-DD HH:MM:SS" and may 
//                         optionally be suffixed with the offset from GMT 
//                         (e.g. "YYYY-MM-DD HH:MM:SS +HH:MM").
//          - ends_at -- The timestamp afterwhich no more subjects may engage 
//                       with the study; formatted the same as starts_at.
//          - texts -- A map of text titles -> info about the text:
//              * "text title" -- Whatever you want to title the text; will 
//                                appear at the top of annotation pages.
//                  - text_path -- The path to the text so it can be processed;
//                                 use this if the text you want to use is not
//                                 already part of your EntiTies instance.
//                  - db_id -- The id of the text to use from the current
//                             EntiTies instance; you can get this from the 
//                             database directly or navigate to the text's page
//                             on EntiTies and extract the id from the URL;
//                             e.g., in https://myentities.com/texts/8, 8 
//                             is the id of the text. Use this if you have not
//                             specified text_path. 
//          - annotations -- Describes the annotations you want study subjects 
//                           to interact with; each subject will work on their 
//                           own fork of the annotation so their work does not 
//                           collide. Maps annotation names (just used in the 
//                           setup process) to info about the annotation.
//              * "annotation label" -- A convenience label used during the
//                                      setup process to refer to a specific 
//                                      annotation.
//                  - text_title -- The title of the text to annotate.
//                  - annotation_title -- The title of the annotation; this will
//                                        appear at the top of the annotation 
//                                        page.
//                  - parameters -- An object that describes how to pre-process 
//                                  this annotation, e.g., by making a fork of
//                                  the root annotaiton or automatically 
//                                  processing it to extract entities and ties.
//                                  TODO: describe the options.
//                  - db_id -- If you would like to use a fork of an annotation 
//                             that already exists, use this field to specify
//                             its id in the EntiTies database. You can find 
//                             this directly from the database or by navigating 
//                             to the annotation on your EntiTies instance and
//                             extracting it from the URL; e.g., in 
//                             https://myentities.com/texts/7/annotations/4, 4 
//                             is the annotation id.
//          - groups -- An map of group labels -> group info. Make empty objects 
//                      ({}) if these are new groups.
//              * "group label" -- The group label.
//                  - db_id -- Optional. The id of the group in the study_groups 
//                             table. This will be populated automatically if
//                             not present.
//                  - step_ordering An array of step labels (see the step 
//                               section below). This is the order in which the
//                               steps will be shown to subjects in the
//                               corresponding group. You do not need to list 
//                               every step for every group.
//          - participants -- An array of objects that describe a participant.
//                            each object should have the following fields:
//              * username -- If this doesn't exist, a new user will be created.
//              * password -- Optional. If not provided, a random one will be
//                            generated.
//              * group -- The condition group to assign this participant to;
//                         you can change what steps/tasks participants in a 
//                         group see and in what order.
//          - steps -- A map of step labels -> information about the step.
//              * "step label" -- A convenience label used during the setup 
//                                process to refer to a specific step and
//                                cross-reference with the step_ordering array 
//                                in group objects.
//                  - link_description -- The text to display on the study page 
//                                        for this step.
//                  - url -- Use this if the step links out to an external page, 
//                           e.g., a questionnaire. Use this OR "annotation", 
//                           but not both.
//                  - annotation -- The annotation label to link this step with;
//                                  the step will link to a fork of the 
//                                  annotation specified. Use this OR "url", but
//                                  not both.


require_once(__DIR__ ."/../web/controllers.php");
require_once(__DIR__ ."/../web/init.php");
require_once(__DIR__ ."/../web/models/model-init.php");
require_once(__DIR__ ."/../web/permissions.php");

class StudyInitializer {

    function run($argv){
        // Check arguments.
        if(count($argv) == 1 || $argv[1] == "-h"){
            die("Usage: php initialize-study.php <study config file>|-h\n\n". 
                "See the comment at the top of this script for format ". 
                "details.\n\n");
        }

        $dbh =  connectToDB();

        // Read in the configuration file.
        $configFile = $argv[1];
        $configFD = fopen($configFile, "r") or 
            die("Error reading configuration file.");
        $configContents = fread($configFD,filesize($configFile));
        // Strip out comments before parsing the config file.
        $cleanedConfigContents = str_replace("\n", "", 
            preg_replace("#(^\s*//.*$)|(\s*$)|(^\s*)#m", "", 
            $configContents));
        $config = json_decode($cleanedConfigContents, true);
        fclose($configFD);

        // Don't proceed if the file couldn't be parsed.
        if($config == NULL){
            $this->print_messageln("Error parsing $configFile; skipping.\n". 
                    $cleanedConfigContents);
            return;
        }

        $curStudy = null;
        try{
            $dbh->beginTransaction();

            // Process each of the studies listed in the config file.
            foreach($config as &$study){
                $curStudy = $study["name"];
                $this->processStudy($study);
                $dbh->commit();
            }
            print(json_encode($config, JSON_PRETTY_PRINT));
                
        } catch(Exception $e) {
            $dbh->rollback();
            $this->print_messageln("Exception processing $curStudy: ". 
                $e->getMessage() .".");
        }

    }


    /**
     * Processes the given study settings, creating users, tokenizing texts, 
     * processing annotations, forking annotations, setting permissions, and
     * filling out the study-related database tables as necessary.
     * 
     * @param study The study object. This is updated in place to include ids of
     *              many of the newly created objects.
     */
    function processStudy(&$study){
        $this->print_messageln("Processing ${study["name"]}");

        $this->loadTexts($study);
        $this->addAnnotations($study);
        $this->addTheStudy($study);
        $this->addStudyGroups($study);
        $this->createParticipants($study);
        $this->addStudySteps($study);
        $this->addStepOrderings($study);
        $this->addParticipantSteps($study);
    }

    /**
     * Loads any texts that aren't already in the database. Each text object is
     * updated with the text's id in the `texts` table under the field `db_id`.
     * 
     * WARNING: this is currently unimplemented.
     * 
     * @param study The study object. This is updated in place (see above).
     */
    function loadTexts(&$study) {
        $this->print_message("Loading texts...");

        // TODO

        $this->print_messageln("done!");
    }

    /**
     * Processes any annotations that aren't already in the database. Each
     * annotation object is updated with the annotation's id in the 
     * `annotations` table under the field `db_id`.
     * 
     * WARNING: this is currently unimplemented.
     * 
     * @param study The study object. This is updated in place (see above).
     */
    function addAnnotations(&$study){
        $this->print_message("Loading annotations...");

        // TODO;

        $this->print_messageln("done!");
    }


    /**
     * Adds a new entry to the `studies` table. The id of the study is added to
     * a field named `db_id` in the $study parameter.
     * 
     * @param study The study object. This is updated in place (see above).
     */
    function addTheStudy(&$study){
        // Skip if this study already has a database id.
        if(array_key_exists("db_id", $study) && $study["db_id"]){
            throw new Exception(
                "This study already exists; not creating a new entry.");
        }

        $this->print_message("Adding study entry...");
        $study["db_id"] = addStudy(
            $study["name"], $study["starts_at"], $study["ends_at"]);

        $this->print_messageln("done!");
    }

    /**
     * Adds a new entries to the `study_groups` table. The id of each created
     * group is added under a field named `db_id` in the associated group of the
     * $study object passed in. Assumes the study has been added to the database
     * and has a corresponding `db_id` key.
     * 
     * @param study The study object. This is updated in place (see above).
     */
    function addStudyGroups(&$study){
        $this->print_message("Adding study groups...");
        $addedCount = 0;
        
        foreach($study["groups"] as $groupLabel => &$groupInfo){
            if(!array_key_exists("db_id", $groupInfo)){
                $groupInfo["db_id"] = addStudyGroup($study["db_id"], 
                    $groupLabel);
                $addedCount++;
            } 
        }

        $this->print_messageln("$addedCount of ". count($study["groups"]) . 
            " groups created (others existed)...done!");
    }

    /**
     * Creates users listed in the `participants` section of the passed in map
     * if necessary and creates a new entry in the `study_participants` table.
     * Each participant object is updated with the user's id under the key
     * `db_id`. Assumes the study and groups have been added to the database and
     * each have a corresponding `db_id` key.
     * 
     * @param study The study object. This is updated in place (see above).
     */
    function createParticipants(&$study){
        $this->print_message("Creating participants...");

        foreach($study["participants"] as &$participant){
            // Check that we have a group for this user.
            if(!array_key_exists("group", $participant)){
                throw new Exception(
                    "The participant ${study["username"]} is ". 
                    "missing a group.");
                continue;
            } else if(!array_key_exists($participant["group"], 
                    $study["groups"])){
                throw new Exception(
                    "Error while processing the participant ". 
                    $study["username"].
                    ": the group ${participant["group"]} does not exist under ". 
                    "'groups' in the configuration file.");
                continue;
            }

            // See if we have a user id for this participant.
            if(!array_key_exists("db_id", $participant) || 
                $participant["db_id"] == null){

                // Nope. Now we need to check if the user exists.
                $userData = getUserInfo($participant["username"]);

                // Nope. Now we need to create a new one.
                if($userData == null){
                    // Generate a password for the user if there's not one
                    // already.
                    if(!array_key_exists("password", $participant)){
                        $participant["password"] = $this->generatePassword();
                    }
                    $this->print_message("Adding new user (id = ");
                    $participant["db_id"] = addNewUser($participant["username"], 
                        password_hash($participant["password"], PASSWORD_BCRYPT));
                    $userData = getUserInfo($participant["username"]);

                    $this->print_messageln($userData["id"] .")");
                }
                $participant["db_id"] = $userData["id"];
            }


            // Check if an entry already exists for this participant; if so, 
            // we can skip to the next participant.
            if(getStudyParticipant($participant["db_id"], $study["db_id"])){
                continue;
            }

            addStudyParticipant($participant["db_id"], $study["db_id"], 
                $study["groups"][$participant["group"]]["db_id"]);
        }
        
        $this->print_messageln("done!");
    }


    /**
     * Adds a new entries to the `study_steps` table. The id of each created
     * step is added under a field named `db_id` in the associated group of the
     * $study object passed in. Assumes the study, groups, and annotations have
     * been added to the database and each have a corresponding `db_id` key.
     * 
     * @param study The study object. This is updated in place (see above).
     */
    function addStudySteps(&$study){
        $this->print_message("Adding study steps...");

        foreach($study["steps"] as $label => &$stepInfo){
            // Check if this step has already been added to the database.
            if(array_key_exists("db_id", $stepInfo) && 
                    $stepInfo["db_id"] != null){
                continue;
            }

            $url = null;
            $annotationId = null;

            if(array_key_exists("annotation", $stepInfo)){
                // Make sure the annotation exists and has a db_id.
                $annotationLabel = $stepInfo["annotation"];
                if(!array_key_exists($annotationLabel, $study["annotations"])){
                    throw new Exception(
                        "Error processing study step '$label': ". 
                        "no annotation with the label '$annotationLabel' ". 
                        "found in under the annotations section of the study ". 
                        "configuration.");
                } else if(!array_key_exists("db_id",  
                        $study["annotations"][$annotationLabel])){
                   throw new Exception(
                        "Error processing study step '$label': ". 
                        "no db_id found for the annotation with label ". 
                        "'$annotationLabel'");
                }
                $annotationId =$study["annotations"][$annotationLabel]["db_id"];

            } else if(array_key_exists("url", $stepInfo)){
                $url = $stepInfo["url"];
            }

            $stepId = addStudyStep(
                $stepInfo["link_description"], $annotationId, $url);
            
            $stepInfo["db_id"] = $stepId;
        }

        $this->print_messageln("done!");
    }

    /**
     * Adds the step orderings for each group. Assumes the study, groups, and
     * steps have been added to the database and each have a `db_id` key.
     * 
     * @param study The study object.
     */
    function addStepOrderings(&$study){
        $this->print_message("Adding step orderings...");
        $i = 0;

        foreach($study["groups"] as $group => $groupInfo){
            $ordering = $groupInfo["step_ordering"];
            // Ensure the group has a db_id. 
            if(!array_key_exists("db_id", $groupInfo)){
                throw new Exception(
                    "Error processing step ordering for group '". 
                    $group ."': no db_id found for this group");
            }

            $groupId = $groupInfo["db_id"];

            for($i = 0; $i < count($ordering); $i++){
                $step = $ordering[$i];

                // Ensure the step exists and has a db_id.
                if(!array_key_exists($step, $study["steps"])){
                    throw new Exception(
                        "Error processing step ordering for ".
                        "'$group': no step named '$step' found under 'steps' ". 
                        "group in the study configuration.");
                } else if(!array_key_exists("db_id", $study["steps"][$step])){
                   throw new Exception(
                        "Error processing step ordering for ". 
                        "group '$group': no db_id found for step '$step'.");
                }

                $stepId = $study["steps"][$step]["db_id"];

                // Check if it already exists.
                if(!getStudyStepOrdering($stepId,$groupId)){
                    // Add the step ordering to the 
                    addStudyStepOrdering($stepId, $groupId, $i+1);
                }
            }
        }

        $this->print_messageln("done!");
    }

    /**
     * Adds one entry to the `study_participant_steps` table for each step a
     * participant's group has specified. This forks the annotation (when
     * appropriate) associated with the study_step. Assumes each step has been
     * added to the database and has a corresponding `db_id` key in the study
     * object.
     * 
     * @param study The study object.
     */
    function addParticipantSteps(&$study){
        $this->print_message("Adding participant steps...");

        foreach($study["participants"] as $participant){
            // Ensure the user has an id.
            if(!array_key_exists("db_id", $participant)){
                throw new Exception("Error adding participant steps for ". 
                    "participant '${participant["username"]}': no 'db_id' ". 
                    "field!");
            }

            // Go through each step associated with the participant's group.
            foreach($study["groups"][$participant["group"]]["step_ordering"] as
                    $stepName){
                if(!array_key_exists($stepName, $study["steps"])){
                    throw new Exception(
                        "Error adding participant steps for ". 
                        "participant '${participant["username"]}': no step ". 
                        "with name '$stepName' found in the 'steps' section ". 
                        "of the study configuration.");
                }

                $step = $study["steps"][$stepName];

                if(!array_key_exists("db_id", $step)){
                    throw new Exception(
                        "Error adding participant steps for ". 
                        "participant '${participant["username"]}': the step ". 
                        "named '$stepName' is missing a 'db_id' field.");
                }

                // Skip if this participant+step combo has already been 
                // processed (i.e., there's already an entry in the database).
                if(getStudyParticipantStep(
                        $participant["db_id"], $step["db_id"])){
                    continue;
                }

                // If this step is associated with a URL, this will stay null. 
                // Otherwise, we need to fork the base annotation.
                $annotationId = null;

                // Is this an annotation-based step?
                if(array_key_exists("annotation", $step)){

                    // Ensure the annotation exists.
                    if(!array_key_exists($step["annotation"], 
                            $study["annotations"])){
                        throw new Exception(
                            "Error adding participant steps for ". 
                            "participant '${participant["username"]}', step ". 
                            "'$stepName': cannot find '${step["annotation"]}' ". 
                            "in the annotations section of the configuration.");
                    }

                    $annotation = $study["annotations"][$step["annotation"]];

                    if(!array_key_exists("db_id", $annotation)){
                        throw new Exception(
                            "Error adding participant steps for ". 
                            "participant '${participant["username"]}', step ". 
                            "'$stepName': the annotation ". 
                            $step["annotation"] ."' is missing a 'db_id' ". 
                            "field.");
                    }

                    $annotationBaseId = $annotation["db_id"];

                    // Fork the base annotation for this step.
                    $annotationId = $this->forkAnnotation($annotationBaseId, 
                            $participant["db_id"]);
                }

                addStudyParticipantStep($participant["db_id"], $step["db_id"], 
                    $annotationId);
            }
        }

        $this->print_messageln("done!");
    }

    /**
     * Creates a fork of the given annotation, then assigns permissions so that
     * only the given user can access it.
     * 
     * @param annotationId The id of the annotation to fork.
     * @param userId The id of the user who should have access.
     * @return The id of the forked annotation.
     */
    function forkAnnotation($parentAnnotationId, $userId){
        global $PERMISSIONS;

        // Get the info about the parent annotation.
        $parentAnnotation = lookupAnnotation($parentAnnotationId);

        // Create the new annotation, mirroring all the metadata from the
        // parent.
        $annotationId = addAnnotation($userId, $parentAnnotation["text_id"],
            $parentAnnotationId, $parentAnnotation["annotation"], 
            $parentAnnotation["method"], $parentAnnotation["method_metadata"], 
            $parentAnnotation["label"]);

        // Make the annotation private.
        updateAnnotation($annotationId, $userId, null, false);
        // Give the user write permissions for it.
        addAnnotationPermission($userId, $annotationId, $PERMISSIONS["WRITE"]);

        return $annotationId;
    }

    /**
     * Credit: Scott Arciszewski, taken from 
     * https://stackoverflow.com/a/31284266
     * on 12-Nov-2019 then slightly modified by Hank Feild.
     * 
     * Generate a random string, using a cryptographically secure 
     * pseudorandom number generator (random_int)
     * 
     * For PHP 7, random_int is a PHP core function
     * 
     * @param int $length      How many characters do we want?
     * @return A random string
     */
    function generatePassword($length=10){
        $keyspace = "0123456789abcdefghijklmnopqrstuvwxyz". 
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        $str = "";
        $max = mb_strlen($keyspace, "8bit") - 1;
        for ($i = 0; $i < $length; ++$i) {
            $str .= $keyspace[random_int(0, $max)];
        }
        return $str;
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