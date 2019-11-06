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
//          - step_orderings -- TODO


// Check arguments.
if(count($argv) == 1 || $argv[1] == "-h"){
    die("Usage: php initialize-study.php <study config file>|-h ". 
        "[<study config file> ...]\n\n");
}

for($i = 1; $i < count($argv)){
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
 * Processes each study in the file. 
 */
function processStudy($study){
    print "Processing ${study["name"]}\n";

}
?>