<script src="https://d3js.org/d3.v5.min.js"></script>
<script src="/js/network-viz.js"></script>
<script src="https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js"></script>
<script src="/js/annotation-manager.js"></script>
<script src="/js/token-navigator.js"></script>
<script src="/js/entities-panel-manager.js"></script>
<script src="/js/annotations.js"></script>
<script src="/js/permissions.js"></script>
<script src="/js/ui-updater.js"></script>
<script src="/js/general.js"></script>

<?php if($data["is_study"]) { ?>
<script src="/js/study-logging.js"></script>
<?php } ?>



<div class="header page-info" 
    data-uri="/annotations/<?= 
        $data["annotation"]["annotation_id"] ?>"
    <?php if($data["is_study"]) { ?>
    data-study-uri="/studies/<?= $data["step_data"]["study_id"] ?>/steps/<?= $data["step_data"]["step_id"] ?>""
    <?php } ?>
    >


    

</div> <!-- /.header -->

<div id="error-alert" class="hidden alert alert-danger alert-dismissible" role="alert">
  <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>
  <span class="content"></span>
</div>


<!-- Menu for entity panel "alias options" -->
<ul id="entities-panel-alias-edit-menu" class="hidden entities-panel-menu">
    <li class="rename-option clickable">Rename alias</li>
    <li class="associate-option"><span class="menu-label">Associate with another entity</span>
        <ul class="submenu">
            <li class="top-suggestions"><span class="menu-label">Top suggestions</span>
                <ul>
                    <li class="alias-group">No suggestions</li>
                </ul>
            </li>
            <li class="all-entities"><span class="menu-label">All entities</span>
                <ul>
                    <li class="alias-group clickable">Test group A</li>
                </ul>
            </li>
        </ul>
    </li>
    <div class="hidden templates">
        <li class="clickable alias-group"></li>
    </div>
</ul>
<!-- Menu for entity panel "entity (alias group) options" -->
<ul id="entities-panel-alias-group-edit-menu" class="hidden entities-panel-menu">
    <li class="rename-option clickable">Rename entity</li>
    <li class="associate-option"><span class="menu-label">Associate all aliases with another entity</span>
        <ul class="submenu">
            <li class="top-suggestions"><span class="menu-label">Top suggestions</span>
                <ul>
                    <li class="alias-group">No suggestions</li>
                </ul>
            </li>
            <li class="all-entities"><span class="menu-label">All entities</span>
                <ul>
                    <li class="alias-group clickable">Test group A</li>
                </ul>
            </li>
        </ul>
    </li>
    <div class="hidden templates">
        <li class="clickable alias-group"></li>
    </div>
</ul>


