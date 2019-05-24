<h2><em>"<?= $data["text"]["title"] ?>"</em> Annotations</h2>

<div id="annotation-list">
    <ul>
        <?php foreach($data["annotations"] as $annotation) ?>
        <li>(<?= $annotation["annotation_id"] ?>) 
            <?= $annotation["title"] ?> 
            annotated by <?= $annotation["username"] ?>
            <button class="get-annotation" 
                data-id="<?= $annotation["annotation_id"] ?>">
                load annotation
            </button>
        </li>

</div>

