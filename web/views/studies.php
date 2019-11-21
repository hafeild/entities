
<div id="studies" class="page page-info">
    <h2>My Studies</h2>

    <?php
    if(count($data["studies"]) == 0){
    ?>

        <p>You are not enrolled in any studies at this time.</p>

    <?php
    } else {
    ?>
        <p>Please select a study to start or continue participation.</p>

        <ul id="study-list">
            <?php 
            foreach($data["studies"] as $study){
            ?>
                <li data-study-id="<?= $study["study_id"] ?>">
                    <a href="/studies/<?= $study["study_id"] ?>"><?= $study["name"] ?></a>
                    (runs from <?= prettyPrintTime($study["begin_at"]) ?> to 
                    <?= prettyPrintTime($study["end_at"]) ?>)</li>
            <?php } ?>
        </ul>
    <?php } ?>
</div>