<div id="annotation-panels-wrapper">

    <?php if($data["annotation"]["automated_method_error"]){ ?>

        <div class="processing">
        We encountered an error while processing this annotation :( <br/>
        Try creating a new annotation.
        <br/>
        <span class="loader"></span> 
    </div>

    <?php } else if($data["annotation"]["automated_method_in_progress"]){ ?>

    <div class="processing">
        Your annotation is being processed. Please be patient as this may take 
        some time.
        <br/>
        <span class="loader"></span> 
    </div>
    <script>
        setTimeout(()=>{window.location.reload(true);}, 5000);
    </script>

    <?php } ?>

    <div id="annotation-panels">
        <div id="entity-panel-wrapper">
            <div id="entities-panel" class="entities-panel">
                <div id="alias-groups">
                </div>

                <!-- Entity panel templates -->
                <div class="templates hidden">
                    <!-- Alias group -->
                    <div class="alias-group" data-id="">
                        <div class="alias-group-name-wrapper name-wrapper">
                            <span class="name"></span>
                            <form class="name-edit hidden">
                                <input name="name" type="text"/>
                                <input type="submit" class="submit-name-edit btn btn-primary btn-xs" value="Done"/>
                            </form>
                            <span class="alias-group-options options">
                                <span class="glyphicon glyphicon-option-vertical" aria-hidden="true"></span>
                            </span>
                        </div>
                        <div class="aliases"></div>
                    </div>

                    <!-- Entity -->
                    <span class="entity name-wrapper" data-id="">
                        <span class="name"></span>
                        <form  class="name-edit hidden">
                            <input name="name" type="text"/>
                            <input type="submit" class="submit-name-edit btn btn-primary btn-xs" value="Done"/>
                        </form>
                        <span class="entity-options options">
                                <span class="glyphicon glyphicon-option-vertical" aria-hidden="true"></span>
                            </a>
                        </span>
                    </span>
                </div>

                <script>
                    annotation_data = <?= json_encode($data["annotation"]) ?>;
                    annotationManager = AnnotationManager(annotation_data);
                    tokenNavigator = TokenNavigator(annotation_data);
                    entitiesPanelManager = EntitiesPanelManager(annotationManager);
                    entitiesPanelManager.addAliasGroupsFromAnnotation();
                    // displayAnnotation();
                </script>
            </div>
        </div>


        <div id="text-panel-wrapper">
            <!-- Text goes here... -->
            <div id="text-panel" class="entities-panel">
                <span id="end-marker"></span>
            </div>
            <?php if(!$data["annotation"]["automated_method_in_progress"] && 
                !$data["annotation"]["automated_method_error"]){ ?>

            <div id="text-contents" class="hidden">
                <?php readfile($data["text"]["content_file"]); ?>
            </div>
            <script>
                var tokens = JSON.parse($('#text-contents').html().replace(/,\s*\]\s*$/, ']'));
                initializeTokenizedContent();
                // For testing only!
                // findTies(30);
            </script>
            <?php } ?>
            <span id="fullscreen-toggle-button" onclick="toggleFullscreen()">
                <span class="expand" data-toggle="tooltip" data-placement="left"
                    title="Maximize the text panel.">
                    <span class="glyphicon glyphicon-resize-full"></span>
                </span>
                <span class="shrink" data-toggle="tooltip" data-placement="left"
                    title="Minimize the text panel.">
                    <span class="glyphicon glyphicon-resize-small"></span>
                </span>
            </span>  

            <!-- Status bar. -->
            <span id="selection-info-box-marker"></span>
            <div id="selection-info-box">
                <span class="selection-info" id="entityInfoBox">0 entities selected</span> |
                <span class="selection-info" id="mentionInfoBox">0 mentions selected</span> |
                <span class="selection-info" id="groupInfoBox">0 alias groups selected</span> |
                <span class="selection-info btn btn-xs btn-primary" id="resetSelectionButton">Clear</span>
            </div>
        </div>


        <div id="network-panel" class="entities-panel">
            
            <svg id="network-svg"></svg>
            <script>
                networkViz.init();
                networkViz.loadNetwork(annotation_data.annotation);
            </script>
        </div>

    </div>

</div>







<!-- Add Mention Modal -->
<div class="modal fade" id="addMentionModal" role="dialog">
    <div class="modal-dialog">
    
        <!-- Add Mention Modal content-->
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" 
                    id="addMentionModalClose" data-dismiss="modal">
                    &times;</button>
                <h4 class="modal-title">Add Mention</h4>
            </div>
            <div class="modal-body">
                <div class="recentlySeenWrapper">
                    <h2>Most recently mentioned entities</h2>
                    <ul class="modalSelector recentlySeenList"></ul>
                    <hr/>
                </div>
                <h2>All entities</h2>
                <ul class="modalSelector" 
                    id="addMentionEntitySelectorChecklist">
                </ul>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" 
                    id="confirmAddMention" data-dismiss="modal">
                    Confirm</button>
            </div>
        </div>
        
    </div>
</div>


