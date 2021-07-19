// File: entities-panel.js
// Author: Hank Feild
// Date: 2021-05-29
// Purpose: Provides functions for interacting with the entities panel on an
//          annotation page.

/**
 * Manages the entity panel that appears on the side of an annotation page.
 * Users can group entity aliases, move them around, edit group names, etc.
 * 
 * All interactions with the entity panel should be performed via this class
 * (e.g., initial population of entities or actions stemming from the text or
 * network panels).
 * 
 * @param _annotationManager An instance of AnnotationManager; this is used to
 *                          access details of the annotation.
 */
var EntitiesPanelManager = function(annotationManager){
    var self = {

    };
    var $entitiesPanel = $('#entities-panel');
    var $aliasGroups = $('#alias-groups');
    var $aliasGroupTemplate = $entitiesPanel.find('.templates .alias-group');
    var $entityTemplate = $entitiesPanel.find('.templates .entity');
    var droppableSettings, draggableSettings, selectableSettings;
    var $aliasGroupEditMenu = $('#entities-panel-alias-group-edit-menu');
    var $aliasEditMenu = $('#entities-panel-alias-edit-menu');

    /**
     * Adds all of the alias groups in the given annotation to the entities
     * pane.
     */
    self.addAliasGroupsFromAnnotation = function(){
        // console.log('Entering EntitiesPanel.addAliasGroupsFromAnnotation');
        var groupId;
        for(groupId in annotationManager.groups){
            var group = annotationManager.groups[groupId];
            self.addAliasGroup(group.name, groupId, group.entities);
        }

        populateMenus();
    };

    /**
     * Adds a new alias group entry to the entities panel along with any
     * corresponding entities.
     * 
     * @param {string} groupName The name of the alias group.
     * @param {string} groupId The id of the alias group.
     * @param {Object} entities A map of entity ids to entity entries that make
     *                          up the alias group.
     */
    self.addAliasGroup = function(groupName, groupId, entities){
        var i, entityId;
        var $aliasGroup = $aliasGroupTemplate.clone();
        $aliasGroups.append($aliasGroup);
        $aliasGroup.find('.name').html(groupName);
        $aliasGroup.attr('data-id', groupId);
        $aliasGroup.find('.name-wrapper').addClass(`g${groupId}`);
        for(entityId in entities){
            self.addEntity($aliasGroup, entities[entityId].name, entityId);
        }
        $aliasGroup.droppable(droppableSettings);
        // $aliasGroup.find('.aliases').selectable(selectableSettings);

    };

    /**
     * Adds a new entity to the given alias group UI element.
     *          
     * @param $aliasGroup The jQuery element for the alias group to which the
     *                    entity belongs.
     * @param {jQuery} entityName The name of the entity.
     * @param {string} entityName The name of the entity.
     * @param {string} entityId The id of the entity.
     */
    self.addEntity = function($aliasGroup, entityName, entityId){
        var $entity = $entityTemplate.clone();
        $aliasGroup.find('.aliases').append($entity);
        $entity.attr('data-id', entityId);
        $entity.find('.name').html(entityName);
        $entity.draggable(draggableSettings);
    };

    /**
     * Triggered when an entity is added to the annotation
     * manager.
     * 
     * @param {Event} event The DOM event. 
     * @param {Object} data Should include the fields: id, groupId.
     */
    var onEntityAddedToAnnotation = function(event, data){
        console.log('in onEntityAddedToAnnotation', data);
        var entity = annotationManager.entities[data.id];
        self.addEntity($entitiesPanel.find(
            `.alias-group[data-id=${entity.group_id}]`), entity.name, data.id);
    };

    /**
     * Triggered when an entity is added to the annotation
     * manager.
     * 
     * @param {Event} event The DOM event. 
     * @param {Object} data Should include the fields: id, name.
     */
    var onAliasGroupAddedToAnnotation = function(event, data){
        console.log('in onAliasGroupAddedToAnnotation', data);
        var aliasGroup = annotationManager.groups[data.id];
        self.addAliasGroup(aliasGroup.name, data.id, []);
    };

    /**
     * Styles an entity that is being dragged (the original entity, not the
     * helper).
     * 
     * @param {Event} The DON event associated with the drop.
     * @param {Object} Contains info and properties about the element being 
     *                 dragged.
     */
    var onEntityStartDrag = function(event, ui){
        ui.helper.addClass('clone-being-dragged');
    };

    /**
     * Un-styles an entity that is finished being dragged (the original entity,
     * not the helper).
     *
     * @param {Event} The DON event associated with the drop.
     * @param {Object} Contains info and properties about the element being
     * dragged.
     */
    var onEntityStopDrag = function(event, ui){
        ui.helper.removeClass('clone-being-dragged');
    };


    /**
     * Moves an entity to the alias group it was dropped on.
     * 
     * @param {Event} The DOM event associated with the drop.
     * @param {Object} Contains info and properties about the source and target
     *                 of the drop.
     */
    var onEntitiesDropped = function(event, ui){
        var $aliasGroup = $(this);
        var entityIds = [];
        $entitiesPanel.find('.entity.ui-selected').not('.clone-being-dragged').each(function(i,entityDOM){
            var $entity = $(entityDOM);
            var $sourceAliasGroup = $entity.parents('.alias-group');
            
            if($entity.parents('.alias-group')[0] != $aliasGroup[0]){
                entityIds.push($entity.attr('data-id'));
                $entity.appendTo($aliasGroup.find('.aliases'));

                // Remove source alias group if it's now empty.
                if($sourceAliasGroup.find('.entity').length === 0){
                    $sourceAliasGroup.remove();
                    $(`.entities-panel-menu li[data-id=${$sourceAliasGroup.attr('data-id')}]`).remove();
                }
            }
        });
        console.log('Moving ', entityIds, 'to group',  $aliasGroup.attr('data-id'));
        $aliasGroup.removeClass('droppable-hover');        
        annotationManager.moveEntitiesToGroup(entityIds, $aliasGroup.attr('data-id'));
    };

    /**
     * Moves an entity or set of entities to the alias group that was selected
     * in one of the entity panel menus.
     * 
     * @param {Event} The DOM event associated with the menu click.
     */
    var onEntitiesMovedViaMenu = function(event, ui){
        var $menu = $(this).parents('.entities-panel-menu');
        var destAliasGroupId = $(this).attr('data-id');
        var $destAliasGroup = $entitiesPanel.find(`.alias-group[data-id=${destAliasGroupId}]`);
        var $destAliases = $destAliasGroup.find('.aliases');
        var $sourceAliasGroup;
        var entitiesToMove, entityIds = [];
        var i;

        // Case 1: select all the entities of the alias group associated with
        // the menu.
        if($menu.attr('id') == 'entities-panel-alias-group-edit-menu'){
            $sourceAliasGroup = $entitiesPanel.find(`.alias-group[data-id=${$menu.attr('data-id')}]`);
            entitiesToMove = $sourceAliasGroup.find('.entity');

        // Case 2: select just the entity associated with the menu.
        } else {
            var $entityToMove = [$entitiesPanel.find(`.entity[data-id=${$menu.attr('data-id')}]`)];
            $sourceAliasGroup = $entityToMove.parents('.alias-group');
            entitiesToMove = [$entityToMove[0]];
        }

        // Stop if the destination and source are the same.
        if($destAliasGroup == $sourceAliasGroup){
            return;
        }

        // Move all of the DOM elements in the entity panel.
        for(i = 0; i < entitiesToMove.length; i++){
            let $entity = $(entitiesToMove[i]);
            console.log($entity, i, entitiesToMove)
            
            entityIds.push($entity.attr('data-id'));
            $entity.appendTo($destAliases);

            // Remove source alias group if it's now empty.
            if($sourceAliasGroup.find('.entity').length === 0){
                $sourceAliasGroup.remove();
                $(`.entities-panel-menu li[data-id=${$sourceAliasGroup.attr('data-id')}]`).remove();
            }
        };
        console.log('Moving ', entityIds, 'to group',  destAliasGroupId);
        annotationManager.moveEntitiesToGroup(entityIds, destAliasGroupId);
    };



    /**
     * Highlights an alias group when an entity is dragged over it.
     * 
     * @param {Event} The DON event associated with the drop.
     * @param {Object} Contains info and properties about the source and target
     *                 of the drop.
     */
    var onEntityDraggedOverAliasGroup = function(event, ui){
        $(this).addClass('droppable-hover');
    };

    /**
     * Removes highlighting from an alias group when an entity is dragged out 
     * of it.
     * 
     * @param {Event} The DON event associated with the drop.
     * @param {Object} Contains info and properties about the source and target
     *                 of the drop.
     */
    var onEntityDraggedOutOfAliasGroup = function(event, ui){
        $(this).removeClass('droppable-hover');
    };

    /**
     * Shows the name edit form field.
     * 
     * @param {DOM Event} The event that triggered this callback.
     */
    var showNameEditor = function(event){
        console.log('In showNameEditor');

        var $menu = $(this).parents('.entities-panel-menu');
        var id = $menu.attr('data-id');

        // Find the group/alias that this corresponds to.
        var $nameWrapper;
        if($menu.attr('id') == 'entities-panel-alias-group-edit-menu'){
            $nameWrapper = $entitiesPanel.find(
                `.alias-group[data-id=${id}] .alias-group-name-wrapper`);
        } else {
            $nameWrapper = $entitiesPanel.find(`.entity[data-id=${id}]`);
        }

        var $name = $nameWrapper.find('.name');
        var $nameEditor = $nameWrapper.find('.name-edit');
        $nameEditor.find('input[name=name]').val($name.text());
        $nameEditor.removeClass('hidden');  
        $name.hide();
        $nameEditor.show();
    };

    /**
     * Saves edits made to an entity or alias group.
     * 
     * @param {DOM Event} The event that triggered this callback.
     */
    var saveNameEdits = function(event){
        event.preventDefault();

        var $nameWrapper = $(this).parents('.name-wrapper');
        var $name = $nameWrapper.find('.name');
        var $nameEditor = $nameWrapper.find('.name-edit');
        var newName = cleanHTML($nameEditor.find('input[name=name]').val());
        $name.html(newName);
        

        // Alias group name change.
        if($nameWrapper.hasClass('alias-group-name-wrapper')){
            var aliasGroupId = $nameWrapper.parents('.alias-group').attr('data-id');
            annotationManager.changeGroupName(aliasGroupId, newName);

            // Update in menus.
            $(`.entities-panel-menu li[data-id=${aliasGroupId}]`).html(newName);

            // TODO -- add error handling.

        // Entity name change.
        } else {
            var entityId = $nameWrapper.attr('data-id');
            annotationManager.updateEntity(entityId, {name: newName});

            // TODO -- add error handling.
        }

        $name.show();
        $nameEditor.hide();

        
    };

    /**
     * Populates the list of 'all-entities' in the given entities panel menu if 
     * $menu is specified, or both the alias group and alias menus otherwise.
     * 
     * @param {jQuery} menu The menu to populate (optional).
     */
    var populateMenus = function($menu){
        if($menu === undefined){
            populateMenus($aliasEditMenu);
            populateMenus($aliasGroupEditMenu);
            return;
        }

        var $itemTemplate = $menu.find('.templates .alias-group');
        var groupId;
        var $allEntitiesList = $menu.find('.all-entities ul')

        // Clear the list.
        $allEntitiesList.html('');

        // Add each of the groups.
        for(groupId in annotationManager.groups){
            let group = annotationManager.groups[groupId];
            let $groupListItem = $itemTemplate.clone();
            $groupListItem.html(group.name);
            $allEntitiesList.append($groupListItem);
            $groupListItem.attr('data-id', groupId);
            // $groupListItem.addClass(`g${groupId}`);
        }

    };

    /**
     * Displays the entity or alias options menu (two different menus). 
     * Populates the suggested entities and full list of entities if stale.
     */
    var showMenu = function(event){
        // Close any existing menus.
        $aliasEditMenu.addClass('hidden');
        $aliasGroupEditMenu.addClass('hidden');

        // Determine if this is an entity or alias menu.
        var isAliasGroup = $(this).hasClass('alias-group-options');
        var id, $menu, menuHangDistance;
        if(isAliasGroup){
            id = $(this).parents('.alias-group').attr('data-id');
            $menu = $aliasGroupEditMenu;
        } else {
            id = $(this).parents('.entity').attr('data-id');
            $menu = $aliasEditMenu;
        }       

        // Populate suggested (different based on whether this is an entity or
        // alias).
        $menu.find('.top-suggestions ul').html('');

        // Change the data to point to the correct entity or alias.
        $menu.attr('data-id', id);
        
        // Show the menu.
        $menu.removeClass('hidden');

        // Move to the correct spot relative to the mouse (just to the right; 
        // higher if not enough room below).
        // If the height of the menu goes below the page fold, raise it up by
        // the difference. Otherwise, leave it where the mouse is.
        menuHangDistance = event.originalEvent.pageY + $menu.height() - 
            $('body').height();
        if(menuHangDistance > 0){
            $menu.css({
                left: event.originalEvent.pageX, 
                top: event.originalEvent.pageY-menuHangDistance
            });
        } else {
            $menu.css({
                left: event.originalEvent.pageX, 
                top: event.originalEvent.pageY
            });
        }

    };

    /**
     * Hides the alias/alias group edit menus on clicks.
     */
    var hideMenu = function(event){
        if($(event.target).parents('.options').length == 0){
            $aliasEditMenu.addClass('hidden');
            $aliasGroupEditMenu.addClass('hidden');
        }
    };


    /**
     * Adds listeners to UI elements in the entities panel, e.g., selecting
     * entities, editing entity and alias group names, etc.
     */
    var addListeners = function(){
        // Listen for entity selections.
        $entitiesPanel.on('mousedown', function(event){
            var $target = $(event.target);
            var $entity = $target.parents('.entity');

            if($entity.length > 0){
                console.log('Clicked on entity sub-tree');
                if($target.hasClass('name')){
                    console.log('Clicked in "name" field entity');

                    if(!$entity.hasClass('ui-selected') && !event.ctrlKey){
                        $entitiesPanel.find('.entity').removeClass('ui-selected');
                    }

                    $entity.addClass('ui-selected');
                }
            } else {
                console.log('clicked on something else.');
                $entitiesPanel.find('.entity').removeClass('ui-selected');
            }
        });


        // Listen for renaming clicks.
        $(document).on('click', '.entities-panel-menu .rename-option', showNameEditor);
        // $entitiesPanel.on('click', '.submit-name-edit', saveNameEdits);
        $entitiesPanel.on('submit', '.name-edit', saveNameEdits);

        $entitiesPanel.on('click', '.options', showMenu);
        $(document).on('click', hideMenu);

        $(document).on('click', '.entities-panel-menu .alias-group', 
                onEntitiesMovedViaMenu);

        $(document).on('entities.annotation.group-added', onAliasGroupAddedToAnnotation);
        $(document).on('entities.annotation.entity-added', onEntityAddedToAnnotation);
    };

    // Initialize settings (needed to wait for functions to be defined).
    droppableSettings = {
        drop: onEntitiesDropped,
        over: onEntityDraggedOverAliasGroup,
        out: onEntityDraggedOutOfAliasGroup
    };

    draggableSettings = {
        revert: 'invalid',
        helper: 'clone',
        appendTo: $entitiesPanel,
        cursor: 'grabbing',
        handle: '.name',
        start: onEntityStartDrag,
        stop: onEntityStopDrag
    };

    selectableSettings = {
        filter: '.entity'
    };


    addListeners();

    return self;
};






