var networkViz = (function(){
    const RADIUS = 10;
    var svgElm, svg, svgWidth, svgHeight;
    var simulation;
    var networkData;
    var refreshNetwork;
    var links, gnodes;
    // For dragging and making new links.
    var movingNode = false, drawingLinkMode = false, selectedNode = undefined;
    
    /**
     * Initializes the network and D3 objects. Does NOT draw the network.
     */
    this.init = function(){
        svgElm = document.querySelector("#network-svg");
        svg = d3.select('#network-svg');
        svgWidth = svgElm.getBoundingClientRect().width;
        svgHeight = svgElm.getBoundingClientRect().height;
        simulation =  d3.forceSimulation()
            .force("link", d3.forceLink().id(function(d) { return d.id; }))
            .force("charge", d3.forceManyBody())
            .force("center", d3.forceCenter(svgWidth / 2, svgHeight / 2))
            .force("collision", d3.forceCollide(RADIUS));

        simulation.force("charge").strength(-400);
        console.log(svgHeight, svgWidth);
    };
    
    /**
     * Draws the network and places listeners on nodes for clicking/dragging/
     * hovering.
     * 

     */
    this.loadNetwork = function(entitiesData) {
        networkData = entitiesDataToGraph(entitiesData);

        refreshNetwork = function() {
            links.attr("x1", function(d) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function(d) { return d.target.y; });
    
            gnodes.attr("transform", function(d) { 
                return 'translate(' + [d.x, d.y] + ')';
            }); 
    
        };

        simulation
            .nodes(networkData.nodes)
            .on("tick", refreshNetwork);
        simulation.force("link")
            .links(networkData.links);
    
        drawLinks();
        drawNodes();
    };

    /**
     * Extracts a network based on entitiesData.ties.
     * 
     * @param {Object} entitiesData EntiTies map with the following keys:
     *   - entities
     *   - locations
     *   - ties
     *   - groups
     * 
     * @return An object with two keys:
     *   - nodes --> [{id: ..., group: ...}, ...]
     *   - links --> [{source: ..., target: ..., value: ...}, ...]
     */
    function entitiesDataToGraph(entitiesData){
        var graph = {nodes: [], links: []};
        var tie;
        var seenGroups = {};

        function getTieNodeGroup(tieNode) {
            if(tieNode.entity_id !== undefined){
                return entitiesData.entities[tieNode.entity_id].group_id;
            } else if(tieNode.location_id != undefined){
                if(entitiesData.locations[tieNode.location_id].entity_id !== undefined){
                    return entitiesData.entities[
                        entitiesData.locations[
                            tieNode.location_id].entity_id].group_id;
                }
            }

            console.log("Hmm...can't identify the entity or location "+
                "associated with this tie node:", tieNode);
            return null;
        }

        function addNode(groupId){
            if(seenGroups[groupId]) return;

            seenGroups[groupId] = true;
            graph.nodes.push({
                name: entitiesData.groups[groupId].name,
                id: groupId, 
                group: groupId
            });
        }

        for(tieId in entitiesData.ties){
            var tie = entitiesData.ties[tieId];
            var sourceGroupId = getTieNodeGroup(tie.source_entity);
            var targetGroupId = getTieNodeGroup(tie.target_entity);
            

            graph.links.push({
                // id: tieId,
                source: sourceGroupId,
                target: targetGroupId,
                value: tie.weight
            });

            addNode(sourceGroupId);
            addNode(targetGroupId);
        }

        return graph;
    }
    
    /**
     * Should be called when a network node starts to be dragged. Only engages 
     * if the meta or ctrl keys are pressed.
     */
    function dragstarted() {
        if(d3.event.sourceEvent.metaKey || d3.event.sourceEvent.ctrKey) {
            movingNode = true;
            if (!d3.event.active) simulation.alphaTarget(0.3).restart();
            d3.event.subject.fx = d3.event.subject.x;
            d3.event.subject.fy = d3.event.subject.y;
        } 
    }
    
    /**
     * Updates a nodes (x,y) as it is being dragged.
     */
    function dragged() {
        if(movingNode) {
            d3.event.subject.fx = d3.event.x;
            d3.event.subject.fy = d3.event.y;
        }
    }
    
    /**
     * Updates the network when a node stops being dragged.
     */
    function dragended() {
        if(movingNode){
            if (!d3.event.active) simulation.alphaTarget(0);
            //   d3.event.subject.fx = null;
            //   d3.event.subject.fy = null;
            movingNode = false;
        } 
    }

    /**
     * A D3 click event handler. If a node is clicked without a ctrl or meta 
     * key being pressed, handles clicks on a node in one of three ways in order
     * to draw new links between nodes in the network:
     * 
     *     Case 1: not in drawingLink mode
     *        => enter drawingLink mode and mark node as selected node
     *     Case 2: in drawingLink mode and selected node is clicked again 
     *        => exit drawingLink and do nothing
     *     Case 2: in drawingLink mode and a different node is clicked
     *        => exit drawingLink, add link between selected node and current node
     * 
     * @param {Object} d The data tied to the clicked node.
     * @param {integer} i The index of the node in the list of D3 nodes.
     * @param {D3 Node list} n The list of d3 nodes.
     */
    function nodeClicked(d, i, n){
        console.log('Node clicked');
        if(d3.event.metaKey || d3.event.ctrKey) return;
        console.log('No meta key pressed during click');
    
        // Case 1
        if(!drawingLinkMode){
            console.log('Case 1 triggered.');
            drawingLinkMode = true;
            selectedNode = i;
    
        // Case 2
        } else if(selectedNode === i) {
            console.log('Case 2 triggered.');
            drawingLinkMode = false;
            selectedNode = undefined;
    
        // Case 3;
        } else {
            console.log('Case 3 triggered.');
            addLink(data.nodes[selectedNode], data.nodes[i], 1, true);
            
            drawingLinkMode = false;
            selectedNode = undefined;
        }
    }

    /**
     * (Re)Draws the edges in the network. This relies on the networkData 
     * object.
     */
    function drawLinks() {
        links = svg.selectAll(".link")
            .data(networkData.links);
        
        links.enter().append("line")
            .attr("class", "link")
            .style("stroke-width", function(d) { return Math.sqrt(d.value); })
            .style("stroke", "#999999");
    
        links.exit().remove();
        links = svg.selectAll(".link")
            .data(networkData.links);
    }
    
    /**
     * (Re)Draws all of the nodes in the network. This relies on the networkData
     * object. Places listeners on nodes for clicking, dragging, and hovering.
     */
    function drawNodes() {
        gnodes = svg.selectAll('g.gnode')//('g.gnode')
            .data(networkData.nodes);
    
        gnodes
            .enter()
            .append('g')
            .classed('gnode', true)
            .on('click', nodeClicked)
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended))
            .append("circle")
            .attr("class", (d)=>{ return `node g${d.group}` })
            .attr("r", RADIUS);
    
        d3.selectAll('circle.node')
            .on('mouseover', (d, i, n)=>{ 
                d3.select(n[i]).classed('node-hover', true); })
            .on('mouseout', (d, i, n)=>{ 
                d3.select(n[i]).classed('node-hover', false); });
    
        gnodes.exit().remove();
        gnodes = svg.selectAll('g.gnode')//('g.gnode')
            .data(networkData.nodes);
    }
    
    function showLabel(d) {
        d3.select()
    }
    
    function hideLabel(d) {
    }
    
    /**
     * Adds a new node and redraws the network.
     * 
     * @param {string} id The id (label) of the new node.
     * @param {number} group The group number of the new node.
     */
    this.addNode = function(id, group){
        // simulation.stop();
        networkData.nodes.push({id: id, group: group, 
            x: svgWidth/2, y: svgHeight/2});
        drawNodes();
        simulation.nodes(networkData.nodes);
        simulation.alpha(1).restart();
    };
    
    /**
     * Adds a new link (edge) between existing nodes in the network then redraws
     * the network.
     * 
     * @param {string} sourceId The id of the source node.
     * @param {string} targetId The id of the garget node.
     * @param {number} value The weight of the edge.
     * @param {boolean} adjustLayout Whether or not the network layout should be
     *                               re-adjusted after drawing the link.
     * 
     */
    this.addLink = function(sourceId, targetId, value, adjustLayout){
        // simulation.stop();
        networkData.links.push(
            {source: sourceId, target: targetId, value: value});
        drawLinks();
        simulation.force("link").links(networkData.links);
        if(adjustLayout === true){
            simulation.alpha(1).restart();
        } else {
            refreshNetwork();
        }
    }

    /**
     * Resets the network, drawing it from scratch.
     */
    this.reset = function() {
        simulation.stop();
        var nodes = simulation.nodes();
        var i;
        for(i = 0; i < nodes.length; i++){
            nodes[i].x = null;
            nodes[i].y = null; 
            nodes[i].vx = null;
            nodes[i].vy = null;
            nodes[i].fx = null;
            nodes[i].fy = null;
        }
        simulation.alpha(1).restart();
    }

    return this;
})();