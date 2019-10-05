<script src="https://d3js.org/d3.v5.min.js"></script>
<script src="/js/network-viz.js"></script>
<script src="/js/annotation-manager.js"></script>
<script src="/js/annotations.js"></script>

<div class="header">
    <h2>
        <a href="/texts/<?= $data["text"]["id"] ?>/annotations"><em>"<?= 
            $data["text"]["title"] ?>"</em> Annotations</a> : 
            <?= $data["annotation"]["label"] == "" ? 
                ("Annotation ". $data["annotation"]["annotation_id"]) : 
                $data["annotation"]["label"] ?>
    </h2>
    Annotation by <?= $data["annotation"]["username"] ?> <br/>


    <!-- Fork. -->
    <?php if($user != null){ // Begin logged-in user only section. ?>
        <!-- Button trigger modal -->
        <button type="button" class="btn btn-primary btn-md fork-button" 
            data-toggle="modal" data-target="#fork-modal">
        Fork
        </button>
        <div class="modal fade" tabindex="-1" role="dialog" id="fork-modal">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <?php 
                    // Goes to: 
                    // POST /texts/:textId/annotations/:annotationId
                    // with parameters: method (manual or tie-window) and
                    // n (if tie-window selected).
                    ?>
                    <form action="/texts/<?= $data["text"]["id"] ?>/annotations/<?= 
                        $data["annotation"]["annotation_id"] ?>" method="POST">

                        <div class="modal-header">
                            <button type="button" class="close" 
                                data-dismiss="modal" aria-label="Close"
                                ><span aria-hidden="true">&times;</span>
                            </button>
                            <h4 class="modal-title">Fork this annotation</h4>

                        </div>
                        <div class="modal-body">
                            <div>
                                <label>
                                    Give your new fork a name
                                </label>
                                <input type="text" class="form-control"
                                    name="label" placeholder="A descriptive name"/>
                            </div>
                            <br/>
                            <div>
                                <label>
                                    Select the type of fork you'd like to make
                                </label>
                                <ul>
                                    <div class="radio">
                                        <label>
                                            <input type="radio" name="method" 
                                                value="manual" checked/>
                                            Basic fork (for further manual annotations)
                                        </label>
                                    </div>
                                    <hr/>
                                    <div class="radio">
                                        <label>
                                            <input type="radio" name="method" 
                                                value="tie-window"/>
                                            Fork and extract ties (Window method)
                                        </label>
                                        <div>
                                            <label>Window size: <input type="number" 
                                                name="n" value="30"/></label>
                                        </div>
                                    </div>
                                </ul>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-danger" 
                                data-dismiss="modal">Cancel</button>
                            <input type="submit" class="btn btn-primary"
                                value="Fork"/>
                        </div>
                    </form>
                </div><!-- /.modal-content -->
            </div><!-- /.modal-dialog -->
        </div><!-- /.modal -->
    <?php } ?>

</div> <!-- /.header -->

<div id="annotation-panels-wrapper">
    <div id="annotation-panels">
        <div id="entity-panel-wrapper">
            <div id="entity-panel">
                Entities go here...
                <div id="entity-list">
                </div>
                <script>
                    annotation_data = <?= json_encode($data["annotation"]) ?>;
                    annotationManager = AnnotationManager(annotation_data);
                    displayAnnotation();
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
                // For testing only!
                // findTies(30);
            </script>
        </div>


        <div id="network-panel">
            <svg id="network-svg"></svg>
            <script>
                networkViz.init();
                networkViz.loadNetwork(annotation_data.annotation);
            </script>
        </div>
    </div>
</div>

