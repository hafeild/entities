// File:    network-viz.js
// Author:  Hank Feild
// Date:    Sep-2019
// Purpose: Takes care of drawing and updating the entity network in the network
//          panel on the annotations page.

var NetworkVisualizer = function() {
    var self = {};
    var entitiesData = {};
    var seenGroups = {};
    var seenLinks = {};
    var tieToLinkIdLookup = {};
    const RADIUS = 10;
    var svgElm, svg, svgWidth, svgHeight;
    var simulation;
    var networkData;
    var refreshNetwork;
    var links, gnodes, linkHitboxes, nodeHitboxes;
    // For dragging and making new links.
    var movingNode = false, drawingLinkMode = false, selectedNode = undefined;
    var readjustOnMove = true;
    
    function gatherDimensions(svgSelector) {
        svgElm = document.querySelector(svgSelector);
        if (svgElm) {
            svg = d3.select(svgSelector);
            svgWidth = svgElm.getBoundingClientRect().width;
            svgHeight = svgElm.getBoundingClientRect().height;

            return true;
        }
        return false;
    }

    /**
     * Initializes the network and D3 objects. Does NOT draw the network.
     */
    self.init = function(svgSelector){
        let success = gatherDimensions(svgSelector);
        if (!success) {
            console.log("NetworkVisualizer: Could not find specified SVG");
            return;
        }
        
        simulation =  d3.forceSimulation()
            .force("link", d3.forceLink().id(function(d) { return d.id; }).distance(60).strength(2))
            .force("charge", d3.forceManyBody().strength(-15))
            .force("center", d3.forceCenter(svgWidth / 2, svgHeight / 2))
            .force("collision", d3.forceCollide(RADIUS))

        // simulation.force("charge").strength(-100).distanceMax(svgWidth);
        // simulation.force("charge").strength(-300).distanceMax(svgWidth/4);

        $(window).on('resize', function(){
            gatherDimensions();
            simulation.force("charge").strength(-100).distanceMax(svgWidth/4);
            svg.selectAll('g,link').remove();
            drawLinks(self);
            drawNodes();
        });
    };

    function xCoord(x){
        return Math.min(Math.max(0, x), svgWidth);
    }

    function yCoord(y){
        return Math.min(Math.max(0, y), svgHeight);
    }

    function refreshNetwork() {
        gnodes.attr("transform", function(d) { 
            d.x = xCoord(d.x);
            d.y = yCoord(d.y);
            return 'translate(' + [d.x, d.y] + ')';
        }); 
        
        nodeHitboxes.attr("transform", function(d) { 
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

        linkHitboxes.attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });
    }
    
    /**
     * Draws the network and places listeners on nodes for clicking/dragging/
     * hovering.
     * 
     * @param {object} entitiesData_ EntiTies map with the following keys:
     *   - entities
     *   - locations
     *   - ties
     *   - groups
     */

    self.loadNetwork = function(entitiesData_) {
        entitiesData = entitiesData_;
        networkData = entitiesDataToGraph(entitiesData);

        simulation
            .nodes(networkData.nodes)
            .on("tick", refreshNetwork);
        simulation.force("link")
            .links(networkData.links);
    
        drawLinks(self);
        drawNodes();
    };
    
    /**
     * Draws the network and places listeners on nodes for clicking/dragging/
     * hovering.
     * 
     * @param {object} tieData Map containing ties with the following keys
     *   - start
     *   - end
     *   - source_entity
     *   - target_entity
     *   - label
     * 
     * @param {object} entitiesData_ EntiTies map with the following keys:
     *   - entities
     *   - locations
     *   - ties
     *   - groups
     */
    self.loadTieNetwork = function(tieData, entitiesData_) {
        entitiesData = entitiesData_;
        networkData = tiesDataToGraph(tieData);

        simulation
            .nodes(networkData.nodes)
            .on("tick", refreshNetwork);
        simulation.force("link")
            .links(networkData.links);

        drawLinks(self);
        drawNodes();
    }

    /**
     * Resolves the entity alias group id associated with the tie node's entity 
     * or mention.
     * 
     * @param {object} tieNode An object representing a source or target of a
     *                         a tie with one of two possible keys:
     *      - entity_id (the id of the source or target entity)
     *      - location_id (the id of the source or target mention)
     * 
     * @return The alias group associated with the entity or mention.
     */
    function getTieNodeGroup(tieNode) {
        if(tieNode.entity_id !== undefined){
            return entitiesData.entities[tieNode.entity_id].group_id;
        } else if(tieNode.location_id != undefined){
            if(entitiesData && entitiesData.locations[tieNode.location_id].entity_id !== undefined){
                return entitiesData.entities[
                    entitiesData.locations[
                        tieNode.location_id].entity_id].group_id;
            } 
        }

        console.log("Hmm...can't identify the entity or location "+
            "associated with this tie node:", tieNode);
        return null;
    }

    /**
     * Adds an entity alias group to the set of nodes if it doesn't already
     * exist.
     * 
     * @param {object} graph The internal graph object; should have the 
     *                       following structure:
     *   - nodes --> [{name: ..., id: ..., group: ...}, ...]
     *   - links --> [{source: ..., target: ..., value: ..., directed,
     *                 label: ..., count: ...}, ...]
     * @param {string} groupId The id of the entity alias group to add.
     */
    function addInternalNode(graph, groupId){
        if(seenGroups[groupId]) return;

        graph.nodes.push({
            name: entitiesData.groups[groupId].name,
            id: groupId, 
            group: groupId,
            x: svgWidth/4 + Math.random()*svgWidth/2,
            y: svgHeight/4 + Math.random()*svgHeight/2
        });
        seenGroups[groupId] = graph.nodes.length;
    }

    /**
     * Adds the tie to the internal structure of links `seenLinks` if the tie's
     * key is new, or updates the count if the key is duplicate. See 
     * `tieToLink()` for the key formula.
     * 
     * @param {object} tie A tie object with at least these fields:
     *   - start (token offset; integer)
     *   - end (token offset; integer)
     *   - source_entity (object)
     *       * location_id OR entity_id
     *   - target_entity (object)
     *       * location_id OR entity_id
     *   - label (string)
     *   - weight (floating point)
     *   - directed (boolean)
     * @param {string} tieId The id of the tie.
     * @return True if the tie is the first with its key.
     */
    function updateInternalTie(tieId, tie){
        var sourceGroupId = getTieNodeGroup(tie.source_entity);
        var targetGroupId = getTieNodeGroup(tie.target_entity);
        var key = tieToLinkId(tieId, tie);

        if(seenLinks[key] == undefined){
            seenLinks[key] = {
                id: tieId,
                linkId: key,
                source_entity: tie.source_entity,
                target_entity: tie.target_entity,   
                source: sourceGroupId,
                target: targetGroupId,
                value: 0,
                directed: tie.directed == undefined ? 
                                false : tie.directed,
                label: tie.label,
                count: 0 // The number of links hidden in this one.
            }
        }

        seenLinks[key].value += tie.weight == undefined ? 1.0 : tie.weight;
        seenLinks[key].count++;        

        return seenLinks[key].count === 1;
    }

    /**
     * Adds a tie internally, including the nodes it connects if they are not
     * already added.
     * 
     * @param {object} graph The internal graph object; should have the 
     *                       following structure:
     *   - nodes --> [{name: ..., id: ..., group: ...}, ...]
     *   - links --> [{source: ..., target: ..., value: ..., directed,
     *                 label: ..., count: ...}, ...]
     * @param {object} tie A tie object with at least these fields:
     *   - start (token offset; integer)
     *   - end (token offset; integer)
     *   - source_entity (object)
     *       * location_id OR entity_id
     *   - target_entity (object)
     *       * location_id OR entity_id
     *   - label (string)
     *   - weight (floating point)
     *   - directed (boolean)
     * 
     * @return True if a new link was added, false if a link with the same key
     *         existed and its count updated.
     */
    function addInternalTie(graph, tieId, tie){
        if(updateInternalTie(tieId, tie)){
            var linkId = tieToLinkId(tieId, tie);
            graph.links.push(seenLinks[linkId]);
            addInternalNode(graph, seenLinks[linkId].source);
            addInternalNode(graph, seenLinks[linkId].target);
            return true;
        }
        return false;
    }

    /**
     * Converts a node into a link id using the formula:
     * 
     *      {id1}-{id2}-{directed}
     * 
     * where {id1} is the alphabetically smaller of the source/target group ids
     * and {id2} is the larger. {directed} is one of 'true' or 'false'. 
     * 
     * @param {string} tieId The id of the tie.
     * @param {object} tie A tie object with at least these fields:
     *   - start (token offset; integer)
     *   - end (token offset; integer)
     *   - source_entity (object)
     *       * location_id OR entity_id
     *   - target_entity (object)
     *       * location_id OR entity_id
     *   - label (string)
     *   - weight (floating point)
     *   - directed (boolean)     
     * @param {boolean} refresh If true, any existing key associated with the
     *                          tie is ignored an a new key is generated.
     * @return A key that is distinct to ties with the same source, target, and
     *         directedness.
     */
    function tieToLinkId(tieId, tie, refresh){
        if(tieToLinkIdLookup[tieId] === undefined || refresh){

            var sourceGroupId = getTieNodeGroup(tie.source_entity);
            var targetGroupId = getTieNodeGroup(tie.target_entity);

            var id1 = sourceGroupId, id2 = targetGroupId;
            if(id2 < id1){
                id2 = sourceGroupId;
                id1 = targetGroupId;
            }

            tieToLinkIdLookup[tieId] = 
                `${id1}-${id2}-${tie.directed == undefined ? 
                    false : tie.directed}`;
        }

        return tieToLinkIdLookup[tieId];
    }

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
     *   - nodes --> [{name: ..., id: ..., group: ...}, ...]
     *   - links --> [{source: ..., target: ..., value: ..., directed,
     *                 label: ..., count: ...}, ...]
     */
    function entitiesDataToGraph(entitiesData){
        var graph = {nodes: [], links: []};
        var tie;
        seenGroups = {};
        seenLinks = {};

        for(tieId in entitiesData.ties){
            var tie = entitiesData.ties[tieId];
            addInternalTie(graph, tieId, tie);
        }

        for(groupId in entitiesData.groups){
            addInternalNode(graph, groupId);
        }

        return graph;
    }

    function tiesDataToGraph(tiesData) {
        let graph = { nodes: [], links: [] };
        let tie;

        for (tieId in tiesData) {
            addInternalTie(graph, tieId, tiesData[tieId]);
        }        

        return graph;
    }
    
    /**
     * Should be called when a network node starts to be dragged. Only engages 
     * if the meta or ctrl keys are pressed.
     */
    function dragstarted() {
        $(document).trigger('entities.network-drag-started', {
            group_id: d3.event.subject.id, 
            name: d3.event.subject.name,
            x: d3.event.subject.x, 
            y: d3.event.subject.y
        });
        // console.log('In dragstarted', d3.event.sourceEvent);
        //if(d3.event.sourceEvent.metaKey || d3.event.sourceEvent.ctrKey) {
            movingNode = true;
            readjustOnMove = !d3.event.sourceEvent.shiftKey;

            // Freeze the network.
            if(!readjustOnMove){
                $(document).trigger('entities.network-freeze');
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
            $(document).trigger('entities.network-drag-ended', {
                group_id: d3.event.subject.id, 
                name: d3.event.subject.name, 
                x: d3.event.subject.x, 
                y: d3.event.subject.y
            });
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
        // console.log('Node clicked');
        if(d3.event.metaKey || d3.event.ctrKey) return;
        // console.log('No meta key pressed during click');
    
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
    function drawLinks(self) {
        svg.append("svg:defs").append("svg:marker")
            .attr("id", "arrow")
            .attr("viewBox", "0 -5 10 10")
            .attr('refX', -20)//so that it comes towards the center.
            .attr("markerWidth", 5)
            .attr("markerHeight", 5)
            .attr("orient", "auto")
            .append("svg:path")
            .attr("d", "M0,-5L10,0L0,5");

        links = svg.selectAll(".link")
            .data(networkData.links);
        
        linkHitboxes = svg.selectAll(".link-hitbox")
            .data(networkData.links);
        
        links.enter().append("line")
            .attr("class", "link")
            .attr("line", function(d, i , n) { return i; })
            .attr('marker-start', (d) => { 
                return d.directed ? "url(#arrow)" : "";
            })
            .style("stroke-width", function(d) { return 3 * Math.sqrt(d.value); })
            .style("stroke", "#555555");

        links.enter().append("line")
            .attr("class", "link-hitbox")
            .attr("belongs-to-line", function(d, i , n) { return i; })
            .style("stroke-width", function(d) { return 20 * Math.sqrt(d.value); })
            .style("stroke", "#55555500")
            .on('mouseover', function (d, i, n) { 
                $(document).trigger('entities.network-link-mouseover', {
                    group_id: d.id, 
                    name: d.name,
                    x: d.x,
                    y: d.y
                });
                d3.select(this.parentElement.querySelector(`.link[line='${this.getAttribute("belongs-to-line")}'`)).classed('link-hover', true); 
            })
            .on('mouseout', function(d, i, n){ 
                    $(document).trigger('entities.network-link-mouseout', {
                       group_id: d.id, 
                       name: d.name,
                       x: d.x,
                       y: d.y
                   });
                d3.select(this.parentElement.querySelector(`.link[line='${this.getAttribute("belongs-to-line")}'`)).classed('link-hover', false); 
        })
            .on('click', (d, i, n) => {
                self.toggleTieDirection(d);
            });

        links.attr( "d", (d) => { console.log(d); return "M" + d.source.x + "," + d.source.y + ", " + d.target.x + "," + d.target.y });
        linkHitboxes.attr( "d", (d) => { console.log(d); return "M" + d.source.x + "," + d.source.y + ", " + d.target.x + "," + d.target.y });

        links.exit().remove();
        linkHitboxes.exit().remove();

        links = svg.selectAll(".link")
            .data(networkData.links);
        linkHitboxes = svg.selectAll(".link-hitbox")
            .data(networkData.links);
    }
    
    /**
     * (Re)Draws all of the nodes in the network. This relies on the networkData
     * object. Places listeners on nodes for clicking, dragging, and hovering.
     */
    function drawNodes() {
        gnodes = svg.selectAll('g.gnode')//('g.gnode')
            .data(networkData.nodes);
        
        nodeHitboxes = svg.selectAll(".node-hitbox")
            .data(networkData.nodes);

        gnodes.enter().append("circle")
            .attr("class", (d)=>{ return `node-hitbox g${d.group}` })
            .attr("r", RADIUS * 10)
            .attr("belongs-to-node", function(d, i , n) { return i; })
            .style("border", "none")
            .style("fill", "#11111100")
            .on('mousemove.passThru', function(d) {
                d3.select(this.parentElement.querySelector(`.gnode[node='${this.getAttribute("belongs-to-node")}'`)).classed('node-hover', true); 

                var e = d3.event;
                var pointerEventsCurrentNode = this.style.pointerEvents;
                this.style.pointerEvents = 'none';

                var elementBeneath = document.elementFromPoint(d3.event.x, d3.event.y);

                var nextEvent = document.createEvent('MouseEvent');
                nextEvent.initMouseEvent(e.type, e.bubbles, e.cancelable, e.view,  e.detail, e.screenX, e.screenY, e.clientX, e.clientY, e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, e.button, e.relatedTarget);

                elementBeneath.dispatchEvent(nextEvent);

                this.style.pointerEvents = pointerEventsCurrentNode;
            })
            .on('mouseout', function(d, i, n){ 
                d3.select(this.parentElement.querySelector(`.gnode[node='${this.getAttribute("belongs-to-node")}'`)).classed('node-hover', false); 

                var elementBeneath = document.elementFromPoint(d3.event.x, d3.event.y);

                if (elementBeneath.nodeName.toLowerCase() == "svg") {
                    elementBeneath.querySelectorAll(".gnode").forEach((gnode) => {
                        console.log("removing extra");
                        d3.select(gnode).classed("node-hover", false);
                    })
                }
            });
    
        var newG = gnodes
            .enter()
            .append('g')
            .classed('gnode', true)
            .attr("node", function(d, i , n) { return i; })
            // .on('mouseover', function(d, i, n){ 
            //     $(document).trigger('entities.network-node-mouseover', {
            //         group_id: d.id, 
            //         name: d.name,
            //         x: d.x,
            //         y: d.y
            //     });
            //     d3.select(this).classed('node-hover', true); })
            .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended))
            .on('click', nodeClicked)
            .on('mouseover', function(d, i, n){ 
                d3.select(this).classed('node-hover', true);
            })
            .on('mouseout', function(d, i, n){ 
                d3.select(this).classed('node-hover', false);
            });

        newG.append("circle")
            .attr("class", (d)=>{ return `node g${d.group}` })
            .attr("r", RADIUS);

        newG.insert("text")
            .text((d,i,n) => { return d.name })
            .attr("dy", function(d){return RADIUS * 2})
            .attr("class", (d)=>{ return `node-text gn${d.group}` });

        gnodes.exit().remove();
        nodeHitboxes.exit().remove();

        gnodes = svg.selectAll('g.gnode')//('g.gnode')
            .data(networkData.nodes);
        
        nodeHitboxes = svg.selectAll(".node-hitbox")
            .data(networkData.nodes);

        // gnodes = svg.selectAll('g.gnode')//('g.gnode')
        //     .data(networkData.nodes);
    
        // var newG = gnodes
        //     .enter()
        //     .append('g')
        //     .classed('gnode', true)
        //     // .on('mouseover', function(d, i, n){ 
        //     //     $(document).trigger('entities.network-node-mouseover', {
        //     //         group_id: d.id, 
        //     //         name: d.name,
        //     //         x: d.x,
        //     //         y: d.y
        //     //     });
        //     //     d3.select(this).classed('node-hover', true); })
        //     .on('mouseout', function(d, i, n){ 
        //         d3.select(this).classed('node-hover', false);
        //     });
            
        // newG.insert("circle")
        //     .attr("class", (d)=>{ return `node-hitbox g${d.group}` })
        //     .attr("r", RADIUS * 10)
        //     .style("border", "none")
        //     .style("fill", "#11111113")
        //     .on('mousemove.passThru', function(d) {
        //         d3.select(this.parentElement).classed('node-hover', true);

        //         var e = d3.event;
        //         var pointerEventsCurrentNode = this.style.pointerEvents;
        //         this.style.pointerEvents = 'none';

        //         var elementBeneath = document.elementFromPoint(d3.event.x, d3.event.y);

        //         var nextEvent = document.createEvent('MouseEvent');
        //         nextEvent.initMouseEvent(e.type, e.bubbles, e.cancelable, e.view,  e.detail, e.screenX, e.screenY, e.clientX, e.clientY, e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, e.button, e.relatedTarget);

        //         elementBeneath.dispatchEvent(nextEvent);

        //         this.style.pointerEvents = pointerEventsCurrentNode;
        //     })
        //     .on('mouseout', function(d, i, n){ 
        //         d3.select(this.parentElement).classed('node-hover', false);

        //         var elementBeneath = document.elementFromPoint(d3.event.x, d3.event.y);

        //         console.log(elementBeneath.nodeName);
        //         if (elementBeneath.nodeName.toLowerCase() == "svg") {
        //             elementBeneath.querySelectorAll(".gnode").forEach((gnode) => {
        //                 console.log("removing extra");
        //                 d3.select(gnode).classed("node-hover", false);
        //             })
        //         }
        //     });

        // newG.append("circle")
        //     .attr("class", (d)=>{ return `node g${d.group}` })
        //     .attr("r", RADIUS)
        //     .call(d3.drag()
        //     .on("start", dragstarted)
        //     .on("drag", dragged)
        //     .on("end", dragended))
        //     .on('click', nodeClicked);

        // newG.insert("text")
        //     .text((d,i,n) => { return d.name })
        //     .attr("dy", function(d){return RADIUS * 2})
        //     .attr("class", (d)=>{ return `node-text gn${d.group}` });

        // gnodes.exit().remove();

        // gnodes = svg.selectAll('g.gnode')//('g.gnode')
        //     .data(networkData.nodes);
    }
    
    /**
     * Adds a new node and redraws the network.
     * 
     * @param {string} groupId The id of the group to add.
     * @param {string} groupName The name of the group to add. 
     */
    self.addNode = function(groupId, groupName){
        $(document).trigger('entities.network-node-added', {
            group_id: d3.event.subject.id, 
            name: d3.event.subject.name
        });


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
     * @param {string} targetId The id of the target node.
     * @param {number} value The weight of the edge.
     * @param {boolean} isDirected Whether this edge is directed or not.
     * @param {string} label The edge's label.
     * @param {boolean} adjustLayout Whether or not the network layout should be
     *                               re-adjusted after drawing the link.
     * 
     */
    self.addLink = function(sourceId, targetId, value, isDirected, label, 
            adjustLayout){
        // simulation.stop();

        var link = {
                source: sourceId,
                target: targetId,
                value: value == undefined ? 1.0 : value,
                directed: isDirected == undefined ? 
                                false : tie.directed,
                label: label
        }

        $(document).trigger('entities.network-link-added', link);

        networkData.links.push(link);

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
     * Adds or updates a tie to the network. If the link id created by the tie
     * properties (see tieToLinkId) matches an existing link, the existing 
     * link's count is incremented and the tie's weight added to the existing
     * link's weight. If the link id is new, a new link is created.
     * 
     * @param {object} tie A tie object with at least these fields:
     *   - id (the tie's id)
     *   - start (token offset; integer)
     *   - end (token offset; integer)
     *   - source_entity (object)
     *       * location_id OR entity_id
     *   - target_entity (object)
     *       * location_id OR entity_id
     *   - label (string)
     *   - weight (floating point)
     *   - directed (boolean)
     * @param {boolean} adjustLayout Whether or not the network layout should be
     *                               re-adjusted after adding/updating the link.
     */
    self.addTies = function(ties, adjustLayout){
        var linkAdded = false;

        console.log("Adding ties...");
        ties.forEach((tie)=>{
            linkAdded = addInternalTie(networkData, tie.id, tie) || linkAdded;
        });

        if(linkAdded){
            linkAdded = true;
            svg.selectAll('g,link').remove();
            drawLinks(self);
            drawNodes();
            simulation.force("link").links(networkData.links);
        }

        if(adjustLayout){
            simulation.alpha(1).restart();
        } else {
            refreshNetwork();
        }
    }

    /**
     * Adds or updates a tie to the network. If the link id created by the tie
     * properties (see tieToLinkId) matches an existing link, the existing 
     * link's count is incremented and the tie's weight added to the existing
     * link's weight. If the link id is new, a new link is created.
     * 
     * @param {object} tie A tie object with at least these fields:
     *   - id (the tie's id)
     *   - start (token offset; integer)
     *   - end (token offset; integer)
     *   - source_entity (object)
     *       * location_id OR entity_id
     *   - target_entity (object)
     *       * location_id OR entity_id
     *   - label (string)
     *   - weight (floating point)
     *   - directed (boolean)
     * @param {boolean} adjustLayout Whether or not the network layout should be
     *                               re-adjusted after adding/updating the link.
     */
    self.addTie = function(tie, adjustLayout){
        self.addTies([tie], adjustLayout);
    }


    /**
     * Removes or updates a list of ties to the network. If the link id created
     * by the tie properties (see tieToLinkId) matches an existing link, the
     * existing link's count is decremented and the tie's weight subtracted from
     * the existing link's weight. If the resulting count is 0, the link is
     * removed. If the link id is new, no action is performed.
     * 
     * @param {object[]} ties A list of tie object with at least these fields:
     *   - id (the tie's id)
     *   - start (token offset; integer)
     *   - end (token offset; integer)
     *   - source_entity (object)
     *       * location_id OR entity_id
     *   - target_entity (object)
     *       * location_id OR entity_id
     *   - label (string)
     *   - weight (floating point)
     *   - directed (boolean)
     * @param {boolean} adjustLayout Whether or not the network layout should be
     *                               re-adjusted after removing or updating the 
     *                               link.
     */
    self.removeTies = function(ties, adjustLayout){
        var updateRequired = false;

        console.log('Removing ties...');
        ties.forEach((tie)=>{
            var linkId = tieToLinkId(tie.id, tie);
            console.log('Considering tie ', tie, '(link id='+linkId+')');
            if(seenLinks[linkId] !== undefined){
                console.log('Found the link; updating...', JSON.stringify(seenLinks[linkId]));
                updateRequired = true;

                if(seenLinks[linkId].count == 1){
                    console.log('Removing link');
                    var i;
                    for(i = 0; i < networkData.links.length; i++){
                        if(networkData.links[i].linkId == linkId){
                            networkData.links.splice(i, 1); // = null;
                            break;
                        }
                    }
                    delete seenLinks[linkId];  
                } else {
                    seenLinks[linkId].count--;
                    seenLinks[linkId].weight -= 
                        tie.weight === undefined ? 1 : tie.weight;
                        console.log('Decrementing link count/weight', JSON.stringify(seenLinks[linkId]));
                }
                delete tieToLinkIdLookup[tie.id]; 

            }
        });

        if(updateRequired){
            svg.selectAll('g,link').remove();
            drawLinks(self);
            drawNodes();
            simulation.force("link").links(networkData.links);

            if(adjustLayout){
                simulation.alpha(1).restart();
            } else {
                refreshNetwork();
            }
        }
    }

    /**
     * Removes or updates a tie to the network. If the link id created by the
     * tie properties (see tieToLinkId) matches an existing link, the existing
     * link's count is decremented and the tie's weight subtracted from the
     * existing link's weight. If the resulting count is 0, the link is removed.
     * If the link id is new, no action is performed.
     * 
     * @param {object} tie A tie object with at least these fields:
     *   - id (the tie's id)
     *   - start (token offset; integer)
     *   - end (token offset; integer)
     *   - source_entity (object)
     *       * location_id OR entity_id
     *   - target_entity (object)
     *       * location_id OR entity_id
     *   - label (string)
     *   - weight (floating point)
     *   - directed (boolean)
     * @param {boolean} adjustLayout Whether or not the network layout should be
     *                               re-adjusted after removing or updating the 
     *                               link.
     */
    self.removeTie = function(tie, adjustLayout){
        self.removeTies([tie], adjustLayout);
    }

    self.toggleTieDirection = function(tie) {
        this.removeTie(tie, false);
        tie.directed = true;

        this.addTie(tie, true);
    }

    /**
     * Removes a group from the network. 
     * 
     * @param {object} group A group object with at least these fields:
     *   - id (the group's id)
     * @param {boolean} adjustLayout Whether or not the network layout should be
     *                               re-adjusted after removing the group node.
     */
    self.removeGroup = function(group, adjustLayout){
        if(seenGroups[group.id] !== undefined){
            svg.selectAll('g,links').remove();
            svg.selectAll('g,node').remove();

            var i;
            for(i = 0; i < networkData.nodes.length; i++){
                if(networkData.nodes[i].id == group.id){
                    networkData.nodes.splice(i, 1); // = null;
                    break;
                }
            }
            delete seenGroups[group.id];
           

            drawLinks(self);
            drawNodes();
            simulation.force("link").links(networkData.links);

            if(adjustLayout){
                simulation.alpha(1).restart();
            } else {
                refreshNetwork();
            }
        }
    }


    /**
     * Adds a group to the network. 
     * 
     * @param {object} group A group object with at least these fields:
     *   - id (the group's id)
     *   - name
     * @param {boolean} adjustLayout Whether or not the network layout should be
     *                               re-adjusted after adding the group node.
     */
    self.addGroup = function(group, adjustLayout){
        if(seenGroups[group.id] === undefined){
            addInternalNode(networkData, group.id);
            simulation.nodes(networkData.nodes);

            drawNodes();

            if(adjustLayout){
                simulation.alpha(1).restart();
            } else {
                refreshNetwork();
            }
        }
    }

    /**
     * Adds a group to the network. 
     * 
     * @param {object} group A group object with at least these fields:
     *   - id (the group's id)
     *   - name
     */
    self.renameGroup = function(group, adjustLayout){
        if(seenGroups[group.id] !== undefined){
            networkData.nodes[seenGroups[group.id]-1].name = group.name;
            d3.select(`.gn${group.id}`).text(group.name);
        }
    }


    /**
     * Resets the network, drawing it from scratch.
     */
    self.reset = function() {
        $(document).trigger('entities.network-reset');

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
    self.exportTSV = function() {
        $(document).trigger('entities.network-export-tsv', link);
        var links = networkData.links.slice();
        // console.log(links);
    }

    self.exportGraphML = function() {
        $(document).trigger('entities.network-export-graphml', link);
        var links = networkData.links.slice();
        var nodes = networkData.nodes.slice();

        // console.log(nodes);

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


    return self;
};