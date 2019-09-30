
/**
 * Manages the annotation object on the frontend and sends changes to the
 * backend.
 * 
 * @param {Object} annotation_data An annotation object; see ../README.md for
 *                                 details.
 */
var AnnotationManager = function(annotation_data){
    this.annotation_data = annotation_data;
    var annotation = annotation_data.annotation;
    this.groups = annotation.groups;
    this.entities = annotation.entities;
    this.locations = annotation.locations;
    this.ties = annotation.ties;

    // Entities.
    this.removeEntities = function(entityIds){
        // TODO
    };


    /**
     *  Adds a new entity. If 
     * 
     * @param {string} entityText The text of the entity to add.
     * @param {string} groupId The id of the group to associate the entity with;
     *                         if undefined or null, the entity will be assigned
     *                         to a new group.
     * @param {integer} startLocation (Optional) The starting token offset of the
     *                                mention.
     * @param {integer} endLocation (Optional) The ending token offset of the
     *                              mention.
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server.
     * 
     * @return The id of the entity.
     */
    this.addEntity = function(name, mentionStart, mentionEnd, groupId, callback) {
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};
        var entityId = (++annotation.last_entity_id)+'';
        changes.last_entity_id = entityId;
        
        // Make the new entity.
        this.entities[entityId] = {
            name: name
        };

        // Make a new group if necessary.
        if(groupId === undefined || groupId === null){
            groupId = (++annotation.last_group_id)+'';
            this.groups[groupId] = {
                name: name,
                entities: {entityId: this.entities[entityId]}
            };

            // Mark changes.
            changes.last_group_id = newGroupId;
            changes.groups[groupId] = {name: name};
        }

        // Update the entity's group id and mark changes.
        this.entities[entityId].group_id = groupId;
        changes.entities[entityId] = this.entities[entityId];

        // Add in the mention if present.
        if(mentionStart !== undefined && mentionEnd !== undefined){
            var key = mentionStart +"_"+ mentionEnd;
            this.locations[key] = {
                start: mentionStart, 
                end: mentionEnd, 
                entity_id: entityId
            };

            // Mark changes.
            changes.locations[key] = this.locations[key];
        }

        // Sync with the server.
        sendChangesToServer(changes, callback);

        return entityId;
    }

    // Groups.

    /**
     * Moves all of the given entities to a new group.
     * Cases:
     * 1. N selected entities in same group of size N 
     *      -- do nothing.
     * 2. All groups with selections have at least one unselected entity
     *      -- create a new group and move selected to it.
     *      -- remove select from original groups
     * 3. N selected entities where one or more subsets of N are in a
     *    fully selected group
     *      -- move all selected to a fully selected group (id X)
     *      -- remove select entities from original groups, except group X
     *      -- remove empty groups
     * 
     * @param {array} A list of entity ids to associate with a new group.
     */
    this.groupEntities = function(entityIds, callback){
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};
        var newGroupId = ++annotation.last_group_id;
        var selectedEntities = {};
        var selectedGroups = {};
        var groupId, entityId;
        var fullySelectedGroups = [];
        var selectedGroupsSize;

        // Figure out which groups are selected.
        for(var i = 0; i < entityIds.length; i++){
            entityId = entityIds[i];
            groupId = this.entities[entityId].group_id;

            if(!selectedGroups[groupId]){
                selectedGroups[groupId] = 0;
            }
            selectedGroups[groupId]++;

            selectedEntities[entityId] = groupId;
        }

        // Find which groups are selected in whole.
        for(groupId in selectedGroups){
            if(selectedGroups[groupId] == size(this.groups[groupId].entities)){
                fullySelectedGroups.push(groupId);
            }
        }

        selectedGroupsSize = size(selectedGroups);

        // Case 1.
        if(selectedGroupsSize == 1 && fullySelectedGroups.length == 1){
            return;
        }

        // Case 2.
        if(fullySelectedGroups.length == 0){
            // Update group id.
            changes.last_group_id = newGroupId;

            this.groups[newGroupId] = {
                name: null,
                entities: {}
            };

            // Move entities there and remove them from the old ones.
            for(entityId in selectedEntities){
                var oldGroupId = selectedEntities[entityId];
                // Mark the changes to this entity's group.
                changes.entities[entityId] = {group_id: newGroupId};

                // Update the client-side model.
                this.entities[entityId].group_id = newGroupId;
                delete this.groups[oldGroupId].entities[entityId];
                this.groups[newGroupId].entities[entityId] = 
                    this.entities[entityId];

                // Use this entity's name for the group name if not already set.
                if(this.groups[newGroupId].name == null){
                    this.groups[newGroupId] = {name:  
                        this.entities[entityId].name};
                    this.groups[newGroupId].name = 
                        this.entities[entityId].name;
                }
            }   

        // Case 3. 
        } else {
            var targetGroupId = fullySelectedGroups[0];
            
            // Move entities there and remove them from the old ones.
            for(entityId in selectedEntities){
                var oldGroupId = selectedEntities[entityId];

                // Skip this one if it's part of the target group already.
                if(oldGroupId == targetGroupId) continue;

                changes.entities[entityId] = {group_id: targetGroupId}
                this.entities[entityId].group_id = targetGroupId;

                delete this.groups[oldGroupId].entities[entityId];

                this.groups[targetGroupId].entities[entityId] = 
                    this.entities[entityId];

            }

            // Delete the old fully selected groups.
            for(i = 0; i < fullySelectedGroups.length; i++){
                groupId = fullySelectedGroups[i];

                // Skip if this is the target group.
                if(groupId == targetGroupId) continue;

                changes.groups[groupId] = "DELETE";
                delete this.groups[groupId];
            }
        }

        sendChangesToServer(changes, callback);
    }


    this.addEntitiesToGroup = function(entityIds, groupId){

        // TODO
    };

    this.changeGroupName = function(groupId, name){
        // TODO
    };


    // Entity mentions (locations).

    this.addMention = function(entityId, startLocation, endLocation){
        // TODO
    };

    this.removeMention = function(locationId){
        // TODO
    };

    this.changeMention = function(locationId, newData){
        // TODO
    };


    // Ties.
    this.addTieBetweenMentions = function(sourceMention, targetMention, 
        startLocation, endLocation, label, weight, directed){

        // TODO
    };

    this.addTieBetweenEntities = function(sourceEntity, targetEntity, 
        startLocation, endLocation, label, weight, directed){

        // TODO
    };

    this.changeTie = function(tieId, newData){
        // TODO
    };

    this.removeTie = function(tieId){
        // TODO
    };

    var sendChangesToServer = function(changes, callback){
        $.post({
            url: `/json/annotations/${this.annotation_data.annotation_id}`,
            data: {_method: 'PATCH', data: JSON.stringify(changes)},
            success: function(data){
                // TODO update this.
                $('#response').html(`Updating modifications `+
                    `(${JSON.stringify(changes)}) `+
                    `${JSON.stringify(data, null, 4)}`);
            },
            error: function(jqXHR, textStatus, errorThrown){
                // TODO update this.
                $('#response').html('ERROR: '+ errorThrown);
                console.log(jqXHR, textStatus, errorThrown);
            }
        });
    };

    /**
     * Adds a list of entities to each group entry.
     */
    var linkEntitiesToGroups = function(){
        var entityId, groupId, i;
        for(entityId in this.entities){
            var entity = this.entities[entityId];
            var group = this.groups[entity.group_id];
            if(!group.entities){
                group.entities = {};
            }
            group.entities[entityId] = entity;
        }
    }

    /**
     * Initializes things, including adding extra data to the annotation 
     * structure to help with real-time processing (e.g., adding a reference
     * between groups and corresponding entities).
     */
    var init = function(){
        linkEntitiesToGroups();
    };

    init();


    return this;
};