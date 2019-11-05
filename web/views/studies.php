<div id="studies" class="page page-info">
    <h2>My Studies</h2>

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

</div>
