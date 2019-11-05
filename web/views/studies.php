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
                <li data-study-id="<?= $study["id"] ?>">
                    <a href="/studies/<?= $study["id"] ?>"><?= $study["name"] ?></a>
                    (runs from <?= $study["begins_at"] ?> to 
                    <?= $study["ends_at"] ?>)</li>
            <?php } ?>
        </ul>
    <?php } ?>
</div>
