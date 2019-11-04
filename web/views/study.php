<div id="study" class="page page-info" data-uri="/studies/<?= $data["study"]["id"] ?>">
    <h2><?= $data["study"]["name"] ?></h2>

    <p>Please complete each of the following tasks in the order listed and 
       refrain from multi-tasking while working on each task.</p>


    <h3>Tasks</h3>
    <ol id="step-list">
        <?php 
        $somethingMarkedReady = false;
        foreach($data["study"]["steps"] as $step){
        ?>
            <li data-step-id="<?= $step["id"] ?>">
                <?php 
                if($sttep["is_complete"] == "1" && !$somethingMarkedReady){
                ?>
                    <a href="<?= $step["url"] ?>">
                        <?= $step["name"] ?>
                    </a>
                <?php 
                    $somethingMarkedReady = true;
                } else {
                ?>
                    <span class="<?= $step["is_complete"] == "1" ? "completed" 
                        : "pending" ?>"><?= $step["name"] ?></span>
                        <?= $step["name"] ?>
                    </span>
                <?php } ?>
            </li>
        <?php } ?>
    </ol>

</div>