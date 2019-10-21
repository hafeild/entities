<script src="/js/permissions.js"></script>

<div id="annotations" class="page" data-uri="/texts/<?= $data["text"]["id"] ?>">
    <h2><em>"<?= $data["text"]["title"] ?>"</em> Annotations</h2>

<?php
// Put the annotations in a tree structure based on parent_annotation_id. 
$annotationNodeLookup = [];
$annotationTreeRoot = null;
foreach($data["annotations"] as $annotation){
    if($annotationTreeRoot == null){
        $annotationNodeLookup[$annotation["annotation_id"]] = ["data" => $annotation, "children" => []];
        $annotationTreeRoot =& $annotationNodeLookup[$annotation["annotation_id"]];

    // This case shouldn't happen...
    } elseif(!array_key_exists($annotation["parent_annotation_id"], $annotationNodeLookup)){
        // Yuck!!
        print "Something terrible happened!";

    } else {
        $annotationNodeLookup[$annotation["annotation_id"]] = ["data" => $annotation, "children" => []];
        // $parent =& $annotationNodeLookup[$annotation["parent_annotation_id"]];
        // array_push($parent["children"], $annotationNodeLookup[$annotation["annotation_id"]]);

        $annotationNodeLookup[$annotation["parent_annotation_id"]]["children"][]
            =& $annotationNodeLookup[$annotation["annotation_id"]];

    }
}

$randNum = rand();
?>


<?php 
/**
 * @param permissionUser A text_permissions row with a username field. Should
 *      have these fields:
 *          - username
 *          - user_id
 *          - id (in text_permissions)
 *          - permission
 *      If null, a hidden template will be emitted with the DOM id 
 *      "permission-template".
 */
function printUserPermissionControls($permissionUser){
    global $PERMISSIONS, $user, $randNum;
    if($permissionUser == null){
        $permissionUser = [
            "id" => "",
            "permission" => 0,
            "username" => "",
            "user_id" => 0
        ];
    }
?>
    <div <?= $permissionUser["id"] == "" ? "id=\"permission-template\"" : "" ?> 
        data-permission-id="<?= $permissionUser["id"] ?>" class="permission-control">
        <span class="permission-username"><?= $permissionUser["username"] ?></span>
        <select class="permission-level" name="permission-level<?= $randNum ?>"
            <?= $permissionUser["user_id"] == $user["id"] ? "disabled" : "" ?>>
            <option value="READ" <?= 
                $permissionUser["permission"] == $PERMISSIONS["READ"] ? 
                "selected" : "" ?>>Can view this page</option>
            <option value="WRITE" <?= 
                $permissionUser["permission"] == $PERMISSIONS["WRITE"] ? 
                "selected" : "" ?>>Can modify this page 
                (e.g., title, metadata)</option>
            <option value="OWNER" <?= 
                $permissionUser["permission"] == $PERMISSIONS["OWNER"] ? 
                "selected" : "" ?>>Can manage permissions on 
                this page</option>
        </select>
        <?php if($permissionUser["user_id"] != $user["id"]) { ?>
        <button type="button" aria-label="Remove permission"
            class="btn btn-danger btn-xs remove-permission"
            id="remove-permission"><span 
            class="glyphicon glyphicon-trash"></span></button>
        <span class="saved-icon hidden"
            ><span class="glyphicon glyphicon-floppy-saved"
            ></span></span>
        <?php } ?>

    </div>
<?php
}
?>


