<h2><em>"<?= $data["text"]["title"] ?>"</em> Annotations</h2>

<div id="annotation-list">
    <ul>
        <?php foreach($data["annotations"] as $annotation) {?>
        <li>(<?= $annotation["annotation_id"] ?>) 
            <?= $annotation["title"] ?> 
            annotated by <?= $annotation["username"] ?>
            <a class="btn btn-sm btn-default" role="button" 
                href="/texts/<?= $data["text"]["id"]?>/annotations/<?= $annotation["annotation_id"] ?>">
                load annotation
            </a>
        </li>
        <?php } ?>

</div>

