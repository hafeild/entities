
/**
 * Manages the annotation object on the frontend and sends changes to the
 * backend. Adds a number of convenience cross-links to ease front-end use. The
 * format of the annotation object is outlined below, with convenience fields
 * marked with an asterisk (*).
 * 
 * entities
 *      name
 *      group_id
 *      ties* -- map of tie ids -> tie entries
 *      locations* -- map of location ids -> location entries
 *      
 * groups
 *      name
 *      entities* -- map of entity ids -> entity entrys
 * 
 * locations
 *      start
 *      end
 *      entity_id
 *      ties* -- map of tie ids -> tie entries
 *  
 * ties
 *      start
 *      end
 *      source_entity
 *          location_id OR entity_id
 *      target_entity
 *          location_id OR entity_id
 *      label
 *      weight
 *      directed
 *      
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

    /**
     * Alias for removeEntities([entityId], callback).
     */
    this.removeEntity = function(entityId, callback){
        this.removeEntities([entityId], callback);
    };

    /**
     * Removes the given entities as well as any mentions or ties involving it,
     * and its group if a singleton.
     * 
     * @param {string[]} entityIds A list of entity ids to remove.
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server.
     */
    this.removeEntities = function(entityIds, callback){
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};
        var i, tieId, tie, locationId, nodeEntity, node, 
            nodes = ['source_entity', 'target_entity'];

        for(i = 0; i < entityIds.length; i++){
            var entityId = entityIds[i];
            var entity = this.entities[entityId];

            // Remove from groups.
            group = this.groups[entity.group_id];
            if(size(group.entities) === 1 && 
                group.entities[entityId] !== undefined){

                delete this.groups[entity.group_id];
                changes.groups[entity.groupId] = "DELETE";
            }

            // Remove from ties.
            for(tieId in entity.ties){
                // Remove from this and other entity's tie lists.
                tie = entity.ties[tieId];
                for(node in nodes){
                    nodeEntity = null;
                    if(tie[node].location_id !== undefined){
                        nodeEntity = this.entities[
                            this.locations[tie[node].location_id].entity_id];
                    } else if(tie[node].entity_id !== undefined) {
                        nodeEntity = this.entities[tie[node].entity_id];
                    }

                    if(nodeEntity != null){
                        delete nodeEntity.ties[tieId];
                    }
                }

                delete this.ties[tieId];
                changes.ties[tieId] = "DELETE";
            }

            // Remove from mentions.
            for(locationId in entity.locations){
                delete this.locations[locationId];
                changes.locations[locationId] = "DELETE";
            }

            // Remove from entities.
            delete this.entities[entityId];
            changes.entities[entityId] = "DELETE";
        }

        // Sync with the server.
        sendChangesToServer(changes, callback);
    };

    /**
     * Updates the given entity and synchronizes changes with the server.
     * 
     * @param {string} entityId The id of the entity to update.
     * @param {object} updatedEntity A map of modified entity fields and their
     *                               values. The following fields are supported:
     *                                  - group_id
     *                                  - name
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server.
     */
    this.updateEntity = function(entityId, updatedEntity, callback){
        var changes = {entities: {entityId: {}}, groups: {}, locations: {}, 
            ties: {}};
        
        // Update group id.
        if(updatedEntity.group_id !== undefined){
            var oldGroupId = this.entities[entityId].group_id;

            // Remove old group if singleton.
            if(size(this.groups[oldGroupId]) === 1 && 
               this.groups[oldGroupId][entityId] !== undefined){
                delete this.groups[oldGroupId];
                // Mark changes.
                changes.groups[oldGroupId] = "DELETE";
            }

            this.entities[entityId].group_id = updatedEntity.group_id;
            this.groups[updatedEntity.group_id].entities[entityId] = 
                this.entities[entityId];

            // Mark changes.
            changes.entities[entityId].group_id = updatedEntity.group_id;
        }

        // Update name.
        if(updatedEntity.name !== undefined){
            this.entities[entityId].name = updatedEntity.name;
            // Mark changes.
            changes.entities[entityId].name = updatedEntity.name;
        }

        // Sync with the server.
        sendChangesToServer(changes, callback);
    };


    /**
     *  Adds a new entity and links it to a new or existing group, and a new 
     * location (if provided).
     * 
     * @param {string} name The name of the entity to add.
     * @param {string} groupId The id of the group to associate the entity with;
     *                         if undefined or null, the entity will be assigned
     *                         to a new group.
     * @param {integer} startingOffset (Optional) The starting token offset of the
     *                                mention.
     * @param {integer} endingOffset (Optional) The ending token offset of the
     *                              mention.
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server.
     * 
     * @return The id of the entity.
     */
    this.addEntity = function(name, startingOfset, endingOffset, groupId, callback) {
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};
        var entityId = (++annotation.last_entity_id)+'';
        changes.last_entity_id = annotation.last_entity_id;
        
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
        if(startingOffset !== undefined && endingOffset !== undefined){
            var key = `${startingOffset}_${endingOffset}`;
            this.locations[key] = {
                start: startingOffset, 
                end: endingOffset, 
                entity_id: entityId
            };

            // Mark changes.
            changes.locations[key] = this.locations[key];
        }

        // Sync with the server.
        sendChangesToServer(changes, callback);

        return entityId;
    };


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

        // Sync with server.
        sendChangesToServer(changes, callback);
    };


    this.addEntitiesToGroup = function(entityIds, groupId){

        // TODO
    };

    /*
     * Updates the given group's name and synchronizes the change with the 
     * server.
     * 
     * @param {string} groupId The id of the group to modify.
     * @param {string} name The new name for the group.
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server.
     */
    this.changeGroupName = function(groupId, name, callback){
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};

        this.groups[groupId].name = name;
        changes.groups[groupId] = {name: name};        

        // Sync with server.
        sendChangesToServer(changes, callback);
    };


    // Entity mentions (locations).

    /**
     * Adds a new mention.
     * 
     * @param {string} entityId The id of the entity being mentioned.
     * @param {integer} startingOffset The starting token offset of the mention.
     * @param {integer} endingOffset The ending token offset of the mention.
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server.
     */
    this.addMention = function(entityId, startingOffset, endingOffset,callback){
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};
        var key = `${startingOffset}_${endingOffset}`;
        this.locations[key] = {
            entity_id: entityId,
            start: startingOffset,
            end: endingOffset
        };

        // Add convenience link from the entity to the mention.
        var entity = this.entities[entity_id];
        if(entity.locations === undefined){
            entity.locations = {};
        }
        entity.locations[key] = this.locations[key];

        // Mark changes.
        changes.locations[key] = this.locations[key];

        // Sync with server.
        sendChangesToServer(changes, callback);
    };

    /**
     * Removes the given mention, as well as any ties associated with it.
     * 
     * @param {string} locationId The id of the mention to remove.
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server.
     * 
     */
    this.removeMention = function(locationId){
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};
        var location, nodeEntity, node, 
            nodes = ['source_entity', 'target_entity'];

        location = this.locations[locationId];

        // Remove from ties.
        for(tieId in location.ties){
            // Remove from the source and target entity's tie lists.
            tie = location.ties[tieId];
            for(node in nodes){
                nodeEntity = null;
                if(tie[node].location_id !== undefined){
                    nodeEntity = this.entities[
                        this.locations[tie[node].location_id].entity_id];
                } else if(tie[node].entity_id !== undefined) {
                    nodeEntity = this.entities[tie[node].entity_id];
                }

                if(nodeEntity != null){
                    delete nodeEntity.ties[tieId];
                }
            }

            delete this.ties[tieId];
            changes.ties[tieId] = "DELETE";
        }

        // Remove the location and mark the change.
        delete this.locations[locationId];
        changes.locations[locationId] = "DELETE";

        // Sync with server.
        sendChangesToServer(changes, callback);
    };


    /**
     * Updates the given mention and synchronizes changes with the server.
     * 
     * @param {string} locationId The id of the mention to update.
     * @param {object} updatedMention A map of modified entity fields and their
     *                               values. The following fields are supported:
     *                                  - start
     *                                  - end
     *                                  - entity_id
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server.
     */
    this.updateMention = function(locationId, updatedMention, callback){
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};
        var fields = ['start', 'end', 'entity_id'],field;
        var location = this.locations[locationId];
        var nodes = ['source_entity', 'target_entity'], node, nodeEntity;

        // Update the fields.
        for(field in fields){
            if(updatedMention[field] !== undefined){
                // If this is the entity_id field, update the old and new 
                // entity.
                if(field === 'entity_id'){
                    delete this.entities[location.entity_id].
                        locations[locationId];
                    this.entities[updatedMention.entity_id].
                        locations[locationId] = location;
                }

                location[field] = updatedMention[field];
                // Mark change.
                changes.locations[field] = location[field];
            }
        }

        // Sync with server.
        sendChangesToServer(changes, callback);
    };


    // Ties.
    this.addTieBetweenMentions = function(sourceMention, targetMention, 
        startingOffset, endingOffset, label, weight, directed){

        // TODO
    };

    this.addTieBetweenEntities = function(sourceEntity, targetEntity, 
        startingOffset, endingOffset, label, weight, directed){

        // TODO
    };

    /**
     * Updates the given tie and synchronizes changes with the server.
     * 
     * @param {string} tieId The id of the tie to update.
     * @param {object} updatedTie A map of modified entity fields and their
     *                               values. The following fields are supported:
     *                                  - start
     *                                  - end
     *                                  - source_entity
     *                                      * location_id OR entity_id
     *                                  - target_entity
     *                                      * location_id OR entity_id
     *                                  - label
     *                                  - weight
     *                                  - directed
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server.
     */
    this.updateTie = function(tieId, updatedTie, callback){
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};
        var basicFields = ['start', 'end', 'label', 'weight', 'directed'],field;
        var nodes = ['source_entity', 'target_entity'], node, nodeEntity;
        var tie = this.ties[tieId];

        // Update the simple fields.
        for(field in basicFields){
            if(updatedMention[field] !== undefined){
                tie[field] = updatedTie[field];
                // Mark change.
                changes.ties[field] = location[field];
            }
        }

        // Update the *_entity fields.
        for(node in nodes){
            if(updatedTie[node] !== undefined){
                // Remove convenience links.
                if(tie[node].location_id !== undefined){
                    delete this.locations[tie[node].location_id].ties[tieId];
                } else if(tie[node].entity_id !== undefined) {
                    delete this.entities[tie[node].entity_id].ties[tieId];
                }

                // Add in new convenience links.
                if(updatedTie[node].location_id !== undefined){
                    tie[node] = {location_id: updatedTie[node].location_id};
                    this.locations[tie[node].location_id].ties[tieId] = tie;
                    this.entities[this.locations[tie[node].location_id].
                        entity_id].ties[tieId] = tie;

                    // Mark changes.
                    changes.ties[node] = {
                        location_id: updatedTie[node].location_id
                    };
                } else if(updatedTie[node].entity_id !== undefined){
                    tie[node] = {entity_id: updatedTie[node].entity_id};
                    this.entities[tie[node].entity_id].ties[tieId] = tie;

                    // Mark changes.
                    changes.ties[node] = {
                        entity_id: updatedTie[node].entity_id
                    };
                }
            }
        }

        // Sync with server.
        sendChangesToServer(changes, callback);
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
     * Adds a map of entities to each group entry.
     */
    var linkEntitiesToGroups = function(){
        var entityId;
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
     * Adds a map of locations to corresponding entity entries.
     */
    var linkLocationsToEntities = function(){
        var locationId;
        for(locationId in this.locations){
            var location = this.locations[locationId];
            var entity = this.entities[location.entity_id];
            if(!entity.locations){
                entity.locations = {};
            }
            entity.locations[locationId] = location;
        }
    };

    /**
     * Adds a map of ties to corresponding location and entity entries.
     */
    var linkTiesToLocationsAndEntities = function(){
        var tieId, nodes = ['source_entity', 'target_entity'];

        for(tieId in this.ties){
            var tie = this.ties[tieId];

            for(node in nodes){
                // Add the tie to the specified location's tie list.
                if(tie[node].location_id !== undefined){
                    var location = this.locations[tie[node].location_id];
                    if(!location.ties){
                        location.ties = {};
                    }
                    location.ties[tieId] = tie;

                    // Add this to the corresponding entity, as well.
                    var entity = this.entities[location.entity_id];
                    if(!entity.ties){
                        entity.ties = {};
                    }
                    entity.ties[tieId] = tie;

                // Add the tie to the specified entity's tie list.
                } else if(tie[node].entity_id !== undefined){
                    var entity = this.entities[tie[node].entity_id];
                    if(!entity.ties){
                        entity.ties = {};
                    }
                    entity.ties[tieId] = tie;
                }
            }
        }
    };



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