<!-- Reassign Mention Modal -->
<div class="modal fade" id="reassignMentionModal" role="dialog">
    <div class="modal-dialog">
    
        <!-- Reassign Mention Modal content-->
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" 
                    id="reassignMentionModalClose" data-dismiss="modal">
                    &times;</button>
                <h4 class="modal-title">Reassign Mention</h4>
            </div>
            <div class="modal-body">
                <div class="recentlySeenWrapper">
                    <h2>Most recently mentioned entities</h2>
                    <ul class="modalSelector recentlySeenList"></ul>
                    <hr/>
                </div>

                <h2>All entities</h2>
                <ul class="modalSelector" 
                    id='reassignMentionEntitySelectorChecklist'>
                </ul>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" 
                    id="confirmReassignMention" data-dismiss="modal">
                    Confirm</button>
            </div>
        </div>
        
    </div>
</div>


<!-- Group Name Change Modal -->
<div class="modal fade" id="changeGroupNameModal" role="dialog">
    <div class="modal-dialog">
    
        <!-- Group Name Change Modal content-->
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" 
                    id="changeGroupNameModalClose" data-dismiss="modal">
                    &times;</button>
                <h4 class="modal-title">Change Group Name</h4>
            </div>
            <div class="modal-body">
                <input name="newGroupNameBox" class="form-control" 
                    placeholder="Enter a new group name" type="text" 
                    maxlength="512" id="newGroupNameBox"/>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" 
                    id="confirmGroupNameChange" data-dismiss="modal">
                    Confirm</button>
            </div>
        </div>
        
    </div>
</div>

<!-- Group Selector Modal -->
<div class="modal fade" id="groupSelectorModal" role="dialog">
    <div class="modal-dialog">
    
        <!-- Group Selector Modal content-->
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" 
                    id="groupSelectorModalClose" data-dismiss="modal"
                        >&times;</button>
                <h4 class="modal-title">Move Entity to Group</h4>
            </div>
            <div class="modal-body" id="groupSelectorModal-body">
                <ul class="modalSelector" id='groupSelectorChecklist'>
                </ul>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" 
                    id="confirmGroupSelect" data-dismiss="modal"
                        >Confirm</button>
            </div>
        </div>
        
    </div>
</div>  

<!-- Tie Selector Modal -->
<div class="modal fade" id="addTieModal" role="dialog">
    <div class="modal-dialog">
    
        <!-- Tie Modal content-->
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" 
                    id="tieSelectorModalClose" data-dismiss="modal">&times;</button>
                <h4 class="modal-title">Create a tie between two entities</h4>
            </div>
            <div class="modal-body" id="addTieModal-body">
                <div class="row" class="tie-modal-text-area" id="tieModalTextArea">
                </div>
                <div class="row">
                </div>
                <div class="row" id="tieModalObjectSelectors">
                    <div class="col-sm-6">
                    <div class="dropdown">
                        <button class="btn btn-primary dropdown-toggle" 
                            id="tieObjectOneDropdown" type="button" 
                            data-toggle="dropdown">Object One
                        <span class="caret"></span></button>
                        <ul class="dropdown-menu tieObjectSelector" 
                            id="tieObjectOneSelector">
                        
                        </ul>
                    </div>
                    </div>
                    <div class="col-sm-6">
                    <div class="dropdown">
                        <button class="btn btn-primary dropdown-toggle" 
                            id="tieObjectTwoDropdown" type="button" 
                            data-toggle="dropdown">Object Two
                        <span class="caret"></span></button>
                        <ul class="dropdown-menu tieObjectSelector" 
                            id="tieObjectTwoSelector">
                        
                        </ul>
                    </div>
                    </div>
                </div>
                <hr />
                <div class="row" style="margin-top: 20px">
                    <div class="col-sm-1"></div>
                    <div class="col-sm-4">
                    <div style="float: left">
                        <input name="tieWeightBox" class="form-control" 
                            value="1" type="number" id="tieWeightBox"/>
                        <label style="width: 100%; text-align: center;" 
                            for="tieWeightBox">Weight</label>
                    </div>
                    </div>
                    <div class="col-sm-4">
                    <div style="float: left">
                        <input name="tieNameBox" class="form-control" 
                            placeholder="" type="text" maxlength="100" 
                            id="tieNameBox"/>
                        <label style="width: 100%; text-align: center;" 
                            for="tieWeightBox">Label</label>
                    </div>
                    </div>
                    <div class="col-sm-3" style="margin-top: 10px;">
                    <div class="form-check">
                        <div class="pretty p-switch p-fill">
                        <input name="tieDirectedToggle" 
                            class="form-check-input" type="checkbox" 
                            id="tieDirectedToggle" />
                        <div class="state p-primary">
                            <label style="width: 100%; text-align: center;" 
                                class="form-check-label" 
                                for="tieDirectedToggle">
                                Directed 
                            </label>
                        </div>
                        </div>
                    </div>
                    </div>        
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" 
                id="confirmAddTie" data-dismiss="modal">Confirm</button>
            </div>
        </div>
        
    </div>
