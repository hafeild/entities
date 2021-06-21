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
     * @param {Event} The DON event associated with the drop.
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
                }
            }
        });
        console.log('Moving ', entityIds, 'to group',  $aliasGroup.attr('data-id'));
        $aliasGroup.removeClass('droppable-hover');        
        annotationManager.moveEntitiesToGroup(entityIds, $aliasGroup.attr('data-id'));
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
        var $nameWrapper = $(this).parents('.name-wrapper');
        var $name = $nameWrapper.find('.name');
        var $nameEditor = $nameWrapper.find('.name-edit');
        $nameEditor.find('input').val($name.text());
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
        var newName = cleanHTML($nameEditor.find('input').val());
        $name.html(newName);
        
        

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
        $entitiesPanel.on('click', '.rename-option', showNameEditor);
        // $entitiesPanel.on('click', '.submit-name-edit', saveNameEdits);
        $entitiesPanel.on('submit', '.name-edit', saveNameEdits);
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
