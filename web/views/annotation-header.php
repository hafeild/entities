





<p class="navbar-text">
    <a href="/texts/<?= $data["text"]["id"] ?>/annotations"><em>"<?= 
        $data["text"]["title"] ?>"</em> Annotations</a> : 
        <?= $data["annotation"]["label"] == "" ? 
            ("Annotation ". $data["annotation"]["annotation_id"]) : 
            $data["annotation"]["label"] ?>
    <em>(<?= $data["annotation"]["username"] ?>)</em>
</p>


<?php // Fork. Only available to logged in users and non-study annotations. ?>
<?php if($user != null && !$data["is_study"]){ // Begin user logged-in, non-study. ?>


    <!-- Fork button -->
    <li>
    <button type="button" class="btn btn-primary btn-sm navbar-btn 
        fork-button header-button" 
        data-toggle="modal" data-target="#fork-modal">
    Fork
    </button>
    </li>

    <?php
    // Sharing settings are only exposed to owners.
    global $PERMISSIONS;
    if(ownsAnnotation($data["annotation"]["annotation_id"])){ // Begin owner-only section.
        $randNum = rand();    
    ?>
        <!-- Sharing button -->
        <li>
        <button type="button" class="btn btn-primary btn-sm navbar-btn 
            sharing-button header-button" 
            data-toggle="modal" data-target="#sharing-modal">
        Share annotation
        </button>
        </li>

    <?php } // End owner-only section. ?>
<?php } // End user logged-in, non-study. ?>


<!-- <p  class="navbar-text dropdown"> -->
<li>
<span class="dropdown">
    <button id="graph-export" class="dropdown-toggle dropdown btn btn-primary 
        btn-sm navbar-btn header-button" type="button" data-toggle="dropdown" 
        role="button" aria-haspopup="true" aria-expanded="false">Export network 
        <span class="caret"></span>
    </button>

    <ul id="graph-export-dropdown" class="dropdown-menu">
        <li class="graph-export-option" id="graph-export-tsv">TSV</li>
        <li class="graph-export-option" id="graph-export-graphml">graphML</li>
        <!-- <li class="graph-export-option" id="graph-export-png">PNG</li>
        <li class="graph-export-option" id="graph-export-svg">SVG</li> -->
    </ul>
</span>
</li>
<!-- </p> -->


<?php // For study annotations only. ?>
    <?php if($data["is_study"]) { ?>
    

        <li>
        <form class="completed-step-form" method="post" 
            action="/studies/<?= $data["step_data"]["study_id"] ?>/steps/<?= $data["step_data"]["step_id"] ?>/complete" onsubmit="return confirm('Are you sure you are completed annotating this text? Changes cannot be made once you\'ve selected \'OK\'.');">
            <button class="btn btn-danger btn-sm navbar-btn 
                header-button finished-annotating-button">
                Finished annotating</button>
        </form>
        </li>
    <?php } ?>