</div>  

<!-- Edit Tie Selector Modal -->
<div class="modal fade" id="editTieModal" role="dialog">
    <div class="modal-dialog">
    
        <!-- Edit Tie Modal content-->
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" 
                    id="tieSelectorModalClose" data-dismiss="modal">&times;</button>
                <h4 class="modal-title">Edit Tie</h4>
            </div>
            <div class="modal-body" id="editTieModal-body">
                <div class="row" class="tie-modal-text-area" id="edit-tieModalTextArea">
                </div>
                <div class="row">
                </div>
                <div class="row" style="margin-top: 20px">
                    <div class="col-sm-1"></div>
                    <div class="col-sm-4">
                    <div style="float: left">
                        <input name="tieWeightBox" class="form-control" 
                            value="1" type="number" id="edit-tieWeightBox"/>
                        <label style="width: 100%; text-align: center;" 
                            for="tieWeightBox">Weight</label>
                    </div>
                    </div>
                    <div class="col-sm-4">
                    <div style="float: left">
                        <input name="tieNameBox" class="form-control" 
                            placeholder="" type="text" maxlength="100" 
                            id="edit-tieNameBox"/>
                        <label style="width: 100%; text-align: center;" 
                            for="tieWeightBox">Label</label>
                    </div>
                    </div>
                    <div class="col-sm-3" style="margin-top: 10px;">
                    <div class="form-check">
                        <div class="pretty p-switch p-fill">
                        <input name="tieDirectedToggle" 
                            class="form-check-input" type="checkbox" 
                            id="edit-tieDirectedToggle" />
                        <div class="state p-primary">
                            <label style="width: 100%; text-align: center;"
                                class="form-check-label" 
                                for="tieDirectedToggle">
                                Directed 
                            </label>
                        </div>
                        </div>
                    </div>
                    </div>        
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" 
                    id="confirmEditTie" data-dismiss="modal">Confirm</button>
            </div>
        </div>
        
    </div>
</div> 

<!-- hidden buttons that allows for the bootstrap modal to open -->
<button class="hidden-modal-button" id="addMentionModalOpener" 
    data-toggle="modal" data-target="#addMentionModal"></button>
<button class="hidden-modal-button" id="reassignMentionModalOpener" 
    data-toggle="modal" data-target="#reassignMentionModal"></button>
<button class="hidden-modal-button" id="changeGroupnameModalOpener" 
    data-toggle="modal" data-target="#changeGroupNameModal"></button>
<button class="hidden-modal-button" id="groupSelectorModalOpener" 
    data-toggle="modal" data-target="#groupSelectorModal"></button>
<button class="hidden-modal-button" id="addTieModalOpener" 
    data-toggle="modal" data-target="#addTieModal"></button>
<button class="hidden-modal-button" id="editTieModalOpener" 
    data-toggle="modal" data-target="#editTieModal"></button>


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
 * @param readOnly If true, the delete button will not be included and the 
 *                 dropdown for permisison level will be disabled.
 */
