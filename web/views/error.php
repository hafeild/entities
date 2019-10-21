<h2>ERROR</h2>

<div class="alert alert-danger errors" role="alert"> 
    <p><?= $data["message"] ?></p>
</div>

<?php if($data["additional_data"]){ ?>
<h3>Additional information</h3>
<pre><?= json_encode($data["additional_data"],  JSON_PRETTY_PRINT) ?></pre>
<?php } ?>
