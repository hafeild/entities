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
//          - participants -- An array of objects that describe a participant.
//                            each object should have the following fields:
//              * username -- If this doesn't exist, a new user will be created.
//              * group -- The condition group to assign this participant to;
//                         you can change what steps/tasks participants in a 
//                         group see and in what order.
//          - steps -- A map of step labels -> information about the step.
//              * "step label" -- A convenience label used during the setup 
//                                process to refer to a specific step and
//                                cross-reference with step_orderings. 
//                  - link_description -- The text to display on the study page 
//                                        for this step.
//                  - url -- Use this if the step links out to an external page, 
//                           e.g., a questionnaire. Use this OR "annotation", 
//                           but not both.
//                  - annotation -- The annotation label to link this step with;
//                                  the step will link to a fork of the 
//                                  annotation specified. Use this OR "url", but
//                                  not both.
//          - step_orderings -- A map of group names -> an ordered list of steps
//                              to display for that group.
//              * "group name" -- Should align with the group name from the 
//                                participants section (see above).
//                  - (array) -- An ordered list of step labels (see the step 
//                               section above). This is the order in which the
//                               steps will be shown to subjects in the
//                               corresponding group. You do not need to list 
//                               every step for every group.


// Check arguments.
if(count($argv) == 1 || $argv[1] == "-h"){
    die("Usage: php initialize-study.php <study config file>|-h ". 
        "[<study config file> ...]\n\n". 
        "See the comment at the top of this script for format details.\n\n");
}

for($i = 1; $i < count($argv); $i++){
    // Read in the configuration file.
    $configFile = $argv[$i];
    $configFD = fopen($configFile, "r") or 
        error("Error reading configuration file.");
    $configContents = fread($configFD,filesize($configFile));
    // Strip out comments before parsing the config file.
    $config = json_decode(str_replace("\n", "", 
        preg_replace("#(^\s*//.*$)|(\s*$)|(^\s*)#m", "", 
        $configContents)), true);
    fclose($configFD);

    // Don't proceed if the file couldn't be parsed.
    if($config == NULL){
        print("Error parsing $configFile; skipping.\n");
        continue;
    }

    // Process each of the studies listed in the config file.
    foreach($config as $study){
        processStudy($study);
    }
}


/**
 * Processes the given study settings, creating users, tokenizing texts, 
 * processing annotations, forking annotations, setting permissions, and
 * filling out the study-related database tables as necessary.
 */
function processStudy($study){
    print "Processing ${study["name"]}\n";

}

/**
 * Loads any texts that aren't already in the database. Each text object is
 * updated with the text's id in the `texts` table under the field `db_id`.
 * 
 * @param study The study object. This is updated in place (see above).
 */
function loadTexts(&$study) {

}

/**
 * Processes any annotations that aren't already in the database. Each
 * annotation object is updated with the annotation's id in the `annotations`
 * table under the field `db_id`.
 * 
 * @param study The study object. This is updated in place (see above).
 */
function addAnnotations(&$study){

}


/**
 * Adds a new entry to the `studies` table. The id of the study is added to a
 * field named `db_id` in the $study parameter.
 * 
 * @param study The study object. This is updated in place (see above).
 */
function addStudy(&$study){

}

/**
 * Adds a new entries to the `study_groups` table. The id of each created group
 * is added under a field named `db_id` in the associated group of the $study
 * object passed in. Assumes the study has been added to the database and has a
 * corresponding `db_id` key.
 * 
 * @param study The study object. This is updated in place (see above).
 */
function addStudyGroups(&$study){

}

/**
 * Creates users listed in the `participants` section of the passed in map if
 * necessary and creates a new entry in the `study_participants` table. Each
 * participant object is updated with the user's id under the key `db_id`.
 * Assumes the study and groups have been added to the database and each have a
 * corresponding `db_id` key.
 * 
 * @param study The study object. This is updated in place (see above).
 */
function createParticipants(&$study){

}


/**
 * Adds a new entries to the `study_steps` table. The id of each created step
 * is added under a field named `db_id` in the associated group of the $study
 * object passed in. Assumes the study, groups, and annotations have been added
 * to the database and each have a corresponding `db_id` key.
 * 
 * @param study The study object. This is updated in place (see above).
 */
function addStudySteps(&$study){

}

/**
 * Adds the step orderings for each group. Assumes the study, groups, and
 * steps have been added to the database and each have a `db_id` key.
 * 
 * @param study The study object.
 */
function addStepOrderings(&$study){

}

/**
 * Adds one entry to the `study_participant_steps` table for each step a 
 * participant's group has specified. This forks the annotation (when 
 * appropriate) associated with the study_step. Assumes each step has been added
 * to the database and has a corresponding `db_id` key in the study object.
 * 
 * @param study The study object.
 */
function addParticipantSteps(&$study){

}

/**
 * Creates a fork of the given annotation, then assigns permissions so that only
 * the given user can access it.
 * 
 * @param annotationId The id of the annotation to fork.
 * @param userId The id of the user who should have access.
 * @return The id of the forked annotation.
 */
function forkAnnotation($annotationId, $userId){

}

?>