<div id="annotations" class="page">
    <h2>Extracted entities</h2>
    <h3 id="title"></h3>
    <button id="add-annotation">Fork annotation</button>
    <button id="get-annotations">List annotations</button>

    <div id="annotation-list">
        <ul>
            <?php foreach($data as $annotation) ?>
            <li>(<?= $annotation["annotation_id"] ?>) 
                <?= $annotation["title"] ?> 
                annotated by <?= $annotation["username"] ?>
                <button class="get-annotation" 
                    data-id="<?= $annotation["annotation_id"] ?>">
                    load annotation
                </button>
            </li>

    </div>

    <div id="character-list">

    </div>

</div>