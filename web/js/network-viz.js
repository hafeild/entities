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
        console.log(svgHeight, svgWidth);
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
            links.attr("x1", function(d) { return xCoord(d.source.x); })
                .attr("y1", function(d) { return yCoord(d.source.y); })
                .attr("x2", function(d) { return xCoord(d.target.x); })
                .attr("y2", function(d) { return yCoord(d.target.y); });
    
            gnodes.attr("transform", function(d) { 
                return 'translate(' + [xCoord(d.x), yCoord(d.y)] + ')';
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
        console.log('In dragstarted', d3.event.sourceEvent);
        //if(d3.event.sourceEvent.metaKey || d3.event.sourceEvent.ctrKey) {
            movingNode = true;
            readjustOnMove = !d3.event.sourceEvent.shiftKey;

            // Freeze the network.
            if(!readjustOnMove){
                for(var i = 0; i < networkData.nodes.length; i++){
                    networkData.nodes[i].fx = xCoord(networkData.nodes[i].x);
                    networkData.nodes[i].fy = yCoord(networkData.nodes[i].y);
                }
            }
            
            if(!d3.event.active){
                simulation.alphaTarget(0.3).restart();
            }

            console.log('readadjustOnMove:', readjustOnMove);

            d3.event.subject.fx = xCoord(d3.event.subject.x);
            d3.event.subject.fy = yCoord(d3.event.subject.y);
        //} 
    }
    
    /**
     * Updates a nodes (x,y) as it is being dragged.
     */
    function dragged() {
        if(movingNode) {
            d3.event.subject.fx = xCoord(d3.event.x);
            d3.event.subject.fy = yCoord(d3.event.y);
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
    
        var newG = gnodes
            .enter()
            .append('g')
            .classed('gnode', true)
            .on('click', nodeClicked)
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

        // sort links alphabetically 
        links.sort(function(a,b) {
            var nameA = a.source.name;
            var nameB = b.source.name;

            if(nameA < nameB) { return -1; }
            if(nameA > nameB) { return 1; }
            return 0;
        })

        var rows = [
            ["Entity 1", "Entity 2"],
        ];
        var used = {};

        // push link to rows if it does not reference itself and is not a duplicate
        links.forEach(function(link) {
            if (link.source.name !== link.target.name) {
                var curLink = [link.source.name, link.target.name];
                if (!(used[curLink[0] + curLink[1]] === true)) {
                    rows.push(curLink);
                    used[curLink[0] + curLink[1]] = true;
                }
            }
        });

        // push rows the 
        let tsvContent = "data:text/tsv;charset=utf-8," 
            + rows.map(e => e.join("\t")).join("\n");

        var encodedUri = encodeURI(tsvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("id", "tsvDownloader")
        link.setAttribute("download", "my_graph.tsv");
        document.body.appendChild(link); 

        link.click();
    }

    this.exportGraphML = function() {
        var links = networkData.links.slice();
        var nodes = networkData.nodes.slice();

        links.sort(function(a,b) {
            var nameA = a.source.name;
            var nameB = b.source.name;

            if(nameA < nameB) { return -1; }
            if(nameA > nameB) { return 1; }
            return 0;
        })


    }

    return this;
})();