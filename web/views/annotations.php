<div id="annotations" class="page">
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
?>



<?php if($user != null){ // Begin logged-in user only section. ?>

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

    <!-- File upload. -->
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
                                BookNLP (meant for books; entity annotations only)
                            </label>
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
                    if($annotation["automated_method_error"] === "1")
                        print " <span class=\"error\">(error processing)</span>";
                    elseif($annotation["automated_method_in_progress"] === "1")
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

