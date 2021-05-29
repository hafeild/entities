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
    }

    /**
     * Adds a new alias group entry to the entities panel along with any
     * corresponding entities.
     * 
     * @param groupName The name of the alias group.
     * @param groupId The id of the alias group.
     * @param entities The list of entities that make up the alias group.
     */
    self.addAliasGroup = function(groupName, groupId, entities){
        var i, entityId;
        var $aliasGroup = $aliasGroupTemplate.clone();
        $aliasGroups.append($aliasGroup);
        $aliasGroup.find('.name').html(groupName);
        $aliasGroup.attr('data-id', groupId);
        $aliasGroup.addClass(`g${groupId}`);
        for(entityId in entities){
            self.addEntity($aliasGroup, entities[entityId].name, entityId);
        }
    }

    /**
     * Adds a new entity to the given alias group UI element.
     * 
     * @param $aliasGroup The jQuery element for the alias group to which the
     *                    entity belongs.
     * @param entityName The name of the entity.
     * @param entityId The id of the entity.
     */
    self.addEntity = function($aliasGroup, entityName, entityId){
        var $entity = $entityTemplate.clone();
        $aliasGroup.append($entity);
        $entity.attr('data-id', entityId);
        $entity.find('.name').html(entityName);
    }

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
