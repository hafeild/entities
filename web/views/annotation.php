<script src="https://d3js.org/d3.v5.min.js"></script>
<script src="/js/network-viz.js"></script>
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
                <span id="end-marker"></span>
            </div>
            <script>
                var tokens = <?php readfile($data["text"]["content_file"]) ?>;
                initializeTokenizedContent();
            </script>
        </div>


        <div id="network-panel">
            <svg id="network-svg"></svg>
            <script>
                networkViz.loadNetwork(annotation_data.annotation);
            </script>
        </div>
    </div>
</div>

