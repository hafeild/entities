<h2>
    <a href="/texts/<?= $data["text"]["id"] ?>/annotations"><em>"<?= $data["text"]["title"] ?>"</em> Annotations</a> : 
     <?= $data["annotation"]["label"] == "" ? ("Annotation ". $data["annotation"]["annotation_id"]) : $data["annotation"]["label"] ?>
</h2>
Annotation by <?= $data["annotation"]["username"] ?> <br/>

<form action="/texts/<?= $data["text"]["id"] ?>/annotations/<?= $data["annotation"]["annotation_id"] ?>" method="POST"><button class="btn btn-sm btn-default">Fork</button></form>


<div id="annotation-panels">
    <div id="entity-panel">
    </div>
    <div id="text-panel">
    </div>
    <div id="relationship-panel">
    </div>
</div>