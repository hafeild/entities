<div id="study" class="page page-info" data-uri="/studies/<?= $data["study"]["id"] ?>">
    <h2><?= $data["study"]["name"] ?></h2>


    <?php 
        $numCompleted = 0;
        foreach($data["steps"] as $step){
            if($step["completed_at"]){
                $numCompleted++;
            }
        }
        if($numCompleted == count($data["steps"])){?>

            <p class="completion-message">You've completed all the steps for this study&mdash;thank you!</p>

    <?php } else {  ?>

            <p>Please complete each of the following tasks in the order listed. 
                Refrain from multi-tasking while working on each task.</p>

    <?php }  ?>

    <h3>Tasks</h3>
    <ol id="step-list">
        <?php 
        $somethingMarkedReady = false;
        foreach($data["steps"] as $step){
        ?>
            <li data-step-id="<?= $step["id"] ?>">
                <?php 
                if(!$step["completed_at"] && !$somethingMarkedReady){
                    //$target =$step["url"] ? "target=\"_url\"" : "";
                    $target = "";
                    // $url = $step["url"];
                    // if(!$step["url"]){
                        $url = "/studies/". $data["study"]["id"] .
                            "/steps/". $step["id"];
                    // }
                ?>

                    <a href="<?= $url ?>" <?= $target ?>>
                        <?= $step["label"] ?>
                    </a>
                    <?php if($step["url"]){ ?>
                        <form class="completed-step-form" method="post" action="/studies/<?= $data["study"]["id"] ?>/steps/<?= $step["id"] ?>/complete">
                            <?php if($step["started_at"] != null){ ?>
                            <button class="btn btn-xs btn-danger 
                                completed-step">Done</button>
                            <?php } ?>
                        </form>
                    <?php } ?>
                <?php 
                    $somethingMarkedReady = true;
                } else {
                ?>
                    <span class="<?= $step["completed_at"] ? "completed" 
                        : "pending" ?>">
                        <?= $step["label"] ?> 
                        <?php if($step["completed_at"]) { ?>
                            <span class="glyphicon glyphicon-ok"></span>
                        <?php } ?>
                    </span>
                <?php } ?>
            </li>
        <?php } ?>


    </ol>

</div>