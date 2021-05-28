// File:    ui-updater.js
// Author:  Hank Feild
// Date:    02-Dec-2019
// Purpose: Handles updating the interface based on annotation changes made by
//          the user.


var UIUpdater = function(){
    var self = {};

    /**
     * Updates the UI for a new tie.
     * 
     * @param {jQueryEvent} event Ignored.
     * @param {object} An object with these fields:
     *                  - id
     *                  - tie (object)
     *                      * start (token offset; integer)
     *                      * end (token offset; integer)
     *                      * source_entity (object)
     *                          - location_id OR entity_id
     *                      * target_entity (object)
     *                          - location_id OR entity_id
     *                      * label (string)
     *                      * weight (floating point)
     *                      * directed (boolean)
     */
    self.addTie = function(event, data){
        console.log(`[UIUpdater] adding tie ${data.id}`);

        // Update highlighting in text panel.
        var tieWrapper = {};
        tieWrapper[data.id] = data.tie;
        highlightTiesInContent(data.tie.start, data.tie.end, 
            $('#text-panel'), tieWrapper);

        data.tie.id = data.id;

        // Update network visualization.
        networkViz.addTie(data.tie, true);
    };

    /**
     * Updates the UI with the changes to the given tie.
     * 
     * @param {jQueryEvent} event Ignored.
     * @param {object} An object with these fields:
     *                  - id
     *                  - oldTie (object)
     *                      * start (token offset; integer)
     *                      * end (token offset; integer)
     *                      * source_entity (object)
     *                          - location_id OR entity_id
     *                      * target_entity (object)
     *                          - location_id OR entity_id
     *                      * label (string)
     *                      * weight (floating point)
     *                      * directed (boolean)
     *                  - newTie 
     *                      * (same fields as old_info)
     */
    self.updateTie = function(event, data){
        console.log(`[UIUpdater] updating tie ${data.id}`);

        // Update highlighting in text panel.
        if(data.oldTie.start !== data.newTie.start|| 
           data.oldTie.end !== data.newTie.end){

            // Remove old ties.
            self.removeTie(null, {id: data.id, tie: data.oldTie});

            // Add new ties.
            var newTie = {};
            newTie[data.id] = data.newTie;
            highlightTiesInContent(data.newTie.start, data.newTie.end, 
                $('#text-panel'), newTie);
        }

        data.oldTie.id = data.id;
        data.newTie.id = data.id;

        // Update ties in the network visualization panel.
        networkViz.removeTie(data.oldTie, false);
        networkViz.addTie(data.newTie, true);
    };


    /**
     * Updates the UI with a removed tie.
     * 
     * @param {jQueryEvent} event Ignored.
     * @param {object} An object with info about the removed tie with these 
     *                 fields:
     *                  - id
     *                  - tie (object)
     *                      * start (token offset; integer)
     *                      * end (token offset; integer)
     *                      * source_entity (object)
     *                          - location_id OR entity_id
     *                      * target_entity (object)
     *                          - location_id OR entity_id
     *                      * label (string)
     *                      * weight (floating point)
     *                      * directed (boolean)
     */
    self.removeTie = function(event, data){
        console.log(`[UIUpdater] removing tie ${data.id}`);

        // Update highlighting in text panel.
        iterateOverTokens($('#text-panel'), data.tie.start, data.tie.end,
            function($token, tokenId, isWhitespace){

            if($token.attr('tie-refs') && 
                    $token.attr('tie-refs').includes(`${data.id} `)){

                // Remove the tie id from the tie refs.
                $token.attr('tie-refs', $token.attr('tie-refs').
                    replace(`${data.id} `, ''));

                // Decrease the tie ref count.
                incrementDataAttribute($token, 'tie-ref-count', -1);

                // Remove the tie-text class if the token isn't involved
                // with another tie.
                if(getIntDataAttribute($token, 'tie-ref-count') == 0){
                    $token.removeClass('tie-text');
                }

                // Remove the specific data-tie_... attribute.
                $token.removeAttr(`data-tie_${data.id}`);
            }
        });

        data.tie.id = data.id;

        // Update network visualization.
        networkViz.removeTie(data.tie, true);
    };

    /**
     * Removes an entity from the the entity and text panels.
     * 
     * @param {jQueryEvent} event Ignored.
     * @param {object} An object with info about the removed entity with these 
     *                 fields:
     *                  - id
     *                  - groupId
     */
    self.removeEntity = function(event, data){
        console.log(`[UIUpdater] removing entity ${data.id}`);

        // Remove from entity panel.
        $(`#entity-panel .group-checkbox[data-id=${data.id}]`).remove();
    };

    /**
     * Adds an entity to the the entity and text panels.
     * 
     * @param {jQueryEvent} event Ignored.
     * @param {object} An object with info about the new entity with these 
     *                 fields:
     *                  - id
     *                  - groupId
     */
    self.addEntity = function(event, data){
        console.log(`[UIUpdater] adding entity ${data.id}`);

        // Add to entity panel if its group exists (if its group doesn't exist,
        // this entity will be added when the group is created).
        if($(`#entity-panel input[data-id="${data.id}"]`).length == 0){
            $(`#entity-panel .group[data-id=${data.groupId}]`).
                replaceWith(makeGroupChecklist(data.groupId,
                    annotationManager.groups[data.groupId].entities));
        }
    };

    /**
     * Changes an entity's alias group in the entity, text, and network 
     * visualization panels.
     * 
     * @param {jQueryEvent} event Ignored.
     * @param {object} An object with info about the new entity with these 
     *                 fields:
     *                  - id
     *                  - oldGroupId
     *                  - newGroupId
     */
    self.changeEntityAliasGroup = function(event, data){
        console.log(`[UIUpdater.changeEntityAliasGroup] changing entity's alias group ${data.id}`);

        // If the entity's old group is still in the entity panel, remove it.
        if(annotationManager.groups[data.oldGroupId] &&
            $(`#entity-panel .group[data-id=${data.oldGroupId}] `+
                `.group-checkbox[data-id="${data.id}"]`).length != 0){

            $(`#entity-panel .group[data-id=${data.oldGroupId}]`).
                replaceWith(makeGroupChecklist(data.oldGroupId, 
                    annotationManager.groups[data.oldGroupId].entities));
        }

        // Add to entity panel if its group exists (if its group doesn't exist,
        // this entity will be added when the group is created).
        if($(`#entity-panel .group[data-id=${data.newGroupId}] `+
                `.group-checkbox[data-id="${data.id}"]`).length == 0){
            $(`#entity-panel .group[data-id=${data.newGroupId}]`).
                replaceWith(makeGroupChecklist(data.newGroupId, 
                    annotationManager.groups[data.newGroupId].entities));
        }

        // Update the text area.
        $(`#text-panel [data-entity-id=${data.id}]`).each(function(){
            var $elm  = $(this);
            $elm.attr('data-group-id', data.newGroupId);
            $elm.removeClass(`g${data.oldGroupId}`).
                 addClass(`g${data.newGroupId}`);
        });

        // Update the network visualization panel.
        var ties = [];
        for(let tieId in annotationManager.entities[data.id].ties){
            let tie = annotationManager.ties[tieId];
            ties.push({
                id: tieId,
                start: tie.start,
                end: tie.end,
                source_entity: tie.source_entity, 
                target_entity: tie.target_entity,
                label: tie.label,
                weight: tie.weight,
                directed: tie.directed
            });
        }
        console.log(`[UIUpdater.changeEntityAliasGroup] updating ${ties.length} ties`);
        networkViz.removeTies(ties, false);
        networkViz.addGroup({id: data.newGroupId}, false);
        networkViz.addTies(ties, true);

    };


    /**
     * Removes an entity alias group from the the entity, text, and network
     * visualization panels.
     * 
     * @param {jQueryEvent} event Ignored.
     * @param {object} An object with info about the removed alias group with 
     *                 these fields:
     *                  - id
     */
    self.removeAliasGroup = function(event, data){
        console.log(`[UIUpdater] removing alias group ${data.id}`);

        // Remove from entity panel.
        $(`#entity-panel .group[data-id=${data.id}]`).remove();

        // Remove from network viz panel.
        networkViz.removeGroup(data, true);

    };

    /**
     * Adds an entity alias group to the the entity and network
     * visualization panels.
     * 
     * @param {jQueryEvent} event Ignored.
     * @param {object} An object with info about the removed alias group with 
     *                 these fields:
     *                  - id
     *                  - name
     */
    self.addAliasGroup = function(event, data){
        console.log(`[UIUpdater] adding alias group ${data.id} (${data.name})`);

        // Add to entity panel.
        $('#entity-list ul.groups').append(makeGroupChecklist(data.id, 
            annotationManager.groups[data.id].entities));

        // Add to network viz panel.
        networkViz.addGroup(data, true);

    };

    /**
     * Removes an entity alias group from the the entity, text, and network
     * visualization panels.
     * 
     * @param {jQueryEvent} event Ignored.
     * @param {object} An object with info about the removed alias group with 
     *                 these fields:
     *                  - id
     *                  - name
     */
    self.renameAliasGroup = function(event, data){
        console.log(`[UIUpdater] renaming alias group ${data.id}`);

        // Update network viz panel.
        networkViz.renameGroup(data, true);

    };


    /**
     * Removes a mention fro the text panel.
     * 
     * @param {jQueryEvent} event Ignored.
     * @param {object} An object with info about the removed mention with 
     *                 these fields:
     *                  - id
     *                  - location
     *                      * entity_id
     *                      * start
     *                      * end
     */
    self.addMention = function(event, data){
        console.log(`[UIUpdater] adding mention ${data.id}`);

        // Update the locationsByPage structure.
        var pagesRange = findPageWithLocation(data.location);
        for(let pageIndex = pagesRange[0]; pageIndex <= pagesRange[1]; pageIndex++){
            let page = locationsByPages[pageIndex];
            page.push(data.id);
        }

        // Add to the text panel.
        highlightEntitiesInContent([data.id], $('#text-panel'));
    };


    /**
     * Removes a mention fro the text panel.
     * 
     * @param {jQueryEvent} event Ignored.
     * @param {object} An object with info about the removed mention with 
     *                 these fields:
     *                  - id
     *                  - location
     *                      * entity_id
     *                      * group_id
     *                      * start
     *                      * end
     */
    self.removeMention = function(event, data){
        console.log(`[UIUpdater] removing mention ${data.id}`);

        // Update the locationsByPage structure.
        var pagesRange = findPageWithLocation(data.location);
        for(let pageIndex = pagesRange[0]; pageIndex <= pagesRange[1]; pageIndex++){
            let page = locationsByPages[pageIndex];
            page.splice(page.indexOf(data.id), 1);

        }

        // Remove from text panel.
        iterateOverTokens($('#text-panel'), data.location.start, 
            data.location.end,
            function($token, tokenId, isWhitespace){
            $token.
                removeClass('entity').
                removeClass('annotated-entity'). 
                removeClass(`g${data.location.group_id}`).
                removeClass('start-token'). 
                removeClass('end-token'). 
                removeAttr('data-entity-id').
                removeAttr('data-group-id').
                removeAttr('data-location-id');
        });
    };

    /**
     * Removes a mention fro the text panel.
     * 
     * @param {jQueryEvent} event Ignored.
     * @param {object} An object with info about the removed mention with 
     *                 these fields:
     *                  - id
     *                  - oldLocation
     *                      * entity_id
     *                      * group_id
     *                      * start
     *                      * end
     *                  - newLocation
     *                      * entity_id
     *                      * start
     *                      * end
     */
    self.updateMention = function(event, data){
        console.log(`[UIUpdater] removing mention ${data.id}`);

        // Remove the old information.
        self.removeMention(null, {
            id: data.id,
            location: data.oldLocation
        });

        // Add the new information.
        self.addMention(null, {
            id: data.id,
            location: data.newLocation
        });
    };

    self.setTieView = function(event, data) {
        console.log(`[UIUpdater] setting tie view`);

        if (data.textSpans != undefined && data.textSpans.length < 1) { return ; }

        tieModalTextArea = $('#edit-tieModalTextArea');

        objectOneSelector = $('#edit-tieObjectOneSelector');
        objectTwoSelector = $('#edit-tieObjectTwoSelector');
        dropdownOne = $('#edit-tieObjectOneDropdown');
        dropdownTwo = $('#edit-tieObjectTwoDropdown');
        tieNameBox = $('#edit-tieNameBox');
        tieWeightBox = $('#edit-tieWeightBox');
    
        // Clear old modal body
        tieModalTextArea.empty();
        objectOneSelector.empty();
        objectTwoSelector.empty();
        // tieNameBox.val("");
        // tieNameBox.attr('placeholder', "").blur();
        dropdownOne.empty().html("Object One <span class='caret'></span>");
        dropdownTwo.empty().html("Object One <span class='caret'></span>");
        // menuConfigData.tieObjectOne = null;
        // menuConfigData.tieObjectTwo = null;

        var tokenContext;
        if (data.ties == undefined) {
            // base context around selected text
            const objectSearchWindowSize = 100;
            tokenContext = tokenNavigator.getTokenContext($(`[data-token='${Math.max(1, parseInt($(data.textSpans[0]).attr("data-token")))}']`), 100);
        } else {
            // base context around first tie in selection
            tokenContext = tokenNavigator.getTokenContext($(`[data-token='${parseInt(((parseInt(data.ties[0].start) + parseInt(data.ties[0].end))) / 2)}']`), 100);
        }

        tokenContext.forEach((token) => {
            let clone = token.clone();
            if (token.hasClass("tie-text")) {
                // make tie text distinct from other ties in context
                clone.css('color', '#ff2d50');
                clone.css('text-decoration', 'none');
                clone.css('font-weight', 'bold');
            }
            tieModalTextArea.append(clone);
        });

        var objects = [];
        var objectsAsString = "";
        var preselectOne = null;
        var preselectTwo = null;

        // don't start on a space
        if ($(tokenContext[0]).html().trim() === "") {
            tokenContext.splice(0, 1);
        }

        var mentionIdToText = {};
        var preselectMentionId1 = undefined;
        var preselectMentionId2 = undefined;

        // Assemble the text for each of the mentions in the selection.
        tokenContext.forEach(span => {
            if (span.hasClass('entity')) {
                var mentionId = span.attr('data-location-id');

                if (data.ties == undefined) {
                    if (parseInt(span.attr('data-token')) < parseInt($(data.textSpans[0]).attr("data-token"))) {
                        preselectMentionId1 = mentionId;
                    }
                    if (parseInt(span.attr('data-token')) > parseInt($(data.textSpans[0]).attr("data-token")) && preselectMentionId2 === undefined) {
                        preselectMentionId2 = mentionId;
                    }
                }
                if(mentionIdToText[mentionId] == undefined){
                    mentionIdToText[mentionId] = '';
                }
                mentionIdToText[mentionId] += span.text();
            }
        });

        // Add the mentions as options in the dropdowns.
        if(preselectMentionId1 !== undefined){
            preselectOne = '<li class="tie-object list-group-item" '+
                'data-location-id="' + preselectMentionId1 + '">' + 
                '<span class="unselectable">' + 
                mentionIdToText[preselectMentionId1].trim() + '</span></li>';
        }

        if(preselectMentionId2 !== undefined){
            preselectTwo = '<li class="tie-object list-group-item" '+
                'data-location-id="' + preselectMentionId2 + '">' + 
                '<span class="unselectable">' + 
                mentionIdToText[preselectMentionId2].trim()  + '</span></li>';
        }

        for(var mentionId in mentionIdToText){
            objects.push('<li class="tie-object list-group-item" '+
                'data-location-id="' + mentionId + '">' + 
                '<span class="unselectable">' + mentionIdToText[mentionId].trim() + 
                '</span></li>');
        }

        objects.push("<li class='list-group-item disabled' style='text-align: center;'><span style='text-align: center;'>--- Entities ---</span></li>");

        for (entity in annotation_data.annotation.entities) {
            objects.push('<li class="tie-object list-group-item" data-entity-id="' + entity.toString() + '">' + 
                    '<span class="unselectable">' + annotation_data.annotation.entities[entity].name + '</span></li>');
        }

        objectsAsString = objects.join("");
        objectOneSelector.append(objectsAsString);
        objectTwoSelector.append(objectsAsString);

        if (data.ties == undefined) {
            // preselect objects closest to selected text area, if they exist
            if (typeof preselectOne !== typeof null && typeof preselectOne !== typeof undefined) {
                preselectOne = $(preselectOne);
                var mention = tieModalTextArea.find('[data-location-id=' + preselectOne.attr('data-location-id') + ']');  
                mention.addClass('selectedTieObject');
                mention.addClass('selectedEntity');

                // disable this mention in dropdowns
                objectOneSelector.find('[data-location-id=' + preselectOne.attr('data-location-id') + ']').addClass("disabled");
                data.tieObjectOne = objectOneSelector.find('[data-location-id=' + preselectOne.attr('data-location-id') + ']');
                menuConfigData.tieObjectOne = data.tieObjectOne;
                var dropdownText = preselectOne.find('span').html();
                if (preselectOne.attr('data-entity-id') !== undefined && preselectOne.attr('data-entity-id') !== null) {dropdownText+=" (entity)";}
                dropdownOne.empty().html(dropdownText + ' <span class="caret"></span>');
            }
            if (typeof preselectTwo !== typeof null && typeof preselectTwo !== typeof undefined) {
                preselectTwo = $(preselectTwo);
                var mention = tieModalTextArea.find('[data-location-id=' + preselectTwo.attr('data-location-id') + ']');  
                mention.addClass('selectedTieObject');
                mention.addClass('selectedEntity');

                // disable this mention in dropdowns
                objectTwoSelector.find('[data-location-id=' + preselectTwo.attr('data-location-id') + ']').addClass("disabled");
                preselectTwo.addClass("disabled");
                data.tieObjectTwo = objectTwoSelector.find('[data-location-id=' + preselectTwo.attr('data-location-id') + ']');
                menuConfigData.tieObjectTwo = data.tieObjectTwo;
                var dropdownText = preselectTwo.find('span').html();
                if (preselectTwo.attr('data-entity-id') !== undefined && preselectTwo.attr('data-entity-id') !== null) {dropdownText+=" (entity)";}
                dropdownTwo.empty().html(dropdownText + ' <span class="caret"></span>');

                if (preselectOne != undefined) {
                    $(document).trigger('entities.annotation.set-allow-add-tie', {
                        allowed: true,
                    });
                }
            }
        }

        const $dropdown = $("#edit-addEntityToNetworkDropdownMenu");
        Object.keys(annotation_data.annotation.groups).map((groupId, i) => {
            $dropdown.append(`<li><a id="edit-addEntityToNetworkDropdownItem" group=${groupId} class="dropdown-item" href="#">${annotation_data.annotation.groups[groupId].name}</a></li>`);
        });
    
        $('#editTieModal').one('shown.bs.modal', () => {
            editTieNetworkViz = NetworkVisualizer();
            editTieNetworkViz.init("#edit-tie-network-svg");
            
            if (data.ties != undefined) {
                editTieNetworkViz.loadTieNetwork(Object.keys(annotation_data.annotation.ties)
                    .filter(key => data.tieRefs.includes(key))
                    .reduce((obj, key) => {
                        obj[key] = annotation_data.annotation.ties[key];
                        return obj;
                    }, {}), annotation_data.annotation);
        
                editTieNetworkViz.setAnnotationBlock(annotationManager, data.ties[0].start, data.ties[0].end);
            } else {
                editTieNetworkViz.loadTieNetwork({}, annotation_data.annotation);
        
                editTieNetworkViz.setAnnotationBlock(annotationManager, $(data.textSpans[0]).attr("data-token"), $(data.textSpans[data.textSpans.length - 1]).attr("data-token"));
            }
        })
    
        // // Fill in current tie values
        // if (typeof tie.label === typeof null) {
        //     tieNameBox.val("");
        // } else { tieNameBox.val(tie.label); }
        // // Fill in current tie values
        // if (typeof tie.directed === typeof null || typeof tie.directed === typeof undefined) {
        //     tieDirectedToggle.prop('checked', false);
        // } else { tieDirectedToggle.prop('checked', tie.directed); }
        // tieWeightBox.val(tie.weight);
    
        $('#confirmEditTie').attr("tie-ref", $(this).attr('tie-ref'));
        $('#editTieModalOpener').click();

        $(document).trigger('entities.tie-modal-autofill', {
            source_location_id: preselectOne ? preselectOne.attr('data-location-id') : null,
            source_list: dropdownOne[0].outerHTML,
            target_location_id: preselectTwo ? preselectTwo.attr('data-location-id') : null,
            target_list: dropdownTwo[0].outerHTML
        });
    }

    self.setNewTieModalDropdownSource = function(event, data) {
        console.log(`[UIUpdater] setting tie modal dropdown source to data-location-id ${data.selection.attr('data-location-id')}`);

        const tieModalTextArea = $('#edit-tieModalTextArea');
        const objectOneSelector = $('#edit-tieObjectOneSelector');
        const objectTwoSelector = $('#edit-tieObjectTwoSelector');
        const dropdownOne = $('#edit-tieObjectOneDropdown');
        const dropdownTwo = $('#edit-tieObjectTwoDropdown');

        var mention = tieModalTextArea.find('[data-location-id=' + data.selection.attr('data-location-id') + ']');  
        mention.addClass('selectedTieObject');
        mention.addClass('selectedEntity');

        console.log(menuConfigData);

        if (menuConfigData.tieObjectOne !== null) {
            tieModalTextArea.find('[data-location-id=' + menuConfigData.tieObjectOne.attr('data-location-id') + ']').removeClass('selectedTieObject');
            tieModalTextArea.find('[data-location-id=' + menuConfigData.tieObjectOne.attr('data-location-id') + ']').removeClass('selectedEntity');
            objectOneSelector.find('[data-location-id=' + menuConfigData.tieObjectOne.attr('data-location-id') + ']')
                .removeClass("disabled");
                objectTwoSelector.find('[data-location-id=' + menuConfigData.tieObjectOne.attr('data-location-id') + ']')
                .removeClass("disabled");
                objectOneSelector.find('[data-entity-id=' + menuConfigData.tieObjectOne.attr('data-entity-id') + ']')
                .removeClass("disabled");
        }
        data.selection.addClass("disabled");
        objectTwoSelector.find('[data-location-id=' + data.selection.attr('data-location-id') + ']').addClass("disabled");
        menuConfigData.tieObjectOne = data.selection;
        var dropdownText = data.selection.find('span').html();
        if (data.selection.attr('data-entity-id') !== undefined && data.selection.attr('data-entity-id') !== null) {dropdownText+=" (entity)";}
        dropdownOne.empty().html(dropdownText + ' <span class="caret"></span>');

        if (menuConfigData.tieObjectOne != null && menuConfigData.tieObjectTwo != null) {
            $(document).trigger('entities.annotation.set-allow-add-tie', {
                allowed: true,
            });
        } else {
            $(document).trigger('entities.annotation.set-allow-add-tie', {
                allowed: false,
            });
        }

        $(document).trigger('entities.tie-modal-source-change', {
            source_location_id: data.selection.attr('data-location-id'),
            source_list: objectOneSelector[0].outerHTML
        });
    }

    self.setNewTieModalDropdownTarget = function(event, data) {
        console.log(`[UIUpdater] setting tie modal dropdown target to data-location-id ${data.selection.attr('data-location-id')}`);

        const tieModalTextArea = $('#edit-tieModalTextArea');
        const objectOneSelector = $('#edit-tieObjectOneSelector');
        const objectTwoSelector = $('#edit-tieObjectTwoSelector');
        const dropdownOne = $('#edit-tieObjectOneDropdown');
        const dropdownTwo = $('#edit-tieObjectTwoDropdown');

        var mention = tieModalTextArea.find('[data-location-id=' + data.selection.attr('data-location-id') + ']');  
        mention.addClass('selectedTieObject');
        mention.addClass('selectedEntity');

        if (menuConfigData.tieObjectTwo !== null) {
            tieModalTextArea.find('[data-location-id=' + menuConfigData.tieObjectTwo.attr('data-location-id') + ']').removeClass('selectedTieObject');
            tieModalTextArea.find('[data-location-id=' + menuConfigData.tieObjectTwo.attr('data-location-id') + ']').removeClass('selectedEntity');
            objectOneSelector.find('[data-location-id=' + menuConfigData.tieObjectTwo.attr('data-location-id') + ']')
                .removeClass("disabled");
                objectTwoSelector.find('[data-location-id=' + menuConfigData.tieObjectTwo.attr('data-location-id') + ']')
                .removeClass("disabled");  
                objectTwoSelector.find('[data-entity-id=' + menuConfigData.tieObjectTwo.attr('data-entity-id') + ']')
                .removeClass("disabled");
        }
        objectOneSelector.find('[data-location-id=' + data.selection.attr('data-location-id') + ']').addClass("disabled");
        data.selection.addClass("disabled");
        menuConfigData.tieObjectTwo = data.selection;
        var dropdownText = data.selection.find('span').html();
        if (data.selection.attr('data-entity-id') !== undefined && data.selection.attr('data-entity-id') !== null) {dropdownText+=" (entity)";}
        dropdownTwo.empty().html(dropdownText + ' <span class="caret"></span>');

        if (menuConfigData.tieObjectOne != null && menuConfigData.tieObjectTwo != null) {
            $(document).trigger('entities.annotation.set-allow-add-tie', {
                allowed: true,
            });
        } else {
            $(document).trigger('entities.annotation.set-allow-add-tie', {
                allowed: false,
            });
        }

        $(document).trigger('entities.tie-modal-target-change', {
            target_location_id: data.selection.attr('data-location-id'),
            target_list: objectTwoSelector[0].outerHTML
        });
    }

    self.setAllowAddTie = function(event, data) {
        console.log(`[UIUpdater] setting allow add tie button to ${data.allowed == undefined || !data.allowed ? "disabled" : "enabled"}`);

        $("#edit-addTieBtn").prop('disabled', !data.allowed);
    }

    self.setEditTieSelectedTie = function(event, data) {
        console.log(`[UIUpdater] setting edit-tie selected tie ${data.tie == undefined ? "to undefined" : data.tie.id}`);

        const nameBox = $('#edit-tieNameBox');
        const weightBox = $('#edit-tieWeightBox');
        const directedToggle = $('#edit-tieDirectedToggle');
        const adjustTieBtn = $('#edit-adjustTieBtn');

        if (data.tie) {
            if (data.tie.label == undefined) {
                nameBox.val("");
            } else { 
                nameBox.val(data.tie.label);
            }
            weightBox.val(data.tie.weight);
            if (data.tie.directed == undefined) {
                directedToggle.prop('checked', false);
            } else { 
                directedToggle.prop('checked', data.tie.directed);
            }

            nameBox.prop('disabled', false);
            weightBox.prop('disabled', false);
            directedToggle.prop('disabled', false);
            adjustTieBtn.prop('disabled', false);

            $(".edit-editTieValue").removeClass('edit-hide');
        } else {
            nameBox.val("");
            weightBox.val(0);
            directedToggle.prop('checked', false);

            nameBox.prop('disabled', true);
            weightBox.prop('disabled', true);
            directedToggle.prop('disabled', true);
            adjustTieBtn.prop('disabled', true);

            $(".edit-editTieValue").addClass('edit-hide');
        }
    }

    self.setAllowConfirmTieChanges = function(event, data) {
        console.log(`[UIUpdater] setting allow confirm tie changes button to ${data.allowed == undefined || !data.allowed? "disabled" : "enabled"}`);

        $("#confirmEditTie").prop('disabled', !data.allowed);
    }

    /**
     * Adds listeners for annotation update events.
     */
    function init(){
        // Tie listeners.
        $(document).on('entities.annotation.tie-removed', self.removeTie);
        $(document).on('entities.annotation.tie-updated', self.updateTie);
        $(document).on('entities.annotation.tie-added', self.addTie);

        // Tie Modal listeners
        $(document).on('entities.annotation.edit-tie-selected-changed', 
            self.setEditTieSelectedTie);
        $(document).on('entities.annotation.set-allow-confirm-tie-changes',
            self.setAllowConfirmTieChanges);
        $(document).on('entities.annotation.set-tie-view',
            self.setTieView);
        $(document).on('entities.annotation.set-new-tie-modal-dropdown-source',
            self.setNewTieModalDropdownSource);
        $(document).on('entities.annotation.set-new-tie-modal-dropdown-target',
            self.setNewTieModalDropdownTarget);
        $(document).on('entities.annotation.set-allow-add-tie',
            self.setAllowAddTie);
        $(document).on("click", "#edit-addEntityToNetworkDropdownItem", (e) => {
            const groupId = e.target.getAttribute("group");
            const group = annotation_data.annotation.groups[groupId];
            group.id = groupId;

            editTieNetworkViz.addGroup(group, true);
        });

        // Entity listeners.
        $(document).on('entities.annotation.entity-removed', self.removeEntity);
        $(document).on('entities.annotation.entity-added', self.addEntity);
        $(document).on('entities.annotation.entity-alias-group-changed', 
            self.changeEntityAliasGroup);

        // TODO need something like: entities.annotation.entity-group-changed
        // or entity-updated.

        // Alias group listeners.
        $(document).on('entities.annotation.group-removed', 
                       self.removeAliasGroup);
        $(document).on('entities.annotation.group-added', 
                       self.addAliasGroup);
        $(document).on('entities.annotation.group-renamed', 
                       self.renameAliasGroup);

        // Mention listeners.
        $(document).on('entities.annotation.mention-removed', 
                       self.removeMention);
        $(document).on('entities.annotation.mention-added', self.addMention);
        $(document).on('entities.annotation.mention-updated', 
                       self.updateMention);

        $(document).ready(function(){
            $('#visualizer-tutorial[data-toggle="popover"]').popover({
                html: true,
                content: function() {
                    return $("#visualizer-tutorial-content").html();
                },
                trigger: "hover",
                container: 'body',
            })
            .on("show.bs.popover", function() {
                $(this).data("bs.popover").tip().css("max-width", "600px");
            });
        });

    }

    init();

    return self;
};

var uiUpdater;
$(document).ready(function(){
    uiUpdater = UIUpdater(); 
});