<?php if($user != null){ // Begin logged-in user only section. ?>

    <?php
    // Sharing settings are only exposed to owners.
    global $PERMISSIONS;
    if(ownsText($data["text"]["id"])){ ?>

    <!-- Run annotation. -->
    <!-- Button trigger modal -->
    <button type="button" class="btn btn-primary btn-md sharing-button" 
        data-toggle="modal" data-target="#sharing-modal">
    Share text
    </button>

    <div class="modal fade" tabindex="-1" role="dialog" id="sharing-modal">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal"
                        aria-label="Close"
                        ><span aria-hidden="true">&times;</span>
                    </button>
                    <h4 class="modal-title">Text sharing settings</h4>

                </div>
                <div class="modal-body">
                    <p>
                        Select the options below to specify who can see, modify,
                        and manage this text. These will apply to all annotations
                        of the text, but you may add different permissions 
                        per-annotation. Annotation-level permissions take 
                        precedence text-level permissions.
                    </p>

                    <!-- Public setting of this page. -->
                    <div class="form-group is-public-form-group">
                        <label>Public settings</label><br/>
                        <input type="checkbox" id="is-public" 
                            name="is_public<?= $randNum ?>" 
                            value="true" autocomplete="off">
                            Anyone can view this page
                            <span class="saved-icon hidden"
                                ><span class="glyphicon glyphicon-floppy-saved"
                                ></span></span>
                    </div>

                    <!-- New per-user permission form. -->
                    <div class="form-group new-permission-form">
                        <label>Add permissions for another EntiTies user</label>
                        <br/>
                        <form id="new-permission">
                        <input type="text" 
                            name="new-permission-username<?= $randNum ?>" 
                            id="new-permission-username" 
                            class="permission-username" placeholder="user1234"
                            autocomplete="off">
                        <select id="new-permission-level" 
                            name="new-permission-level<?= $randNum ?>"
                            autocomplete="off">
                            <option value="READ" selected>Can view this 
                                page</option>
                            <option value="WRITE">Can modify this page 
                                (e.g., title, metadata)</option>
                            <option value="OWNER">Can manage permissions on 
                                this page</option>
                        </select>
                        <button type="submit" aria-label="Add permission"
                            class="btn btn-primary btn-xs" 
                            id="add-new-permission"><span 
                            class="glyphicon glyphicon-plus"</span></button>
                        </form>
                    </div>

                    <!-- Existing per-user permissions. -->
                    <div class="form-group existing-permissions">
                        <label>Existing user permission for this text</label><br/>
                        <!-- List users with permission for this text here. -->
                        <?php 
                        $permissionsByUser = getTextPermissions($data["text"]["id"]); 

                        // Add a template permission div for AJAX purposes.
                        printUserPermissionControls(null);
                        // Add controls for each user permission. 
                        foreach($permissionsByUser as $permissionUser){ 
                            printUserPermissionControls($permissionUser);
                        }
                    ?> 
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-danger" 
                        data-dismiss="modal">Cancel</button>
                    <input type="submit" class="btn btn-primary"
                        value="Run"/>
                </div>
            </div><!-- /.modal-content -->
        </div><!-- /.modal-dialog -->
    </div><!-- /.modal -->


    <?php } ?>


    <h3>Creating a new annotation</h3>
    <p>
    You can create an annotation in two ways:
    </p>

    <p>
    <strong>Method 1: Manual annotation</strong><br/>
    Click on an annotation below to load it, then click on "Fork" to create a new 
    annotation based on the one you selected. If you want to start from scratch,
    click the very first annotation ("blank slate").
    </p>

    <p>
    <strong>Method 2: Automatic annotation</strong><br/>
    Click the button below and select the algorithm you'd like to use. It may take 
    several minutes for our servers to carry out the annotation, so be patient!
    </p>

    <!-- Run annotation. -->
    <!-- Button trigger modal -->
    <button type="button" class="btn btn-primary btn-md automatic-annotation-button" 
        data-toggle="modal" data-target="#automatic-annotation-modal">
    Run automatic annotation
    </button>

    <div class="modal fade" tabindex="-1" role="dialog" id="automatic-annotation-modal">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <form method="POST" 
                    action="/texts/<?= $annotationTreeRoot["data"]["text_id"] ?>/annotations/<?= $annotationTreeRoot["data"]["annotation_id"] ?>">
                    <div class="modal-header">
                        <button type="button" class="close" data-dismiss="modal"
                            aria-label="Close"
                            ><span aria-hidden="true">&times;</span>
                        </button>
                        <h4 class="modal-title">Run an automatic annotation</h4>

                    </div>
                    <div class="modal-body">
                        <p>
                            Select the annotation algorithm to run. This may take 
                            several minutes to process.
                        </p>
                        <div class="radio">
                            <label>
                                <input type="radio" name="method" value="booknlp"/>
                                BookNLP (entity annotations only)
                            </label>
                        </div>
                        <hr/>
                        <div class="radio">
                            <label>
                                <input type="radio" name="method" value="booknlp+tie-window"/>
                                BookNLP + window-based tie extraction (entity and tie annotations)
                            </label>
                            <div>
                                <label>Window size: <input type="number" name="n" value="30"/></label>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-danger" 
                            data-dismiss="modal">Cancel</button>
                        <input type="submit" class="btn btn-primary"
                            value="Run"/>
                    </div>
                </form>
            </div><!-- /.modal-content -->
        </div><!-- /.modal-dialog -->
    </div><!-- /.modal -->


<?php } // End logged-in user only section ?>


    <div id="annotation-list">
        <h3>Annotation List</h3>

        <ul>
            <?php 
                function traverseInOrder($node){
                    $annotation = $node["data"];
                    ?>
                    <li>(<?= $annotation["annotation_id"] ?>) 
                        [<?= $annotation["method"] ?>] 
                        <a href="/texts/<?= $annotation["text_id"] ?>/annotations/<?= $annotation["annotation_id"] ?>"
                        >"<?= ($annotation["label"] == "" ? ("annotation ". $annotation["annotation_id"]) : $annotation["label"]) ?>"</a> 
                        <?= ($annotation["method"] == "manual" ? (" annotated by ". $annotation["username"]) : "") ?>
                    <?php
                    // TODO -- update this logic to indicate if the root annotation
                    // has been tokenized or not. That's needed to continue...
                    if($annotation["automated_method_error"])
                        print " <span class=\"error\">(error processing)</span>";
                    elseif($annotation["automated_method_in_progress"])
                        print " <span class=\"note\">(processing...)</span>";
                    
                    // // Handle the case of the root not being ready yet.
                    // if($node["data"]["annotationId"] == $annotationTreeRoot["data"]["annotationId"]){
                    //     if($data["text"]["tokenization_error"]){

                    //     }
                    // }

                    if(count($node["children"]) > 0){
                        print "<ul>";
                        foreach($node["children"] as $childNode)
                            traverseInOrder($childNode);
                        print "</ul>";
                    }
                    print "</li>";
                }

                traverseInOrder($annotationTreeRoot);
            ?>
        </ul>

    </div>
</div>

