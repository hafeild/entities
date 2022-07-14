// File: entities-panel-manager.js
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
    var aliasGroupEditMenuManager = EntityMenuManager(annotationManager, $aliasGroupEditMenu);
    var aliasEditMenuManager = EntityMenuManager(annotationManager, $aliasEditMenu);

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
        var entity = annotationManager.entities[data.id];
        self.addEntity($entitiesPanel.find(
            `.alias-group[data-id=${entity.group_id}]`), entity.name, data.id);
    };

    /**
     * Triggered when an entity is added to the annotation manager.
     * 
     * @param {Event} event The DOM event. 
     * @param {Object} data Should include the fields: id, name.
     */
    var onAliasGroupAddedToAnnotation = function(event, data){
        var aliasGroup = annotationManager.groups[data.id];
        self.addAliasGroup(aliasGroup.name, data.id, []);
    };

    /**
     * Moves an entity to another group.
     * 
     * @param {Event} event The DOM event. 
     * @param {Object} data Should include the fields: id (entity), oldGroupId, 
     *                      newGroupId
     */
    var onEntityMovedInAnnotation = function(event, data){
        var $entity =  $entitiesPanel.find(`.entity[data-id=${data.id}]`);
        var $aliasList = $entitiesPanel.find(`.alias-group[data-id=${data.newGroupId}] .aliases`);

        if($entity.length > 0){
            $entity.appendTo($aliasList);
        } else {
            self.addEntity($aliasList.parents('.alias-group'), 
                annotationManager.entities[data.id].name, data.id);
        }
    };

    /**
     * Removes an alias group from the entities panel.
     * 
     * @param {Event} event The DOM event. 
     * @param {Object} data Should include the fields: id
     */
    var onAliasGroupRemovedFromAnnotation = function(event, data){
        $entitiesPanel.find(`.alias-group[data-id=${data.id}]`).remove();
    };

    /**
     * Removes an entity from the entities panel and menus.
     * 
     * @param {Event} event The DOM event. 
     * @param {Object} data Should include the fields: id, groupId
     */
    var onEntityRemovedFromAnnotation = function(event, data){
        $entitiesPanel.find(`.entity[data-id=${data.id}]`).remove();
    };

    /**
     * Changes an entity's name in the entities panel.
     * 
     * @param {Event} event The DOM event. 
     * @param {Object} data Should include the fields: id, name (new)
     */
    var onEntityRenamedInAnnotation = function(event, data){
        var $name = $entitiesPanel.find(`.entity[data-id=${data.id}] .name`);
        $name.html(data.name);
    };

    /**
     * Changes an alias group's name in the entities panel.
     * 
     * @param {Event} event The DOM event. 
     * @param {Object} data Should include the fields: id, name (new)
     */
    var onAliasGroupRenamedInAnnotation = function(event, data){
        // Rename in panel.
        var $name = $entitiesPanel.find(
            `.alias-group[data-id=${data.id}] .alias-group-name-wrapper .name`);
        $name.html(data.name);
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
            
            if($entity.parents('.alias-group')[0] != $aliasGroup[0]){
                entityIds.push($entity.attr('data-id'));
            }
        });
        $aliasGroup.removeClass('droppable-hover');        
        annotationManager.moveEntitiesToGroup(entityIds, $aliasGroup.attr('data-id'));
    };

    /**
     * Moves an entity or set of entities in the alias group that was selected
     * in one of the entity panel menus.
     * 
     * @param {Event} The DOM event associated with the menu click.
     */
    var onEntitiesMovedViaMenu = function(event){
        var $menu = $(this).parents('.entities-panel-menu');
        var destAliasGroupId = $(this).attr('data-id');
        var $sourceAliasGroup;
        var entityIds = [];

        // Case 1: select all the entities of the alias group associated with
        // the menu.
        if($menu.attr('id') == 'entities-panel-alias-group-edit-menu'){
            $sourceAliasGroup = $entitiesPanel.find(`.alias-group[data-id=${$menu.attr('data-id')}]`);
            entityIds = $sourceAliasGroup.find('.entity').map(function(i, elm){
                return elm.getAttribute('data-id');
            }).get();

        // Case 2: select the selected entities associated with the menu.
        } else {
            
            entityIds = $entitiesPanel.find('.entity.ui-selected').map(function(i, elm){
                return elm.getAttribute('data-id');
            }).get();
        }

        annotationManager.moveEntitiesToGroup(entityIds, destAliasGroupId);
    };

    /**
     * Deletes an entity or set of entities in the alias group that was selected
     * in one of the entity panel menus.
     * 
     * @param {Event} The DOM event associated with the menu click.
     */
    var onDeleteViaMenu = function(event){
        var $menu = $(this).parents('.entities-panel-menu');
        var entityIds = [];

        // Case 1: select all the entities of the alias group associated with
        // the menu.
        if($menu.attr('id') == 'entities-panel-alias-group-edit-menu'){
            var $sourceAliasGroup = $entitiesPanel.find(`.alias-group[data-id=${$menu.attr('data-id')}]`);
            entityIds = $sourceAliasGroup.find('.entity').map(function(i, elm){
                return elm.getAttribute('data-id');
            }).get();

        // Case 2: select the selected entities associated with the menu.
        } else {
            
            entityIds = $entitiesPanel.find('.entity.ui-selected').map(function(i, elm){
                return elm.getAttribute('data-id');
            }).get();
        }

        annotationManager.removeEntities(entityIds);
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
     * Adds a new entity.
     */
    var onAddCustomEntity = function(event){
        var name = cleanHTML($('#new-entity-name').val());
        annotationManager.addEntity(name, undefined, undefined, undefined, 
            function(){
                $('#new-entity-name').val('');
                $entitiesPanel.find('#alias-groups .alias-group').last().prependTo($entitiesPanel.find('#alias-groups'));
            });

        event.stopPropagation();
        event.preventDefault();
    };

    /**
     * Saves edits made to an entity or alias group. This doesn't update the
     * interface; that is done via listeners to the AnnotationManager events
     * that updating a group or entity name trigger.
     * 
     * @param {DOM Event} The event that triggered this callback.
     */
    var saveNameEdits = function(event){
        event.preventDefault();

        var $nameWrapper = $(this).parents('.name-wrapper');
        var $name = $nameWrapper.find('.name');
        var $nameEditor = $nameWrapper.find('.name-edit');
        var newName = cleanHTML($nameEditor.find('input[name=name]').val());

        // Alias group name change.
        if($nameWrapper.hasClass('alias-group-name-wrapper')){
            var aliasGroupId = $nameWrapper.parents('.alias-group').attr('data-id');
            annotationManager.changeGroupName(aliasGroupId, newName);

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
     */
    var populateMenus = function(){
        aliasEditMenuManager.populateMenu();
        aliasGroupEditMenuManager.populateMenu();
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

        // TODO: populate based on most recently added or modified.
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

            console.log('in entitiesPanel mousedown listener', $target, $entity);
            if($entity.length > 0){
                if($target.hasClass('name') || $target.hasClass('options') ||
                    $target.parents('.options').length > 0){

                    if(!$entity.hasClass('ui-selected') && !event.ctrlKey){
                        $entitiesPanel.find('.entity.ui-selected').removeClass('ui-selected');
                    }

                    $entity.addClass('ui-selected');
                }
            } else {
                $entitiesPanel.find('.entity.ui-selected').removeClass('ui-selected');
            }
        });


        // Listen for renaming clicks.
        $(document).on('click', '.entities-panel-menu .rename-option', showNameEditor);
        $(document).on('click', '.entities-panel-menu .delete-option', onDeleteViaMenu);
        $entitiesPanel.on('submit', '.name-edit', saveNameEdits);

        $entitiesPanel.on('click', '.options', showMenu);
        $(document).on('click', hideMenu);

        $(document).on('click', '.entities-panel-menu .alias-group', 
                onEntitiesMovedViaMenu);

        $(document).on('entities.annotation.group-added', onAliasGroupAddedToAnnotation);
        $(document).on('entities.annotation.entity-added', onEntityAddedToAnnotation);
        $(document).on('entities.annotation.entity-alias-group-changed', onEntityMovedInAnnotation);
        $(document).on('entities.annotation.group-removed', onAliasGroupRemovedFromAnnotation);
        $(document).on('entities.annotation.entity-removed', onEntityRemovedFromAnnotation);
        $(document).on('entities.annotation.entity-renamed', onEntityRenamedInAnnotation);
        $(document).on('entities.annotation.group-renamed', onAliasGroupRenamedInAnnotation);
        $(document).on('submit', '#new-entity-form', onAddCustomEntity);
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

