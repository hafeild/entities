// File: entity-menu-operations.js
// Author: Hank Feild
// Date: 2022-06-29
// Purpose: Provides functions for adding entities to menus.

/**
 * 
 * 
 * @param {jQuery} $menu The menu to add the alias group to.
 */
var EntityMenuManager = function(annotationManager, $menu){
    var self = {

    };
    
    /**
     * Adds an alias group to the specified entities panel menu.
     * 
     * @param {string} id The id of the group.
     * @param {string} name The name of the group.
     * @param {jQuery} $allEntitiesList (Optional) The ul element containing 
     *                                  selectable items in the menu.
     * @param {jQuery} $itemTemplate (Optional) The template of the item.
     */
     self.addAliasGroupToMenu = function(id, name, $allEntitiesList, $itemTemplate){
        if($allEntitiesList === undefined){
            $allEntitiesList = $menu.find('.all-entities ul');
        }
        if($itemTemplate === undefined){
            var $itemTemplate = $menu.find('.templates .alias-group');
        }

        var $groupListItem = $itemTemplate.clone();
        $groupListItem.html(name);
        $allEntitiesList.append($groupListItem);
        $groupListItem.attr('data-id', id);
    };

    
    /**
     * Populates the list of 'all-entities' in the given entities panel menu if 
     * $menu is specified, or both the alias group and alias menus otherwise.
     * 
     * @param {jQuery} menu The menu to populate (optional).
     */
    self.populateMenu = function(){
        var $itemTemplate = $menu.find('.templates .alias-group');
        var groupId;
        var $allEntitiesList = $menu.find('.all-entities ul')

        // Clear the list.
        $allEntitiesList.html('');

        // Add each of the groups.
        for(groupId in annotationManager.groups){
            self.addAliasGroupToMenu(groupId, 
                annotationManager.groups[groupId].name, 
                $allEntitiesList,
                $itemTemplate)
        }

    };

    /**
     * Adds a new entity group item to the menu.
     * 
     * @param {Event} event The DOM event. 
     * @param {Object} data Should include the fields: id, name.
     */
     var onAliasGroupAddedToAnnotation = function(event, data){
        var aliasGroup = annotationManager.groups[data.id];
        self.addAliasGroupToMenu($menu, data.id, aliasGroup.name);
    };

    /**
     * Changes an alias group's name in the menu.
     * 
     * @param {Event} event The DOM event. 
     * @param {Object} data Should include the fields: id, name (new)
     */
     var onAliasGroupRenamedInAnnotation = function(event, data){
        $menu.find(`li[data-id=${data.id}]`).html(data.name);
    };


    /**
     * Removes an alias group from the menu.
     * 
     * @param {Event} event The DOM event. 
     * @param {Object} data Should include the fields: id
     */
     var onAliasGroupRemovedFromAnnotation = function(event, data){
        $menu.find(`li[data-id=${data.id}]`).remove();
    };

    /**
     * Adds the listeners for adding, removing, and renaming entity alias groups
     * and updates the menu accordingly.
     */
    var addListeners = function(){
        var $document = $(document);

        $document.on('entities.annotation.group-added', onAliasGroupAddedToAnnotation);
        $document.on('entities.annotation.group-renamed', onAliasGroupRenamedInAnnotation);
        $document.on('entities.annotation.group-removed', onAliasGroupRemovedFromAnnotation);
    };

    addListeners();
    return self;
};