// Old stuff.

var displayAnnotation = function(){
    // Clear the annotation list.
    // $('#annotation-list').html('');
    console.log("In displayAnnotation");

    var charListOuterElm = $('#entity-list');
    var charListElm = $('<ul class="groups">');
    charListOuterElm.html(
        '<button id="group-selected">Group selected</button> ');
    charListOuterElm.append(charListElm);


    for(groupId in annotationManager.groups){
        var group = annotationManager.groups[groupId];
        charListElm.append(makeGroupChecklist(groupId, group.entities));
    }
};

var addEntityToGroupChecklist = function($entitiesList, entityId, entity){
    return $entitiesList.append('<div class="pretty p-icon p-square p-jelly">'+
        '<input type="checkbox" class="group-checkbox" '+
        `data-id="${entityId}"><div class="state p-primary">`+ 
        '<i class="icon mdi mdi-check"></i><label>'+ 
        `<span class="g${entity.group_id} unselectable">`+ 
        `${entity.name}</span></label></div></div>`);
}

var makeGroupChecklist = function(groupId, entities){
    var $listItem = $(`<li class="group unselectable" data-id="${groupId}">`),
        $entitiesList = $('<span class="entities">'),
        entityId, i, entitiesSize = size(entities);

    $listItem.append($entitiesList);
    for(entityId in entities){
        addEntityToGroupChecklist($entitiesList, entityId, entities[entityId]);
        if(i < entitiesSize-1){
            $entitiesList.append(', ')
        }
        i++;
    }
    if(entitiesSize > 1){
        $listItem.append('<button class="select-all">[de]select all</button>');
    }
    return $listItem;
};

var groupSelected = function(){
    //var selectedCheckboxes = 
    var entityIds = []
    
    $('.groups input:checked').each(function(i, elm){
        entityIds.push($(this).data('id'));
    });
    
    annotationManager.groupEntities(entityIds);

    displayAnnotation();
};

var selectAllInGroup = function(){
    if($(this).parents('.group').find('input:checked').length > 0){
        $(this).parents('.group').find('input').prop('checked', false);
    } else {
        $(this).parents('.group').find('input').prop('checked', true);
    }
};
