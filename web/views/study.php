<div id="study" class="page page-info" data-uri="/studies/<?= $data["study"]["id"] ?>">
    <h2><?= $data["study"]["name"] ?></h2>

    <p>Please complete each of the following tasks in the order listed and 
       refrain from multi-tasking while working on each task.</p>


    <h3>Tasks</h3>
    <ol id="step-list">
        <?php 
        $somethingMarkedReady = false;
        foreach($data["steps"] as $step){
        ?>
            <li data-step-id="<?= $step["id"] ?>">
                <?php 
                if(!$step["completed_at"] && !$somethingMarkedReady){
                    $url = $step["url"];
                    if(!$step["url"]){
                        $url = "annotations/${step["annotation_id"]}";
                    }
                ?>

                    <a href="<?= $url ?>">
                        <?= $step["label"] ?>
                    </a>
                <?php 
                    $somethingMarkedReady = true;
                } else {
                ?>
                    <span class="<?= $step["completed_at"] ? "completed" 
                        : "pending" ?>"><?= $step["label"] ?></span>
                        <?= $step["label"] ?>
                    </span>
                <?php } ?>
            </li>
        <?php } ?>
    </ol>

</div>