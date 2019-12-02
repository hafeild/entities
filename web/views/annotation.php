<script src="https://d3js.org/d3.v5.min.js"></script>
<script src="/js/network-viz.js"></script>
<script src="/js/annotation-manager.js"></script>
<script src="/js/annotations.js"></script>
<script src="/js/permissions.js"></script>
<script src="/js/ui-updater.js"></script>

<?php if($data["is_study"]) { ?>
<script src="/js/study-logging.js"></script>
<?php } ?>


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


<div class="header page-info" 
    data-uri="/annotations/<?= 
        $data["annotation"]["annotation_id"] ?>"
    <?php if($data["is_study"]) { ?>
    data-study-uri="/studies/<?= $data["step_data"]["study_id"] ?>/steps/<?= $data["step_data"]["step_id"] ?>""
    <?php } ?>
    >
    <h2>
        <a href="/texts/<?= $data["text"]["id"] ?>/annotations"><em>"<?= 
            $data["text"]["title"] ?>"</em> Annotations</a> : 
            <?= $data["annotation"]["label"] == "" ? 
                ("Annotation ". $data["annotation"]["annotation_id"]) : 
                $data["annotation"]["label"] ?>
    </h2>
    Annotation by <?= $data["annotation"]["username"] ?> <br/>

    <?php // For study annotations only. ?>
    <?php if($data["is_study"]) { ?>
        <form class="completed-step-form" method="post" 
            action="/studies/<?= $data["step_data"]["study_id"] ?>/steps/<?= $data["step_data"]["step_id"] ?>/complete" onsubmit="return confirm('Are you sure you are completed annotating this text? Changes cannot be made once you\'ve selected \'OK\'.');">
            <button class="btn btn-danger btn-md 
                finished-annotating-button">
                Finished annotating</button>
        </form>
    <?php } ?>


    <?php // Fork. Only available to logged in users and non-study annotations. ?>
    <?php if($user != null && !$data["is_study"]){ // Begin logged-in user only section. ?>


        <!-- Button trigger modal -->
        <button type="button" class="btn btn-primary btn-md fork-button" 
            data-toggle="modal" data-target="#fork-modal">
        Fork
        </button>
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
    if(ownsAnnotation($data["annotation"]["annotation_id"])){ ?>

    <button type="button" class="btn btn-primary btn-md sharing-button" 
        data-toggle="modal" data-target="#sharing-modal">
    Share annotation
    </button>

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


    <?php } ?>



    <?php } ?>

<span id="graph-export" class="dropdown">
    <button class="btn btn-primary dropdown-toggle" type="button" data-toggle="dropdown">Export network
    <span class="caret"></span></button>
    <ul id="graph-export-dropdown" class="dropdown-menu">
        <li class="graph-export-option" id="graph-export-tsv">TSV</li>
        <li class="graph-export-option" id="graph-export-graphml">graphML</li>
    </ul>
</span>
</div> <!-- /.header -->

<br id="selection-info-box-marker"/>
<div id="selectionInfoBox">
    <p class="selectionInfo" id="entityInfoBox">0 entities selected</p>
    <p class="selectionInfo" id="mentionInfoBox">0 mentions selected</p>
    <p class="selectionInfo" id="groupInfoBox">0 alias groups selected</p>
    <p class="selectionInfo" id="resetSelectionButton" style="display: inline-block; text-decoration: underline; cursor: pointer">reset</p>
</div>

<div id="annotation-panels-wrapper">
    <div id="annotation-panels">
        <div id="entity-panel-wrapper">
            <div id="entity-panel" class="panel">
                <div id="entity-list">
                </div>
                <script>
                    annotation_data = <?= json_encode($data["annotation"]) ?>;
                    annotationManager = AnnotationManager(annotation_data);
                    displayAnnotation();
                </script>
            </div>
        </div>


        <div id="text-panel-wrapper">
            <!-- Text goes here... -->
            <div id="text-panel" class="panel">
                <span id="end-marker"></span>
            </div>
            <script>
                var tokens = <?php readfile($data["text"]["content_file"]) ?>;
                initializeTokenizedContent();
                // For testing only!
                // findTies(30);
            </script>
            <span id="fullscreen-button" onclick="openNav()"><span class="glyphicon glyphicon-fullscreen"/></span>    
        </div>


        <div id="network-panel" class="panel">
            
            <svg id="network-svg"></svg>
            <script>
                networkViz.init();
                networkViz.loadNetwork(annotation_data.annotation);
            </script>
        </div>
    </div>
</div>

<div id="fullscreenTextOverlay" class="overlay">
  <a href="javascript:void(0)" id="overlayCloseButton" class="closebtn" onclick="closeNav()">&times;</a>
  <h2 id="overlay-text-title">
      <a style="display: inline-block; color: #337ab7;" href="/texts/<?= $data["text"]["id"] ?>/annotations"><em>"<?= 
          $data["text"]["title"] ?>"</em> Annotations</a> : 
          <?= $data["annotation"]["label"] == "" ? 
              ("Annotation ". $data["annotation"]["annotation_id"]) : 
              $data["annotation"]["label"] ?>
  </h2>  
  <div id="fullscreenTextOverlayContent" class="overlay-content">

  </div>
  <script>
    function openNav() {
        $(document).trigger('entities.fullscreen-enabled');
        $("#text-panel").detach().appendTo('#fullscreenTextOverlayContent');
        $('#selectionInfoBox').detach().insertAfter('#overlay-text-title');
        $('#selectionInfoBox').addClass('selectionBox-inOverlay');
        $('#fullscreenTextOverlay').css("width", "100%");
    }

    function closeNav() {
        $(document).trigger('entities.fullscreen-disabled');
        $('#fullscreenTextOverlay').css("width", "0%");
        $("#text-panel").detach().appendTo('#text-panel-wrapper');
        $('#selectionInfoBox').detach().insertAfter('#selection-info-box-marker');
        $('#selectionInfoBox').removeClass('selectionBox-inOverlay');
    }
    </script>
</div>
