<h2>Success!</h2>

<div class="alert alert-success messages" role="alert">
    <p><?= $data["message"] ?></p>
</div>

<h3>Additional information</h3>
<pre><?= json_encode($data["additional_data"],  JSON_PRETTY_PRINT) ?></pre>