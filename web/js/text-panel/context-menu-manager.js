// File: context-menu-manager.js
// Author: Hank Feild
// Date: 2021-08-03
// Purpose: Provides functions for displaying and responding to clicks on 
//          menus when tokens are clicked or selected.


/**
 * Handles displaying and handling interactions with context menus in the text 
 * panel.
 * 
 * @param textPanelManager An instance of the parent TextPanelManager instance.
 */
TextPanel.ContextMenuManager = function(textPanelManager){
    var self = {
        textPanelManager: textPanelManager,
        tokens: undefined
    };

    var $menu, $selectionMenu, menuConfigData = {};

    /**
     * 
     */
    var existingEntityClicked = function(event) {
        // var clickedEntity = $(this).find('.entity');
        var clickedEntity = $(this);
        var entityId = clickedEntity.attr('data-entity-id');
        var groupId = clickedEntity.attr('data-group-id');

        if (clickedEntity.hasClass('selectedEntity')) {
            deselectEntity(clickedEntity);
            menuConfigData.selectedGroups.splice(menuConfigData.selectedGroups.indexOf(groupId), 1);
            menuConfigData.selectedMentions.splice(menuConfigData.selectedMentions.indexOf(clickedEntity.attr('data-location-id')), 1);

            // Uncheck the checkbox
            $('[data-id=' + groupId + ']').filter('li').find('input').filter('[data-id=' + entityId + ']').prop('checked', 0);

            updateSelectionInfoBox();
            return;
        }

        selectEntity(clickedEntity);
        menuConfigData.selectedGroups.push(groupId);
        menuConfigData.selectedMentions.push(clickedEntity.attr('data-location-id'));

        // Find entity in group list
        // Check the checkbox
        $('[data-id=' + groupId + ']').filter('li').find('input').filter('[data-id=' + entityId + ']').prop('checked', 1);

        var contextMenuOptions = [];

        contextMenuOptions.push("<li class='context-menu__item hover-option thisMentionHover'><a class='context-menu__link'><i>This Mention...</i></a></li>");
        contextMenuOptions.push("<li class='context-menu__item hover-option thisEntityHover'><a class='context-menu__link'><i>This Entity...</i></a></li>");
        contextMenuOptions.push("<li class='context-menu__item hover-option thisGroupHover'><a class='context-menu__link'><i>All Aliases...</i></a></li>");
        if (menuConfigData.numSelectedEntities > 1) {
            contextMenuOptions.push("<li class='context-menu__item hover-option selectedHover'><a class='context-menu__link'><i>Selected...</i></a></li>");
        }
        
        openContextMenu(contextMenuOptions, clickedEntity, event);
        updateSelectionInfoBox();
    };


    function selectEntity(entity) {
        entityId = entity.attr('data-entity-id');
        menuConfigData.numSelectedEntities++;
        menuConfigData.recentSelectedEntityId = entityId;
        menuConfigData.recentSelectedEntity = entity;
        menuConfigData.selectedEntities.push(entityId);

        if (entity.hasClass('entity')) {
            $('[data-location-id="' + entity.attr('data-location-id') + '"]').each(function() {
                $(this).addClass('selectedEntity');
            });
        }
    }

    function deselectEntity(entity) {
        entityId = entity.attr('data-entity-id');
        // Remove entity from selection list
        menuConfigData.numSelectedEntities--;
        menuConfigData.selectedEntities.splice(menuConfigData.selectedEntities.indexOf(entityId), 1);
        menuConfigData.recentSelectedEntity = null;
        menuConfigData.recentSelectedEntityId = null;

        if (entity.hasClass('entity')) {
            $('[data-location-id="' + entity.attr('data-location-id') + '"]').each(function() {
                $(this).removeClass('selectedEntity');
            });
        }
    }

    /**
     * Triggered when a token selection has occurred. 
     * 
     * @param {Event} event DOM event.
     * @param {Object} tokenRange An object with two fields: 
     *                              - start (the starting token id)
     *                              - end (the ending token id)
     * @param {Object} mousePosition An object with two fields:
     *                              - x (the clientX of the mouse at selection)
     *                              - y (the clientY of the mouse at selection)
     */
    var checkSelectedText = function(event, tokenRange, mousePosition) {
        console.log('In checkSelectedText!', event, tokenRange, mousePosition);

        var $textSpans, newGroupID, contextMenuOptions;

        if(tokenRange.end < tokenRange.start || tokenRange.start < 0){ return; }

        // TODO: do we need this if we have the token range?
        // $textSpans = self.textPanelManager.$textPanel.find('.selected');

        // TODO: is this necessary if we've already checked tokenRange?
        if (tokenRange.end - tokenRange.start < 0) {
            return;
        } 

        // get unused group ID
        // TODO: Fix this; only AnnotationManager should be creating new group
        // ids.
        // newGroupID = Object.keys(annotation_data.annotation.groups).length + 1;

        menuConfigData.tokenRange = tokenRange;
        // menuConfigData.$textSpans = $textSpans;
        // menuConfigData.newGroupID = newGroupID; // TODO: fix

        openContextMenu($selectionMenu, null, mousePosition);
    }

    function getSelectedSpans() {
        var startSpan;
        var endSpan;
        var spans = [];
        var spanCount = 0;

        sel = window.getSelection();
        
        if (typeof sel.anchorNode.nodeValue === typeof null || typeof sel.anchorNode.nodeValue === typeof undefined
            || typeof sel.focusNode.nodeValue === typeof null || typeof sel.focusNode.nodeValue === typeof undefined) {return [];}

        if (sel.anchorNode.nodeValue.trim() == "") {
            startSpan = $(sel.anchorNode.parentElement).prev()[0];
        } else {
            startSpan = sel.anchorNode.parentElement;
        }
        if (sel.focusNode.nodeValue.trim() == "") {
            endSpan = $(sel.focusNode.parentElement).prev()[0];
        } else {
            endSpan = sel.focusNode.parentElement;
        }

        if (!$(startSpan).is('span') || !$(endSpan).is('span') || !$(startSpan).parent().hasClass('content-page') || !$(endSpan).parent().hasClass('content-page')) {
            return [];
        }

        if (Number($(startSpan).attr('data-token')) > Number($(endSpan).attr('data-token'))) {

            var temp = startSpan;
            startSpan = endSpan;
            endSpan = temp;
        } 

        if (startSpan === endSpan) {
            spans = [];
            spans.push(startSpan);
            return spans;
        }

        var current;
        // for every <span> in text area
        $('.content-page').children('span').each(function() {
            current = $(this)[0];
            // if still searching for starting span
            if (spanCount == 0) {
                if (current === startSpan) {
                    // add starting span
                    spans[spanCount] = startSpan;
                    spanCount++;
                }
            // if starting span has already been found
        } else {
                // if current is not last span selected
                if (!(current === endSpan)) {
                    spans[spanCount] = current;
                    spanCount++;
                }
                // if current IS last span selected
                else {
                    spans[spanCount] = endSpan;
                    // quit each loop
                    return false;
                }
            }
        });

        return spans;
    }

    var deselectAllText = function() {
        window.getSelection().removeAllRanges();
        // maybe do some more stuff here later
    }

    var groupListCheckboxClicked = function() {
        if ($(this).is(":checked")) {
            selectEntity($('[data-entity-id="' + $(this).attr("data-id") + '"]'));
        } else {
            deselectEntity($('[data-entity-id="' + $(this).attr("data-id") + '"]'));
        }
    }

    /**
     * Opens a context menu where the mouse is or where the clicked entity is.
     * 
     * @param {jQuery} $menu The menu element to display. 
     * @param {jQuery} $clickedEntity The entity selection that was clicked.
     * @param {Object} mousePosition An object with two fields:
     *                              - x (the clientX of the mouse at selection)
     *                              - y (the clientY of the mouse at selection)
     */
    var openContextMenu = function($menu, $clickedEntity, mousePosition) {
        console.log('In openContextMenu(', $menu, $clickedEntity, mousePosition, ')');

        if ($menu.hasClass('hidden')) {

            var menuPosition = getPositionForMenu(mousePosition, $clickedEntity);
            $menu.removeClass('hidden');
            setTimeout(function(){$menu.addClass('open');}, 250);

            // Coordinates
            $menu.css({left: menuPosition.x +'px'});
            $menu.css({top: menuPosition.y +'px'});

        } else {
            $menu.addClass('hidden');
        }
    }

    var openTieContextMenu = function(e) {
        var contextMenuOptions = [];

        var tieRefs = $(this).attr('tie-refs');
        if (tieRefs === undefined || tieRefs === null) {return;}

        contextMenuOptions.push(`<li class='context-menu__item editTieOption' tie-refs='${tieRefs}'><a class='context-menu__link'><i><span id=\"editTie\">View Tie...</span></i></a></li>`);

        openContextMenu(contextMenuOptions, null, e);
    }

    /**
     * Closes any open menus.
     */
    var closeContextMenu = function() {
        console.log('in closeContextMenu', $textPanel.find('.menu.open'));
        $('.text-panel-menu.open').removeClass('open').addClass('hidden');
    }

    var startHoverMenuTimer = function(e) {
        if (typeof menuTimer === typeof null || typeof menuTimer === typeof undefined) { 
            menuTimer = setTimeout(openHoverMenu, 150, $(e.target).parent());
        }
    }

    var clearHoverMenuTimer = function(e) {
        if (menuConfigData.tieMentionHoveredOne === null || menuConfigData.tieMentionHoveredOne === undefined) {
            // unhighlight what's highlighted by hover menu
            $('.selectedEntity').each(function() {
                $(this).removeClass('selectedEntity');
            })

            // rehighlight what was specifically clicked
            menuConfigData.selectedMentions.forEach(function(m) {
                $('[data-location-id="' + m + '"]').each(function() {
                    $(this).addClass('selectedEntity');
                });
            }) 
        }
        
        if (typeof menuTimer === typeof null || typeof menuTimer === typeof undefined) { return; }
        clearTimeout(menuTimer);
        menuTimer = null;
    }

    var openHoverMenu = function(hoverOption) {
        if (!hoverOption.hasClass('tieHover') && (menuConfigData.recentSelectedEntity === null || menuConfigData.recentSelectedEntity === undefined)) {
            return;
        }

        var entity = menuConfigData.recentSelectedEntity;

        var hoverMenu = $('.context-menu-hover');
        var hoverMenuItems = $('.context-menu-hover').find('.context-menu__items');
        var options = [];
        var locationMultiplier = 1;

        if (!hoverOption.hasClass('tieHover')) {
            // unhighlight everything, preparing for more specific highlighting
            $('[data-group-id="' + entity.attr('data-group-id') + '"]').each(function() {
                $(this).removeClass('selectedEntity');
            });
        }

        // base locationMultiplier off of number of context menu options
        $(hoverOption.parent()).children().each(function() {
            if (!hoverOption.is($(this))) {locationMultiplier++;}
            else {return false;}
        });

        if (hoverOption.hasClass('thisMentionHover')) {
            options.push("<li class='context-menu__item deleteMentionOption'><a class='context-menu__link'><i><span id=\"deleteMention\">Delete</span></i></a></li>");
            options.push("<li class='context-menu__item reassignMentionOption'><a class='context-menu__link'><i><span id=\"reassignMention\">Reassign</span></i></a></li>");

            $('[data-location-id="' + entity.attr('data-location-id') + '"]').addClass('selectedEntity');
        }
        else if (hoverOption.hasClass('thisEntityHover')) {
            options.push("<li class='context-menu__item suggestMentions'><a class='context-menu__link'><i><span d=\"suggestMentions\">Suggest Mentions</span></i></a></li>");
            options.push("<li class='context-menu__item deleteEntityOption'><a class='context-menu__link'><i><span d=\"deleteEntity\">Delete</span></i></a></li>");
            options.push("<li class='context-menu__item moveEntityToGroupOption'><a class='context-menu__link'><i><span id=\"moveEntityToGroup\">Move to Group</span></i></a></li>");

            $('[data-entity-id="' + entity.attr('data-entity-id') + '"]').each(function() {
                $(this).addClass('selectedEntity');
            });
        }
        else if (hoverOption.hasClass('thisGroupHover')) {
            options.push("<li class='context-menu__item deleteGroupOption'><a class='context-menu__link'><i><span id=\"deleteGroup\">Delete</span></i></a></li>");
            options.push("<li class='context-menu__item changeGroupNameOption'><a class='context-menu__link'><i><span id=\"changeGroupName\">Change Group Name</span></i></a></li>");

            $('[data-group-id="' + entity.attr('data-group-id') + '"]').each(function() {
                $(this).addClass('selectedEntity');
            });
        }
        else if (hoverOption.hasClass('selectedHover')) {
            if (menuConfigData.numSelectedEntities > 1) {
                options.push("<li class='context-menu__item groupEntitiesOption'><a class='context-menu__link'><i>Group Entites</i></a></li>");
            }
            if (menuConfigData.selectedGroups.length > 1) {
                options.push("<li class='context-menu__item combineSelectedGroupsOption'><a class='context-menu__link'><i><span id=\"combineSelectedGroups\">Combine Groups Here</span></i></a></li>");
                options.push("<li class='context-menu__item deleteSelectedGroupsOption'><a class='context-menu__link'><i><span id=\"deleteSelectedGroups\">Delete Selected Groups</span></i></a></li>");
            }

            menuConfigData.selectedGroups.forEach(function(g) {
                $('[data-group-id="' + g + '"]').each(function() {
                    $(this).addClass('selectedEntity');
                });
            });
        }
        else if (hoverOption.hasClass('tieHover')) {
            options.push("<li class='context-menu__item editTieOption' tie-ref='" + hoverOption.attr('tie-ref') + "'><a class='context-menu__link'><i><span id=\"editTie\">View Tie...</span></i></a></li>");
            options.push("<li class='context-menu__item deleteTieOption' tie-ref='" + hoverOption.attr('tie-ref') + "'><a class='context-menu__link'><i><span id=\"deleteTie\">Delete Tie</span></i></a></li>");


            // unhighlight previously highlighted mentions if they exist
            if (menuConfigData.tieMentionHoveredOne !== null || menuConfigData.tieMentionHoveredOne !== undefined) {
                $('[data-location-id="' + menuConfigData.tieMentionHoveredOne + '"]').removeClass('selectedEntity');
                $('[data-location-id="' + menuConfigData.tieMentionHoveredTwo + '"]').removeClass('selectedEntity');
            }
            menuConfigData.tieMentionHoveredOne = annotation_data.annotation.ties[hoverOption.attr('tie-ref')].source_entity.location_id;
            menuConfigData.tieMentionHoveredTwo = annotation_data.annotation.ties[hoverOption.attr('tie-ref')].target_entity.location_id;
            // highlight mentions if they exist
            $('[data-location-id="' + menuConfigData.tieMentionHoveredOne + '"]').addClass('selectedEntity');
            $('[data-location-id="' + menuConfigData.tieMentionHoveredTwo + '"]').addClass('selectedEntity');
        }

        hoverMenuItems.empty();
        options.forEach(function(entry) {
            hoverMenuItems.html(hoverMenuItems.html() + entry);
        });

        // Coordinates
        hoverMenu.css('left', parseInt(menu.style.left) + parseInt($(menu).css('width')));
        if (locationMultiplier === 1) {
            hoverMenu.css('top', parseInt(menu.style.top));
        } else {
            var heightOffset = $('.context-menu').height() / $('.context-menu > .context-menu__items > .context-menu__item').length;
            hoverMenu.css('top', parseInt(menu.style.top) + (heightOffset * locationMultiplier) - parseInt($('.context-menu').css('padding-top')) - parseInt($('.context-menu > .context-menu__items > .context-menu__item').css('margin-bottom')));
        }

        hoverMenu.addClass("context-menu--active");

        $(document).trigger('entities.hover-menu-opened', {contents: hoverMenu.html()});

    }

    var closeHoverMenu = function(e) {  
        var hoverMenu = $('.context-menu-hover');
        var hoverMenuItems = $('.context-menu-hover').find('.context-menu__items');

        hoverMenuItems.empty();

        hoverMenu.removeClass("context-menu--active");
        $(document).trigger('entities.hover-menu-closed');

    }

    /**
     * Calculates the placement of a context menu.
     * 
     * @param {Object} mousePosition An object with two fields:
     *                              - x (the clientX of the mouse at selection)
     *                              - y (the clientY of the mouse at selection)
     * @param {jQuery} $clickedEntity The entity that was clicked.
     * @returns 
     */
    function getPositionForMenu(mousePosition, $clickedEntity) {
        if ($clickedEntity == null) {
            return mousePosition;
        }

        var offset =  $clickedEntity.offset();

        return {
            x: offset.left + $clickedEntity.width(),
            y: offset.top + $clickedEntity.height()
        };
    }

    var updateSelectionInfoBox = function(e) {
        function onlyUnique(value, index, self) { 
            return self.indexOf(value) === index;
        }

        $('#entityInfoBox').html(menuConfigData.selectedEntities.filter(onlyUnique).length + " entities selected");
        $('#mentionInfoBox').html(menuConfigData.selectedMentions.filter(onlyUnique).length + " mentions selected");
        $('#groupInfoBox').html(menuConfigData.selectedGroups.filter(onlyUnique).length + " alias groups selected");
    }


    ////////////////////////////////////////////////////////////////////////////////
    // CONTEXT MENU FUNCTIONS
    ////////////////////////////////////////////////////////////////////////////////

    var makeEntityModalChecklist = function(groupId, entities, radioOptionName) {
        var list = `<li class="groups group unselectable" data-id="${groupId}">`, entityId, i,
        entitiesSize = size(entities);
        for(entityId in entities){
            list += `<div class="pretty p-default p-round p-smooth"><input type="radio" name="${radioOptionName}" class="group-checkbox" data-id="${entityId}" value="${entityId}"><div class="state p-primary"><i class="icon mdi mdi-check"></i><label><span class="g${groupId} unselectable">${entities[entityId].name}</span></label></div></div>`;
            if(i < entitiesSize-1){
                list += ', ';
            }
            i++;
        }
        list += '</li>';
        return list;
    }

    var openAddMentionModal = function() {
        if (menuConfigData.textSpans.length < 1) {
            return;
        }
        
        var $allEntitiesChecklist = $('#addMentionEntitySelectorChecklist');
        var $recentlyMentionedEntitiesDiv = $('#addMentionModal .recentlySeenWrapper');
        var $recentlyMentionedEntitiesChecklist = $recentlyMentionedEntitiesDiv.find('ul');
        $allEntitiesChecklist.empty();
        $recentlyMentionedEntitiesChecklist.empty();
        $recentlyMentionedEntitiesDiv.hide();

        // First, add the 10 most recently mentioned entities/groups (prior to the
        // selection). 
        var curToken = menuConfigData.textSpans[0];
        var groupsSeen = {};
        var groupsSeenOrdered = [];
        var count = 0, i;
        while(count < 10 && curToken !== null){
            if(curToken.hasAttribute('data-group-id')){
                var groupId = curToken.getAttribute('data-group-id');
                if(groupsSeen[groupId] === undefined){
                    groupsSeen[groupId] = true;
                    groupsSeenOrdered.push(groupId);
                    count++;
                }
            }

            // We're still in the current content page.
            if(curToken.previousSibling !== null){
                curToken = curToken.previousSibling;

            // We might be at a content page border; move curToken to the end of the 
            // previous page.
            } else if(curToken.parentElement.getAttribute('data-page') !== '0') {
                curToken = curToken.parentElement.previousSibling.lastChild;

            // We've hit the beginning.
            } else {
            break;
            }
        }

        // This section will only be shown if there's at least one entity to list.
        if(count > 0){
            for(i = 0; i < count; i++){
                var groupId = groupsSeenOrdered[i];
                var group = annotationManager.groups[groupId];
                $recentlyMentionedEntitiesChecklist.append(makeEntityModalChecklist(groupId, group.entities, 'addMentionEntityRadioOption'));
            }
            $recentlyMentionedEntitiesDiv.show();
        }

        // Make a list of ALL the entities.
        for(groupId in annotationManager.groups){
            var group = annotationManager.groups[groupId];
            $allEntitiesChecklist.append(makeEntityModalChecklist(groupId, group.entities, 'addMentionEntityRadioOption'));
        }

        $('#addMentionModalOpener').click();
    }

    var confirmAddMention = function() {
        console.log("In confirmAddMention");

        var selectedEntity = $("input:radio[name='addMentionEntityRadioOption']:checked").val();

        if (selectedEntity === undefined) {
            return;
        }

        var spans = menuConfigData.textSpans;
        console.log(spans);

        // addMention(entityId, startingOffset, endingOffset, callback);
        annotationManager.addMention(selectedEntity, $(spans[0]).attr('data-token'), $(spans[spans.length-1]).attr('data-token'));

        resetMenuConfigData();
    }

    var openReassignMentionModal = function() {
        var $allEntitiesChecklist = $('#reassignMentionEntitySelectorChecklist');
        var $recentlyMentionedEntitiesDiv = $('#reassignMentionModal .recentlySeenWrapper');
        var $recentlyMentionedEntitiesChecklist = $recentlyMentionedEntitiesDiv.find('ul');
        $allEntitiesChecklist.empty();
        $recentlyMentionedEntitiesChecklist.empty();
        $recentlyMentionedEntitiesDiv.hide();

        // First, add the 10 most recently mentioned entities/groups (prior to the
        // selection). 
        console.log($('#text-panel [data-location-id='+ 
                            menuConfigData.selectedMentions[
                                menuConfigData.selectedMentions.length-1] +']'));
        var curToken = $('#text-panel [data-location-id='+ 
                            menuConfigData.selectedMentions[
                                menuConfigData.selectedMentions.length-1] +']')[0];
        var groupsSeen = {};
        var groupsSeenOrdered = [];
        var count = 0, i;
        while(count < 10 && curToken !== null){
            if(curToken.hasAttribute('data-group-id')){
                var groupId = curToken.getAttribute('data-group-id');
                if(groupsSeen[groupId] === undefined){
                    groupsSeen[groupId] = true;
                    groupsSeenOrdered.push(groupId);
                    count++;
                }
            }

            // We're still in the current content page.
            if(curToken.previousSibling !== null){
                curToken = curToken.previousSibling;

            // We might be at a content page border; move curToken to the end of the 
            // previous page.
            } else if(curToken.parentElement.getAttribute('data-page') !== '0') {
                curToken = curToken.parentElement.previousSibling.lastChild;

            // We've hit the beginning.
            } else {
            break;
            }
        }

        // This section will only be shown if there's at least one entity to list.
        if(count > 0){
            for(i = 0; i < count; i++){
                var groupId = groupsSeenOrdered[i];
                var group = annotationManager.groups[groupId];
                $recentlyMentionedEntitiesChecklist.append(makeEntityModalChecklist(groupId, group.entities, 'reassignMentionEntityRadioOption'));
            }
            $recentlyMentionedEntitiesDiv.show();
        }

        for(groupId in annotationManager.groups){
            var group = annotationManager.groups[groupId];
            $allEntitiesChecklist.append(makeEntityModalChecklist(groupId, group.entities, 'reassignMentionEntityRadioOption'));
        }

        $('#reassignMentionModalOpener').click();
    }

    var confirmReassignMention = function() {
        console.log("In confirmReassignMention");

        var selectedEntity = $("input:radio[name='reassignMentionEntityRadioOption']:checked").val();

        if (selectedEntity === undefined) {
            return;
        }

        var selectedMention = menuConfigData.selectedMentions[menuConfigData.selectedMentions.length-1];

        // updateMention(locationId, {start: start, end: end, entity_id: entityId}, callback);
        annotationManager.updateMention(selectedMention, {
            start: annotation_data.annotation.locations[selectedMention].start,
            end: annotation_data.annotation.locations[selectedMention].end,
            entity_id: selectedEntity
        });

        resetMenuConfigData();
    }

    /**
     * TODO: IN PROGRESS
     * Creates a new entity from the selected text. Extracts the selection from
     * the global `menuConfigData` data member.
     * 
     * @return The selected text (name), token sequence (tokenSequence), and the 
     *         id assigned to it (entityId).
     */
    var addEntityFromSelection = function() {
        console.log("In addEntityFromSelection");
        var $spans, name, tokenSequence;

        closeContextMenu();
        
        // TODO: Do we need this check?
        // if (menuConfigData..length < 1) {
        //     return;
        // }

        name = "";
        tokenSequence = [];


        // TODO: make sure this iteration is properly spanning page boundaries.
        //menuConfigData.$textSpans.each(function(i, elm){
        self.textPanelManager.tokenManager.iterateOverTokens(
            self.textPanelManager.$textPanel, menuConfigData.tokenRange.start,
            menuConfigData.tokenRange.end, function($token, tokenId, isWhitespace){
        
            
            // Reduce whitespace.
            console.log($token);
            name += ($token.text().replace(/\s+/, ' '));

            // Ignore whitespace in the token sequence.
            if(!isWhitespace){
                tokenSequence.push($token.text());
            }
        });
        name = name.trim();
        

        // addEntity(name, startOffset, endOffset, groupID (optional), callback (optional));
        var entityId = annotationManager.addEntity(name, 
            menuConfigData.tokenRange.start, menuConfigData.tokenRange.end, null);

        // TODO: what does this do?
        resetMenuConfigData();

        // TODO:
        //  - clear selection
        //  - update all tokens in range with new entity/group ids
        //     * should probably be a listener for this in text-panel-manager

        console.log('Created entity:', {name: name, tokenSequence: tokenSequence, id: entityId});
        return {name: name, tokenSequence: tokenSequence, id: entityId};
    };

    /**
     * Adds the selected tokens as an entity and marks every sequence of tokens that
     * matches the selected tokens for review. 
     */
    var addEntityFromSelectionAndSuggestMentions = function(){
        entityData = addEntityFromSelection();

        textPanelManager.tokenManager.addToSuggestedMentions(
            textPanelManager.tokenManager.findMentionsOfEntity(
                entityData.token_sequence, entityData.id));
        textPanelManager.tokenManager.reannotatePagesAnnotatedPages();
    };

    /**
     * Adds the selected tokens as an entity annotates every occurrence of them that
     * doesn't overlap with another entity in the text as mentions of the entity. 
     */
    var addEntityFromSelectionAndAnnotateMentions = function(){
        entityData = addEntityFromSelection();

        // TODO
    };

    /**
     * Finds all matches of the selected entity in the text and suggests them as 
     * mentions.
     */
    var suggestMentionsOfSelectedEntity = function(){

    }

    var openAddTieModal = function(e) {
        $(document).trigger('entities.annotation.set-tie-view', {
            textSpans: menuConfigData.textSpans,
            tieObjectOne: menuConfigData.tieObjectOne,
            tieObjectTwo: menuConfigData.tieObjectTwo,
        });
    }

    var highlightTieModalTextArea = function(e) {
        var location = tieModalTextArea.find('[data-location-id=' + $(this).attr('data-location-id') + ']');
        
        if (location.hasClass('selectedEntity') && !location.hasClass('selectedTieObject')) {
            location.removeClass('selectedEntity');
        } else {
            location.addClass('selectedEntity');
        }
    }

    var tieModalObjectChosen = function(e) {
        
        var selection = $(this);

        // var mention = $('#tieModalTextArea').find('[data-location-id=' + selection.attr('data-location-id') + ']');  
        // mention.addClass('selectedTieObject');
        // mention.addClass('selectedEntity');

        if (selection.parent().is('#edit-tieObjectOneSelector')) {
            $(document).trigger('entities.annotation.set-new-tie-modal-dropdown-source', {
                selection: selection,
            });
            // if (menuConfigData.tieObjectOne !== null) {
            //     $('#tieModalTextArea').find('[data-location-id=' + menuConfigData.tieObjectOne.attr('data-location-id') + ']').removeClass('selectedTieObject');
            //     $('#tieModalTextArea').find('[data-location-id=' + menuConfigData.tieObjectOne.attr('data-location-id') + ']').removeClass('selectedEntity');
            //     $('#tieObjectOneSelector').find('[data-location-id=' + menuConfigData.tieObjectOne.attr('data-location-id') + ']')
            //         .removeClass("disabled");
            //     $('#tieObjectTwoSelector').find('[data-location-id=' + menuConfigData.tieObjectOne.attr('data-location-id') + ']')
            //         .removeClass("disabled");
            //     $('#tieObjectOneSelector').find('[data-entity-id=' + menuConfigData.tieObjectOne.attr('data-entity-id') + ']')
            //         .removeClass("disabled");
            // }
            // selection.addClass("disabled");
            // $('#tieObjectTwoSelector').find('[data-location-id=' + selection.attr('data-location-id') + ']').addClass("disabled");
            // menuConfigData.tieObjectOne = selection;
            // console.log(menuConfigData.tieObjectOne);
            // var dropdownText = selection.find('span').html();
            // if (selection.attr('data-entity-id') !== undefined && selection.attr('data-entity-id') !== null) {dropdownText+=" (entity)";}
            // $('#tieObjectOneDropdown').empty().html(dropdownText + ' <span class="caret"></span>');

            // $(document).trigger('entities.tie-modal-source-change', {
            //     source_location_id: selection.attr('data-location-id'),
            //     source_list: $('#tieObjectOneSelector')[0].outerHTML
            // });
        } else {
            $(document).trigger('entities.annotation.set-new-tie-modal-dropdown-target', {
                selection: selection,
            });
            // if (menuConfigData.tieObjectTwo !== null) {
            //     $('#tieModalTextArea').find('[data-location-id=' + menuConfigData.tieObjectTwo.attr('data-location-id') + ']').removeClass('selectedTieObject');
            //     $('#tieModalTextArea').find('[data-location-id=' + menuConfigData.tieObjectTwo.attr('data-location-id') + ']').removeClass('selectedEntity');
            //     $('#tieObjectOneSelector').find('[data-location-id=' + menuConfigData.tieObjectTwo.attr('data-location-id') + ']')
            //         .removeClass("disabled");
            //     $('#tieObjectTwoSelector').find('[data-location-id=' + menuConfigData.tieObjectTwo.attr('data-location-id') + ']')
            //         .removeClass("disabled");  
            //     $('#tieObjectTwoSelector').find('[data-entity-id=' + menuConfigData.tieObjectTwo.attr('data-entity-id') + ']')
            //         .removeClass("disabled");
            // }
            // $('#tieObjectOneSelector').find('[data-location-id=' + selection.attr('data-location-id') + ']').addClass("disabled");
            // selection.addClass("disabled");
            // menuConfigData.tieObjectTwo = selection;
            // var dropdownText = selection.find('span').html();
            // if (selection.attr('data-entity-id') !== undefined && selection.attr('data-entity-id') !== null) {dropdownText+=" (entity)";}
            // $('#tieObjectTwoDropdown').empty().html(dropdownText + ' <span class="caret"></span>');

            // $(document).trigger('entities.tie-modal-target-change', {
            //     target_location_id: selection.attr('data-location-id'),
            //     target_list: $('#tieObjectTwoSelector')[0].outerHTML
            // });
        }
    }

    var confirmAddTie = function() {
        console.log("In confirmAddTie");

        if (menuConfigData.tieObjectOne === null || menuConfigData.tieObjectTwo === null) {
            resetMenuConfigData();
            return;
        }

        const tieNameBox = $('#tieNameBox');
        const weightBox = $('#tieWeightBox');
        const directedToggle = $('#tieDirectedToggle');

        /* tieData {
                start: 10, 
                end: 30, 
                source_entity: {location_id: "10_11"}, 
                target_entity: {entity_id: "5"}, 
                label: "speak",
                weight: 3,
                directed: true
            }
        */
        var tieData = {
            start: parseInt($(menuConfigData.textSpans[0]).attr('data-token')),
            end: parseInt($(menuConfigData.textSpans[menuConfigData.textSpans.length-1]).attr('data-token')),
            source_entity: null,
            target_entity: null,
            label: tieNameBox.val(),
            weight: parseFloat(weightBox.val()),
            directed: directedToggle.is(':checked')
        }

        if (menuConfigData.tieObjectOne.attr('data-location-id') !== null && menuConfigData.tieObjectOne.attr('data-location-id') !== undefined) {
                tieData.source_entity = {location_id: menuConfigData.tieObjectOne.attr('data-location-id')};
        } else {
            tieData.source_entity = {entity_id: menuConfigData.tieObjectOne.attr('data-entity-id')};
        }
        if (menuConfigData.tieObjectTwo.attr('data-location-id') !== null && menuConfigData.tieObjectTwo.attr('data-location-id') !== undefined) {
                tieData.target_entity = {location_id: menuConfigData.tieObjectTwo.attr('data-location-id')};
        } else {
            tieData.target_entity = {entity_id: menuConfigData.tieObjectTwo.attr('data-entity-id')};
        }

        if (tieData.label === "") {
            tieData.label = tieNameBox.attr('placeholder').trim();
        }

        var newTempId = Math.floor(Math.random() * 999999);  // need temp id for graph before added to annotation
        while (Object.keys(annotation_data.annotation.ties).includes(newTempId)) {
            newTempId = Math.floor(Math.random() * 999999);
        }
        tieData.id = newTempId;

        // addTie(tieData, callback)
        const tieObjectOneGroupId = $(`[data-location-id='${menuConfigData.tieObjectOne.attr("data-location-id")}'`).attr("data-group-id");
        const tieObjectOneGroup = annotation_data.annotation.groups[tieObjectOneGroupId];
        tieObjectOneGroup.id = tieObjectOneGroupId;

        const tieObjectTwoGroupId = $(`[data-location-id='${menuConfigData.tieObjectTwo.attr("data-location-id")}'`).attr("data-group-id");
        const tieObjectTwoGroup = annotation_data.annotation.groups[tieObjectTwoGroupId];
        tieObjectTwoGroup.id = tieObjectTwoGroupId;

        editTieNetworkViz.addGroup(tieObjectOneGroup, true);
        editTieNetworkViz.addGroup(tieObjectTwoGroup, true);
        editTieNetworkViz.addTie(tieData, true);

        resetMenuConfigData();
    }

    var openEditTieModal = function(e) {
        var tieRefs = $(this).attr('tie-refs').trim().split(" ");
        var ties = [];
        
        tieRefs.forEach((tieRef) => {
            ties.push(annotation_data.annotation.ties[tieRef]);
        });

        $(document).trigger('entities.annotation.set-tie-view', {
            tieRefs: tieRefs,
            ties: ties,
        });

        // tieModalTextArea = $('#edit-tieModalTextArea');
        // tieNameBox = $('#edit-tieNameBox');
        // tieWeightBox = $('#edit-tieWeightBox');
        // tieDirectedToggle = $('#edit-tieDirectedToggle');

        // const tokenContext = tokenNavigator.getTokenContext($(`[data-token='${parseInt((parseInt(ties[0].start) + parseInt(ties[0].end)) / 2)}']`), 100);

        // tieModalTextArea.empty();
        // tokenContext.forEach((token) => {
        //     let clone = token.clone();
        //     if (token.hasClass("tie-text")) {
        //         // make tie text distinct from other ties in context
        //         clone.css('color', '#ff2d50');
        //         clone.css('text-decoration', 'none');
        //         clone.css('font-weight', 'bold');
        //     }
        //     tieModalTextArea.append(clone);
        // })


        // const $dropdown = $("#edit-addEntityToNetworkDropdownMenu");
        // console.log($dropdown);
        // Object.keys(annotation_data.annotation.groups).map((groupId, i) => {
        //     $dropdown.append(`<li><a id="edit-addEntityToNetworkDropdownItem" group=${groupId} class="dropdown-item" href="#">${annotation_data.annotation.groups[groupId].name}</a></li>`);
        // });

        // $('#editTieModal').one('shown.bs.modal', () => {
        //     editTieNetworkViz = NetworkVisualizer();
        //     editTieNetworkViz.init("#edit-tie-network-svg");

        //     editTieNetworkViz.loadTieNetwork(Object.keys(annotation_data.annotation.ties)
        //         .filter(key => tieRefs.includes(key))
        //         .reduce((obj, key) => {
        //             obj[key] = annotation_data.annotation.ties[key];
        //             return obj;
        //         }, {}), annotation_data.annotation);

        //     editTieNetworkViz.setAnnotationBlock(annotationManager, ties[0].start, ties[0].end);        
        //   })

        // $('#confirmEditTie').attr("tie-ref", $(this).attr('tie-ref'));
        // $('#editTieModalOpener').click();
    }

    var addAliasGroupToNetwork = function(e) {
            const groupId = e.target.getAttribute("group");
            const group = annotation_data.annotation.groups[groupId];
            group.id = groupId;

            editTieNetworkViz.addGroup(group, true);
    }

    var confirmEditTieAdjustTie = function(e) {
        if (editTieNetworkViz == undefined) { return; }

        editTieNetworkViz.adjustSelectedTie({
            label: tieNameBox.val(),
            weight: parseFloat($('#edit-tieWeightBox').val()),
            directed: $('#edit-tieDirectedToggle').is(':checked')
        });

        $(document).trigger('entities.annotation.edit-tie-selected-changed', {
            tie: undefined
        });
    }

    var confirmEditTie = function(e) {
        console.log("In confirmEditTie");

        // var tie = annotation_data.annotation.ties[$(this).attr('tie-ref')];

        // /* tieData {
        //         start: 10, 
        //         end: 30, 
        //         source_entity: {location_id: "10_11"}, 
        //         target_entity: {entity_id: "5"}, 
        //         label: "speak",
        //         weight: 3,
        //         directed: true
        //     }
        // */
        // var tieData = {
        //     start: tie.start,
        //     end: tie.end,
        //     source_entity: tie.source_entity,
        //     target_entity: tie.target_entity,
        //     label: $('#edit-tieNameBox').val(),
        //     weight: parseFloat($('#edit-tieWeightBox').val()),
        //     directed: $('#edit-tieDirectedToggle').is(':checked')
        // }

        // addTie(tieData, callback)
        // annotationManager.updateTie($(this).attr('tie-ref'), tieData);

        editTieNetworkViz.annotation_confirmChanges();

        resetMenuConfigData();
    }

    var deleteSelectedTie = function(e) {
        console.log("In deleteSelectedTie");
        closeContextMenu();

        // removeTie(TieID, callback);
        console.log($(this).attr('tie-ref'));
        annotationManager.removeTie($(this).attr('tie-ref'));

        resetMenuConfigData();
    }

    var combineSelectedEntities = function() {
        console.log("In combineSelectedEntities");

        resetMenuConfigData();
    }

    var combineSelectedGroups = function() {
        console.log("In combineSelectedGroups");

        if (menuConfigData.selectedGroups.length < 2) {
            return;
        }

        var entities = [];
        menuConfigData.selectedGroups.forEach(g => {
            Object.keys(annotation_data.annotation.groups[g].entities).forEach(e => {
                entities.push(e);
            });
        });

        annotationManager.moveEntitiesToGroup(entities, menuConfigData.selectedGroups.pop());

        resetMenuConfigData();
    }

    var deleteSelectedMention = function() {
        console.log("In deleteSelectedMention");

        annotationManager.removeMention(menuConfigData.selectedMentions[menuConfigData.selectedMentions.length-1]);

        resetMenuConfigData();
    }

    var deleteSelectedEntity = function() {
        console.log("In deleteSelectedEntity");

        var entityId = annotationManager.removeEntity(menuConfigData.recentSelectedEntityId);
        
        resetMenuConfigData();
    }

    var deleteSelectedEntities = function() {
        console.log("in deleteSelectedEntities");

        // Get entity ids without the "ID-1" or "ID-2"
        //////////
        // TEMPORARY
        //////////

        menuConfigData.selectedEntities.forEach(s => {
            if (s.includes('-')) {
                s = s.match(/.+?(?=-)/)[0];
            }        
            s = Number(s);
        });

        var entityId = annotationManager.removeEntities(menuConfigData.selectedEntities);

        resetMenuConfigData();
    }

    var deleteSelectedGroup = function() {
        console.log("In deleteSelectedGroup");

        // removeEntities(entityIds, callback);
        // annotationManager.removeEntities(Object.keys(annotation_data.annotation.groups[$(menuConfigData.recentSelectedEntity).attr('data-group-id')].entities), null);

        // removeGroup(groupId, callback);
        annotationManager.removeGroup($(menuConfigData.recentSelectedEntity).attr('data-group-id'));

        resetMenuConfigData();
    }

    var deleteSelectedGroups = function() {
        console.log("In deleteSelectedGroups");

        // removeGroups(groupIds, callback);
        annotationManager.removeGroups(menuConfigData.selectedGroups);

        resetMenuConfigData();
    }

    var groupSelectedEntities = function() {
        console.log("In groupSelectedEntities");

        // groupEntities(entityIds, callback);
        console.log(menuConfigData.selectedEntities);
        annotationManager.groupEntities(menuConfigData.selectedEntities);

        resetMenuConfigData();
    }

    var openGroupSelectorModal = function() {
        $('#groupSelectorChecklist').empty();

        var groupRadios = "";
        for(groupId in annotationManager.groups){
            var list = `<li class="group unselectable" data-id="${groupId}">`;
            list += `<div class="pretty p-default p-round p-smooth"><input type="radio" name="groupChoices" class="group-checkbox" data-id="${groupId}" value="${groupId}"><div class="state p-primary"><label><span class="g${groupId} unselectable">${annotationManager.groups[groupId].name}</span></label></div></div>`;
            list += '</li>';

            groupRadios += list;
        }

        $('#groupSelectorChecklist').append(groupRadios);
        $('#groupSelectorModalOpener').click();
    }

    var confirmMoveEntityToGroup = function() {
        console.log("In confirmMoveEntityToGroup");

        var selectedGroup = $("input:radio[name='groupChoices']:checked").val();

        if (selectedGroup === undefined) {
            return;
        }

        // moveEntityToGroup(entityId, groupId, callback);
        annotationManager.moveEntityToGroup(menuConfigData.recentSelectedEntityId, selectedGroup);

        resetMenuConfigData();
    }

    var openGroupNameChangeModal = function() {
        $('#changeGroupnameModalOpener').click();
    }

    var confirmGroupNameChange = function() {
        console.log("In confirmGroupNameChange");

        // changeGroupName(groupId, name, callback);
        annotationManager.changeGroupName($(menuConfigData.recentSelectedEntity).attr('data-group-id'), $('#newGroupNameBox').val());

        resetMenuConfigData();
    }

    // TODO: What is the purpose of this function?
    var resetMenuConfigData = function() {
        // deselect every entity in text and checklist
        menuConfigData.selectedEntities.forEach(function(entity) {
            $('[data-entity-id="' + entity + '"]').removeClass('selectedEntity');
            $('.group-checkbox').prop('checked', false);
        });

        menuConfigData = {
            textSpans: null,
            newGroupId: null,
            selectedMentions: [],
            recentSelectedEntityId: null,
            recentSelectedEntity: null,
            selectedEntities: [],
            numSelectedEntities: 0,
            selectedGroups: [],
            numSelectedGroups: 0,
            tieObjectOne: null,
            tieObjectTwo: null
        };

        updateSelectionInfoBox();
    }

    /**
     * Adds listeners for events on tokens and menu clicks in the text panel.
     */
    var addListeners = function(){

        // TODO: clean this up.
        $(document).on('click', '#text-panel > .content-page > .annotated-entity', existingEntityClicked);
        $textPanel.on('text-panel.token-selection', checkSelectedText);

        $(document).on('click', '#resetSelectionButton', function() {
            resetMenuConfigData();
            closeContextMenu();
        });
        
        // Close Context menu on click
        $(document).on('click', closeContextMenu);
        // Close context menu with escape key
        $(document).keyup(function(e) { if (e.keyCode == 27) closeContextMenu();})
        // Close context menu when window is resized
        $(window).on('resize', closeContextMenu);
        // Close context menu on text on scroll
        $("span").scroll(function() {
            deselectAllText();
            closeContextMenu();
        });
        $("div").scroll(function() {
            deselectAllText();
            closeContextMenu();
        });

        var $document = $(document);

        // Context Menu Options
        $textPanel.on('click', '.add-mention', openAddMentionModal);
        $textPanel.on('click', '#confirmAddMention', confirmAddMention);
        $textPanel.on('click', '.reassignMentionOption', openReassignMentionModal);
        $textPanel.on('click', '#confirmReassignMention', confirmReassignMention);
        $textPanel.on('click', '.deleteMentionOption', deleteSelectedMention);

        $document.on('click', '.text-panel-menu .add-entity', addEntityFromSelection); // TODO: Wokring on
        $textPanel.on('click', '.addEntitySuggestMentionsOption', addEntityFromSelectionAndSuggestMentions);
        $textPanel.on('click', '.addEntityAnnotateMentionsOption', addEntityFromSelectionAndAnnotateMentions);
        $textPanel.on('click', '.deleteEntityOption', deleteSelectedEntity);
        $textPanel.on('click', '.deletedSelectedEntitiesOption', deleteSelectedEntities);
        
        $textPanel.on('click', '.deleteGroupOption', deleteSelectedGroup);
        $textPanel.on('click', '.deleteSelectedGroupsOption', deleteSelectedGroups);
        $textPanel.on('click', '.groupEntitiesOption', groupSelectedEntities);
        $textPanel.on('click', '.combineSelectedGroupsOption', combineSelectedGroups);
        $textPanel.on('click', '.changeGroupNameOption', openGroupNameChangeModal);
        $textPanel.on('click', '#confirmGroupNameChange', confirmGroupNameChange);
        $textPanel.on('click', '.moveEntityToGroupOption', openGroupSelectorModal)
        $textPanel.on('click', '#confirmGroupSelect', confirmMoveEntityToGroup)

        $textPanel.on('click', '.add-tie', openAddTieModal);
        $textPanel.on('click', '#edit-addTieBtn', confirmAddTie);
        $textPanel.on('click', '.editTieOption', openEditTieModal);
        $textPanel.on('click', '#confirmEditTie', confirmEditTie);
        $textPanel.on('click', '#edit-adjustTieBtn', confirmEditTieAdjustTie);
        $textPanel.on('click', '.deleteTieOption', deleteSelectedTie)
        $textPanel.on('click', '.tie-text', openTieContextMenu)
        $textPanel.on('click', '.tie-object', tieModalObjectChosen)
        $textPanel.on('mouseenter', '.tie-object', highlightTieModalTextArea)
        $textPanel.on('mouseleave', '.tie-object', highlightTieModalTextArea)

        $textPanel.on("click", "#edit-addEntityToNetworkDropdownItem", (e) => addAliasGroupToNetwork);

        $textPanel.on('mouseenter', '.thisMentionHover', startHoverMenuTimer);
        $textPanel.on('mouseenter', '.thisMentionHover', startHoverMenuTimer);
        $textPanel.on('mouseenter', '.thisEntityHover', startHoverMenuTimer);
        $textPanel.on('mouseenter', '.thisGroupHover', startHoverMenuTimer);
        $textPanel.on('mouseenter', '.selectedHover', startHoverMenuTimer);
        $textPanel.on('mouseenter', '.tieHover', startHoverMenuTimer);
        $textPanel.on('mouseleave', '.thisMentionHover', clearHoverMenuTimer);
        $textPanel.on('mouseleave', '.thisMentionHover', clearHoverMenuTimer);
        $textPanel.on('mouseleave', '.thisEntityHover', clearHoverMenuTimer);
        $textPanel.on('mouseleave', '.thisGroupHover', clearHoverMenuTimer);
        $textPanel.on('mouseleave', '.selectedHover', clearHoverMenuTimer);
        $textPanel.on('mouseleave', '.tieHover', clearHoverMenuTimer);

        $textPanel.on('click', '#graph-export-tsv', exportAsTSV);
        $textPanel.on('click', '#graph-export-graphml', exportAsGraphML);
        $textPanel.on('click', '#graph-export-png', exportAsPNG);
        $textPanel.on('click', '#graph-export-svg', exportAsSVG);

    };

    /**
     * Initializes the instance, including adding listeners.
     */
    var initialize = function(){
        $textPanel = self.textPanelManager.$textPanel;
        // Menu templates.
        $selectionMenu = $('#text-panel-selection-menu')

        addListeners();
    };

    initialize();

    return self;
};