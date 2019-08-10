<script src="/js/annotations.js"></script>

<div class="header">
<h2>
    <a href="/texts/<?= $data["text"]["id"] ?>/annotations"><em>"<?= $data["text"]["title"] ?>"</em> Annotations</a> : 
     <?= $data["annotation"]["label"] == "" ? ("Annotation ". $data["annotation"]["annotation_id"]) : $data["annotation"]["label"] ?>
</h2>
Annotation by <?= $data["annotation"]["username"] ?> <br/>

<form action="/texts/<?= $data["text"]["id"] ?>/annotations/<?= $data["annotation"]["annotation_id"] ?>" method="POST"><button class="btn btn-sm btn-default">Fork</button></form>
</div>

<div id="annotation-panels-wrapper">
    <div id="annotation-panels">
        <div id="entity-panel-wrapper">
            <div id="entity-panel">
                Entities go here...
                <div id="entity-list">
                </div>
                <script>
                    var d = <?= json_encode($data["annotation"]) ?>;
                    displayAnnotation(d);
                </script>
            </div>
        </div>
        <div id="text-panel-wrapper">
            <!-- Text goes here... -->
            <div id="text-panel">

            </div>
            <script>
                var tokens = <?php readfile($data["text"]["content_file"]) ?>;
                var first1000 = "";
                for(var i = 0; i < 1000; i++){
                    first1000 += `<span class="token${i+1}">`+ 
                        tokens[i][0].replace("&", "&amp;").
                                     replace("<", "&lt;").
                                     replace(">", "&gt;") +
                        '</span>'+ tokens[i][1];
                }
                $('#text-panel').html(first1000);
            </script>

        </div>
        <div id="relationship-panel">
            Relationships go here...
        </div>
    </div>
</div>