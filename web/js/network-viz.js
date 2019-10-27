// File:    network-viz.js
// Author:  Hank Feild
// Date:    Sep-2019
// Purpose: Takes care of drawing and updating the entity network in the network
//          panel on the annotations page.

var networkViz = (function(){
    const RADIUS = 10;
    var svgElm, svg, svgWidth, svgHeight;
    var simulation;
    var networkData;
    var refreshNetwork;
    var links, gnodes;
    // For dragging and making new links.
    var movingNode = false, drawingLinkMode = false, selectedNode = undefined;
    var readjustOnMove = true;
    
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

        simulation.force("charge").strength(-100).distanceMax(svgWidth);
    };

    function xCoord(x){
        return Math.min(Math.max(0, x), svgWidth);
    }

    function yCoord(y){
        return Math.min(Math.max(0, y), svgHeight);
    }
    
    /**
     * Draws the network and places listeners on nodes for clicking/dragging/
     * hovering.
     * 
     * @param {Object} entitiesData EntiTies map with the following keys:
     *   - entities
     *   - locations
     *   - ties
     *   - groups
     */
    this.loadNetwork = function(entitiesData) {
        networkData = entitiesDataToGraph(entitiesData);


        refreshNetwork = function() {
            gnodes.attr("transform", function(d) { 
                d.x = xCoord(d.x);
                d.y = yCoord(d.y);
                return 'translate(' + [d.x, d.y] + ')';
            }); 

            // links.attr("x1", function(d) { return xCoord(d.source.x); })
            //     .attr("y1", function(d) { return yCoord(d.source.y); })
            //     .attr("x2", function(d) { return xCoord(d.target.x); })
            //     .attr("y2", function(d) { return yCoord(d.target.y); });
            links.attr("x1", function(d) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function(d) { return d.target.y; });

    
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
        var seenLinks = {};

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
            

            var id1 = sourceGroupId, id2 = targetGroupId;
            if(id2 < id1){
                id2 = sourceGroupId;
                id1 = targetGroupId;
            }
            var key = `${id1}-${id2}-${tie.is_directed == undefined ? false : tie.is_directed}`;

            if(seenLinks[key] == undefined){
                seenLinks[key] = {
                    source: sourceGroupId,
                    target: targetGroupId,
                    value: 0,
                    is_directed: tie.is_directed == undefined ? 
                                    false : tie.is_directed,
                    label: tie.label
                }
            }

            seenLinks[key].value += tie.weight == undefined ? 1.0 : tie.weight;
        }

        for(linkId in seenLinks){
            graph.links.push(seenLinks[linkId]);
            addNode(seenLinks[linkId].source);
            addNode(seenLinks[linkId].target);
        }

        return graph;
    }
    
    /**
     * Should be called when a network node starts to be dragged. Only engages 
     * if the meta or ctrl keys are pressed.
     */
    function dragstarted() {
        console.log('In dragstarted', d3.event.sourceEvent);
        //if(d3.event.sourceEvent.metaKey || d3.event.sourceEvent.ctrKey) {
            movingNode = true;
            readjustOnMove = !d3.event.sourceEvent.shiftKey;

            // Freeze the network.
            if(!readjustOnMove){
                for(var i = 0; i < networkData.nodes.length; i++){
                    networkData.nodes[i].fx = networkData.nodes[i].x;
                    networkData.nodes[i].fy = networkData.nodes[i].y;
                }
            }
            
            if(!d3.event.active){
                simulation.alphaTarget(0.3).restart();
            }

            d3.event.subject.fx = d3.event.subject.x;
            d3.event.subject.fy = d3.event.subject.y;
        //} 
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
            drawingLinkMode = true;
            selectedNode = i;
            d3.select(n[i]).classed('node-selected', true);
    
        // Case 2
        } else if(selectedNode === i) {
            d3.select(n[selectedNode]).classed('node-selected', false);

            drawingLinkMode = false;
            selectedNode = undefined;

    
        // Case 3;
        } else {
            addLink(networkData.nodes[selectedNode], 
                networkData.nodes[i], 1, true);
            d3.select(n[selectedNode]).classed('node-selected', false);
            
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
            .style("stroke-width", function(d) { return 0.25*Math.sqrt(d.value); })
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
    
        var newG = gnodes
            .enter()
            .append('g')
            .classed('gnode', true)
            // .on('click', nodeClicked)
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended))
            .on('mouseover', function(d, i, n){ 
                d3.select(this).classed('node-hover', true); })
            .on('mouseout', function(d, i, n){ 
                d3.select(this).classed('node-hover', false); });;

        newG.append("circle")
            .attr("class", (d)=>{ return `node g${d.group}` })
            .attr("r", RADIUS);

        newG.append("text")
            .text((d,i,n) => { return d.name });

        gnodes.exit().remove();
        gnodes = svg.selectAll('g.gnode')//('g.gnode')
            .data(networkData.nodes);
    }
    
    /**
     * Adds a new node and redraws the network.
     * 
     * @param {string} groupId The id of the group to add.
     * @param {string} groupName The name of the group to add. 
     */
    this.addNode = function(groupId, groupName){
        // simulation.stop();
        networkData.nodes.push({
            id: groupId, 
            group: group, 
            name: groupName,
            x: svgWidth/2, 
            y: svgHeight/2
        });
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
     * @param {boolean} isDirected Whether this edge is directed or not.
     * @param {string} label The edge's label.
     * @param {boolean} adjustLayout Whether or not the network layout should be
     *                               re-adjusted after drawing the link.
     * 
     */
    this.addLink = function(sourceId, targetId, value, isDirected, label, 
            adjustLayout){
        // simulation.stop();
        networkData.links.push({
                source: sourceId,
                target: targetId,
                value: value == undefined ? 1.0 : value,
                is_directed: isDirected == undefined ? 
                                false : tie.is_directed,
                label: label
        });

        // Need to clear the entire network so that edges display beneath the
        // nodes.
        svg.selectAll('g,link').remove();
        
        drawLinks();
        drawNodes();

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

    /**
     * Downloads the graph in the format of TSV in the browser
     */
    this.exportTSV = function() {
        var links = networkData.links.slice();
        console.log(links);
    }

    this.exportGraphML = function() {
        var links = networkData.links.slice();
        var nodes = networkData.nodes.slice();

        console.log(nodes);

        // sort links alphabetically
        links.sort(function(a,b) {
            var nameA = a.source.name;
            var nameB = b.source.name;

            if(nameA < nameB) { return -1; }
            if(nameA > nameB) { return 1; }
            return 0;
        })

        // sort nodes alphabetically
        nodes.sort(function(a,b) {
            var nameA = a.name;
            var nameB = b.name;

            if(nameA < nameB) { return -1; }
            if(nameA > nameB) { return 1; }
            return 0;
        });

        row = "";

        let graphMLContent = "data:text/graphml;charset=utf-8,";
            

    }

    return this;
})();