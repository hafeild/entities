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

<div id="annotation-list">
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

