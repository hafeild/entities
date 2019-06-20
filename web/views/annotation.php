<h2>
    <a href="/texts/<?= $data["text"]["id"] ?>/annotations"><em>"<?= $data["text"]["title"] ?>"</em> Annotations</a> : 
    Annotation <?= $data["annotation"]["annotation_id"] ?>: <?= $data["annotation"]["title"] ?>
</h2>
Annotation by <?= $data["annotation"]["username"] ?> <br/>
<a href="#" class="btn btn-sm btn-default" role="button">Fork</a>


<div id="annotation-panels">
    <div id="entity-panel">
    </div>
    <div id="text-panel">
    </div>
    <div id="relationship-panel">
    </div>
</div>