function printUserPermissionControls($permissionUser, $readOnly = false){
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
        <select class="permission-level" autocomplete="off" 
            name="permission-level<?= $randNum ?>"
            <?= $permissionUser["user_id"] == $user["id"] ? 
                "disabled=\"disabled\"" : "" ?>
            <?= $readOnly ? "disabled" : "" ?>>
            <option value="NONE" <?= 
                $permissionUser["permission"] == $PERMISSIONS["NONE"] ? 
                "selected=\"selected\"" : "" ?>>Cannot access this page</option>
            <option value="READ" <?= 
                $permissionUser["permission"] == $PERMISSIONS["READ"] ? 
                "selected=\"selected\"" : "" ?>>Can view this page</option>
            <option value="WRITE" <?= 
                $permissionUser["permission"] == $PERMISSIONS["WRITE"] ? 
                "selected=\"selected\"" : "" ?>>Can modify this page 
                (e.g., title, annotations)</option>
            <option value="OWNER" <?= 
                $permissionUser["permission"] == $PERMISSIONS["OWNER"] ? 
                "selected=\"selected\"" : "" ?>>Can manage permissions on 
                this page</option>
        </select>
        <?php if($permissionUser["user_id"] != $user["id"] && !$readOnly) { ?>
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

<?php // Fork. Only available to logged in users and non-study annotations. ?>
<?php if($user != null && !$data["is_study"]){ // Begin user logged-in, non-study.  ?>

<div class="modal fade" tabindex="-1" role="dialog" id="fork-modal">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <?php 
            // Goes to: 
            // POST /texts/:textId/annotations/:annotationId
            // with parameters: method (manual or tie-window) and
            // n (if tie-window selected).
            ?>
            <form action="/texts/<?= $data["text"]["id"] ?>/annotations/<?= 
                $data["annotation"]["annotation_id"] ?>" method="POST">

                <div class="modal-header">
                    <button type="button" class="close" 
                        data-dismiss="modal" aria-label="Close"
                        ><span aria-hidden="true">&times;</span>
                    </button>
                    <h4 class="modal-title">Fork this annotation</h4>

                </div>
                <div class="modal-body">
                    <div>
                        <label>
                            Give your new fork a name
                        </label>
                        <input type="text" class="form-control"
                            name="label" placeholder="A descriptive name"/>
                    </div>
                    <br/>
                    <div>
                        <label>
                            Select the type of fork you'd like to make
                        </label>
                        <ul>
                            <div class="radio">
                                <label>
                                    <input type="radio" name="method" 
                                        value="manual" checked/>
                                    Basic fork (for further manual annotations)
                                </label>
                            </div>
                            <hr/>
                            <div class="radio">
                                <label>
                                    <input type="radio" name="method" 
                                        value="tie-window"/>
                                    Fork and extract ties (Window method)
                                </label>
                                <div>
                                    <label>Window size: <input type="number" 
                                        name="n" value="30"/></label>
                                </div>
                            </div>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-danger" 
                        data-dismiss="modal">Cancel</button>
                    <input type="submit" class="btn btn-primary"
                        value="Fork"/>
                </div>
            </form>
        </div><!-- /.modal-content -->
    </div><!-- /.modal-dialog -->
</div><!-- /.modal -->


<?php
// Sharing settings are only exposed to owners.
global $PERMISSIONS;
if(ownsAnnotation($data["annotation"]["annotation_id"])){ // Begin owner-only section.
 
?>


<div class="modal fade" tabindex="-1" role="dialog" id="sharing-modal">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal"
                    aria-label="Close"
                    ><span aria-hidden="true">&times;</span>
                </button>
                <h4 class="modal-title">Annotation sharing settings</h4>

            </div>
            <div class="modal-body">
                <p>
                    Select the options below to specify who can see, modify,
                    and manage this text. These will apply to all annotations
                    of the text, but you may add different permissions 
                    per-annotation. Annotation-level permissions take 
                    precedence over text-level permissions.
                </p>

                <!-- Public setting of this page. -->
                <div class="form-group is-public-form-group">
                    <label>Public settings</label><br/>
                    <p>
                    Please choose whether anyone can view this, even if not
                    logged in or if you have assigned a user the "Cannot 
                    access" permission below.
                    </p>
                    <select id="is-public" name="is_public<?= $randNum ?>"
                        autocomplete="off">
                        <option value="null" <?= 
                            $data["annotation"]["is_public"] == "null" ? 
                                "selected" : "" ?>>
                            Use the text's public access (currently 
                            <?= $data["text"]["is_public"] ? 
                            "public" : "private" ?>)
                        </option>
                        <option value="true" <?= 
                            $data["annotation"]["is_public"] === true  ? 
                                "selected" : "" ?>>
                            Public: anyone can view this annotation
                        </option>
                        <option value="false" <?= 
                            $data["annotation"]["is_public"] === false ? 
                                "selected" : "" ?>>
                            Private: only users with explicit permission 
                            may view this page
                        </option>
                    </select>
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
                        <option value="NONE">Cannot access this 
                            page</option>
                        <option value="READ" selected>Can view this 
                            page</option>
                        <option value="WRITE">Can modify this page 
                            <br/>(e.g., title, annotations)</option>
                        <option value="OWNER">Can manage permissions on 
                            this page</option>
                    </select>
                    <button type="submit" aria-label="Add permission"
                        class="btn btn-primary btn-xs" 
                        id="add-new-permission"><span 
                        class="glyphicon glyphicon-plus"></span></button>
                    </form>
                </div>

                <!-- Existing per-user annotation permissions. -->
                <div class="form-group existing-permissions">
                    <label>Existing user permission for this annotation</label><br/>
                    <p>These override the text-level permissions listed
                    below.</p>
                    <!-- List users with permission for this text here. -->
                    <?php 
                    $permissionsByUser = getAnnotationPermissions(
                        $data["annotation"]["annotation_id"]); 

                    // Add a template permission div for AJAX purposes.
                    printUserPermissionControls(null);
                    // Add controls for each user permission. 
                    foreach($permissionsByUser as $permissionUser){ 
                        printUserPermissionControls($permissionUser);
                    }
                ?> 
                </div>
                <hr/>
                <!-- Existing per-user text permissions. -->
                <div class="form-group existing-text-permissions">
                    <label>Existing user permission for this text</label><br/>
                    <p>Override these by adding annotation-specific settings
                        above, or <a href="/texts/<?= 
                        $data["text"]["id"]?>/annotations"
                        >change them for the text here</a>.</p>
                    <!-- List users with permission for this text here. -->
                    <?php 
                    $permissionsByUser = getTextPermissions($data["text"]["id"]); 

                    // Add controls for each user permission. 
                    foreach($permissionsByUser as $permissionUser){ 
                        printUserPermissionControls($permissionUser, true);
                    }
                ?> 
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" 
                    data-dismiss="modal">Done</button>
            </div>
        </div><!-- /.modal-content -->
    </div><!-- /.modal-dialog -->
</div><!-- /.modal -->


<!-- Renaming -->
<div class="modal fade" tabindex="-1" role="dialog" id="rename-modal">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal"
                    aria-label="Close"
                    ><span aria-hidden="true">&times;</span>
                </button>
                <h4 class="modal-title">Rename annotation</h4>

            </div>
            <form id="annotation-label-form">

                <div class="modal-body">
                    <div class="form-group">
                        <label>Text title</label>
                        <br/>
                            <input type="text" 
                                name="newAnnotationLabel"
                                class="form-control"
                                value="<?= htmlentities($data["annotation"]["label"]) ?>">
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-danger" 
                            data-dismiss="modal">Cancel</button>
                    <input type="submit" type="button" 
                        class="btn btn-primary" value="Save">
                </div>
            </form>
        </div><!-- /.modal-content -->
    </div><!-- /.modal-dialog -->
</div><!-- /.modal -->

    <?php } // End owner-only section. ?>
<?php } // End user logged-in, non-study. ?>
