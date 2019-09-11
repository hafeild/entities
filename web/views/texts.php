<?php
/**
 * Returns the appropriate CSS classes for the given text.
 */
function getTextClasses($text) {
    global $data;
    $classList = "";
    if(array_key_exists("uploaded_text", $data) && $text["id"] == $data["uploaded_text"]["id"])
        $classList .= "just-uploaded ";

    if($text["tokenization_in_progress"])
        $classList .= "tokenization-in-progress ";

    if($text["tokenization_error"])
        $classList .= "tokenization-error ";
        
    return $classList;
}

/**
 * Returns true if the text has not been tokenized (either tokenization is in
 * progress, or there was an error).
 */
function untokenized($text){
    return $text["tokenization_in_progress"] || $text["tokenization_error"];
}

function displayTextListItem($text){ ?>
    <li class="<?=  getTextClasses($text) ?>">
                <?php if(untokenized($text)) { ?>
                    <?= $text["title"] ?> 
                    <?php if($text["tokenization_error"]){ ?>
                        (error while tokenizing)
                    <?php } else { ?>
                        (tokenization in progress)
                    <?php } ?>
                <?php } else { ?>
                    <a href="/texts/<?= $text["id"] ?>/annotations" class="onpage" 
                        data-id="<?= $text["id"] ?>"
                    ><?= $text["title"] ?></a> 
                    (<?= $text["annotation_count"] ?> annotations)
                <?php } ?>
            </li>
<?php
}
?>

<div id="texts" class="page">
    <?php $texts = $data["texts"]; ?>

    <?php if($user != null){ ?>
    <h2>Your texts</h2>

    <!-- File upload. -->
    <!-- Button trigger modal -->
    <button type="button" class="btn btn-primary btn-md text-upload-button" 
        data-toggle="modal" data-target="#text-upload-modal">
    Upload a text
    </button>

    <div class="modal fade" tabindex="-1" role="dialog" id="text-upload-modal">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <form enctype="multipart/form-data" method="POST" 
                    action="/texts/">
                    <div class="modal-header">
                        <button type="button" class="close" data-dismiss="modal"
                            aria-label="Close"
                            ><span aria-hidden="true">&times;</span>
                        </button>
                        <h4 class="modal-title">Upload a text</h4>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="file-input"
                                >Select a plain text file to annotate</label>
                            <input type="file" id="file-input" name="file"/>
                        </div>
                        <div class="form-group">
                            <label for="title-input"
                                >Choose a name for this text</label>
                            <input type="text" class="form-control" 
                                id="title-input" name="title" 
                                placeholder="e.g., Hamlet"/>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-danger" 
                            data-dismiss="modal">Cancel</button>
                        <input type="submit" class="btn btn-primary"
                            value="Upload"/>
                    </div>
                </form>
            </div><!-- /.modal-content -->
        </div><!-- /.modal-dialog -->
    </div><!-- /.modal -->

    <div id="user-text-list">
        <ul>
        <?php 
        $textsPrinted = 0;
        for($i = 0; $i < count($texts); $i++){
            $text = $texts[$i];
            if($text["uploaded_by"] == $user["id"]){ 
                $textsPrinted++;
                displayTextListItem($text);
            }
        } 
        if($textsPrinted == 0){ ?>
            <p>No texts found :( 
            <button class="btn-link" data-toggle="modal" 
                data-target="#text-upload-modal">Upload one!</button></p>
        <?php } ?>
        </ul>
    </div>
    <?php } ?>

    <h2>All texts</h2>
    <div id="text-list">
        <ul>
        <?php 
        for($i = 0; $i < count($texts); $i++){
            $text = $texts[$i]; 
            displayTextListItem($text);
        }
        if(count($texts) == 0){ ?>
            <p>No texts found :(</p>
        <?php } ?>
        </ul>
    </div>
</div>


<!-- <h2>Server response</h2>
<div id="response"></div> -->