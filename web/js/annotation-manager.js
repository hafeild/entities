
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
    var self = {};
    self.annotation_data = annotation_data;
    var annotation = annotation_data.annotation;
    self.groups = annotation.groups;
    self.entities = annotation.entities;
    self.locations = annotation.locations;
    self.ties = annotation.ties;

    ////////////////////////////////////////////////////////////////////////////
    // Entities.
    ////////////////////////////////////////////////////////////////////////////

    /**
     * Alias for removeEntities([entityId], callback).
     */
    self.removeEntity = function(entityId, callback){
        self.removeEntities([entityId], callback);
    };

    /**
     * Removes the given entities as well as any mentions or ties involving it,
     * and its group if a singleton.
     * 
     * @param {string[]} entityIds A list of entity ids to remove.
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server. Should take a single 
     *                            object as a paramter with these fields: 
     *                              - success (boolean)
     *                              - data (response data, only if successful)
     *                              - error (only if unsuccessful)
     *                              - extra (only if unsuccessful)
     *                                 * jqXHR
     *                                 * textStatus
     */
    self.removeEntities = function(entityIds, callback){
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};
        var i, tieId, tie, locationId, nodeEntity, node, 
            nodes = {source_entity: 1, target_entity: 1};

        for(i = 0; i < entityIds.length; i++){
            var entityId = entityIds[i];
            var entity = self.entities[entityId];

            // Remove from groups.
            group = self.groups[entity.group_id];
            if(size(group.entities) === 1 && 
                group.entities[entityId] !== undefined){

                delete self.groups[entity.group_id];
                changes.groups[entity.groupId] = "DELETE";
            }

            // Remove from ties.
            for(tieId in entity.ties){
                // Remove from this and other entity's tie lists.
                tie = entity.ties[tieId];
                for(node in nodes){
                    nodeEntity = null;
                    if(tie[node].location_id !== undefined){
                        nodeEntity = self.entities[
                            self.locations[tie[node].location_id].entity_id];
                    } else if(tie[node].entity_id !== undefined) {
                        nodeEntity = self.entities[tie[node].entity_id];
                    }

                    if(nodeEntity != null){
                        delete nodeEntity.ties[tieId];
                    }
                }

                delete self.ties[tieId];
                changes.ties[tieId] = "DELETE";
            }

            // Remove from mentions.
            for(locationId in entity.locations){
                delete self.locations[locationId];
                changes.locations[locationId] = "DELETE";
            }

            // Remove from entities.
            delete self.entities[entityId];
            changes.entities[entityId] = "DELETE";
        }

        console.log(changes);

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
     *                            changes to the server. Should take a single 
     *                            object as a paramter with these fields: 
     *                              - success (boolean)
     *                              - data (response data, only if successful)
     *                              - error (only if unsuccessful)
     *                              - extra (only if unsuccessful)
     *                                 * jqXHR
     *                                 * textStatus
     */
    self.updateEntity = function(entityId, updatedEntity, callback){
        var changes = {entities: {entityId: {}}, groups: {}, locations: {}, 
            ties: {}};
        
        // Update group id.
        if(updatedEntity.group_id !== undefined){
            var oldGroupId = self.entities[entityId].group_id;

            // Remove old group if singleton.
            if(size(self.groups[oldGroupId]) === 1 && 
               self.groups[oldGroupId][entityId] !== undefined){
                delete self.groups[oldGroupId];
                // Mark changes.
                changes.groups[oldGroupId] = "DELETE";
            }

            self.entities[entityId].group_id = updatedEntity.group_id;
            self.groups[updatedEntity.group_id].entities[entityId] = 
                self.entities[entityId];

            // Mark changes.
            changes.entities[entityId].group_id = updatedEntity.group_id;
        }

        // Update name.
        if(updatedEntity.name !== undefined){
            self.entities[entityId].name = updatedEntity.name;
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
     *                            changes to the server. Should take a single 
     *                            object as a paramter with these fields: 
     *                              - success (boolean)
     *                              - data (response data, only if successful)
     *                              - error (only if unsuccessful)
     *                              - extra (only if unsuccessful)
     *                                 * jqXHR
     *                                 * textStatus
     * 
     * @return The id of the entity.
     */
    self.addEntity = function(name, startingOffset, endingOffset, groupId, callback) {
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};
        var entityId = (++annotation.last_entity_id)+'';
        changes.last_entity_id = annotation.last_entity_id;
        
        // Make the new entity.
        self.entities[entityId] = {
            name: name
        };

        // Make a new group if necessary.
        if(groupId === undefined || groupId === null){
            groupId = (++annotation.last_group_id)+'';
            self.groups[groupId] = {
                name: name,
                entities: {entityId: self.entities[entityId]}
            };

            // Mark changes.
            changes.last_group_id = groupId;
            changes.groups[groupId] = {name: name};
        }

        // Update the entity's group id and mark changes.
        self.entities[entityId].group_id = groupId;
        changes.entities[entityId] = self.entities[entityId];

        // Add in the mention if present.
        if(startingOffset !== undefined && endingOffset !== undefined){
            var key = `${startingOffset}_${endingOffset}`;
            self.locations[key] = {
                start: startingOffset, 
                end: endingOffset, 
                entity_id: entityId
            };

            // Mark changes.
            changes.locations[key] = self.locations[key];
        }

        // Sync with the server.
        sendChangesToServer(changes, callback);

        return entityId;
    };

    ////////////////////////////////////////////////////////////////////////////
    // Groups.
    ////////////////////////////////////////////////////////////////////////////

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
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server. Should take a single 
     *                            object as a paramter with these fields: 
     *                              - success (boolean)
     *                              - data (response data, only if successful)
     *                              - error (only if unsuccessful)
     *                              - extra (only if unsuccessful)
     *                                 * jqXHR
     *                                 * textStatus
     */
    self.groupEntities = function(entityIds, callback){
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};
        var newGroupId = (++annotation.last_group_id).toString();
        var selectedEntities = {};
        var selectedGroups = {};
        var groupId, entityId;
        var fullySelectedGroups = [];
        var selectedGroupsSize;

        // Figure out which groups are selected.
        for(var i = 0; i < entityIds.length; i++){
            entityId = entityIds[i];
            groupId = self.entities[entityId].group_id;

            if(!selectedGroups[groupId]){
                selectedGroups[groupId] = 0;
            }
            selectedGroups[groupId]++;

            selectedEntities[entityId] = groupId;
        }

        // Find which groups are selected in whole.
        for(groupId in selectedGroups){
            if(selectedGroups[groupId] == size(self.groups[groupId].entities)){
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

            changes.groups[newGroupId] = {
                name: null,
                entities: {}
            };
            self.groups[newGroupId] = {
                name: null,
                entities: {}
            };

            // Move entities there and remove them from the old ones.
            for(entityId in selectedEntities){
                var oldGroupId = selectedEntities[entityId];
                // Mark the changes to this entity's group.
                changes.entities[entityId] = {group_id: newGroupId};

                // Update the client-side model.
                self.entities[entityId].group_id = newGroupId;
                delete self.groups[oldGroupId].entities[entityId];
                self.groups[newGroupId].entities[entityId] = 
                    self.entities[entityId];

                // Use this entity's name for the group name if not already set.
                if(self.groups[newGroupId].name == null){
                    self.groups[newGroupId].name = 
                        self.entities[entityId].name;
                    changes.groups[newGroupId].name =
                        self.entities[entityId].name;
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
                self.entities[entityId].group_id = targetGroupId;

                delete self.groups[oldGroupId].entities[entityId];

                self.groups[targetGroupId].entities[entityId] = 
                    self.entities[entityId];

            }

            // Delete the old fully selected groups.
            for(i = 0; i < fullySelectedGroups.length; i++){
                groupId = fullySelectedGroups[i];

                // Skip if this is the target group.
                if(groupId == targetGroupId) continue;

                changes.groups[groupId] = "DELETE";
                delete self.groups[groupId];
            }
        }

        // Sync with server.
        sendChangesToServer(changes, callback);
    };

    /**
     * Alias for moveEntitiesToGroup([entityId], groupId, callback).
     */
    self.moveEntityToGroup = function(entityId, group_id, callback){
        self.moveEntitiesToGroup([entityId], group_id, callback);
    };

    /**
     * Moves each of the entities over to the specified group; groups made empty
     * by the move are deleted.
     * 
     * @param {string[]} entityIds A list of ids of entities to move.
     * @param {string} groupId The id of the group to move the entities to.
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server. Should take a single 
     *                            object as a paramter with these fields: 
     *                              - success (boolean)
     *                              - data (response data, only if successful)
     *                              - error (only if unsuccessful)
     *                              - extra (only if unsuccessful)
     *                                 * jqXHR
     *                                 * textStatus
     */
    self.moveEntitiesToGroup = function(entityIds, group_id, callback){
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};
        var i, entityId, entity;
        var newGroup = self.groups[group_id];
        
        for(i = 0; i < entityIds.length; i++){
            entityId = entityIds[i];
            entity = self.entities[entityId];

            // Remove reference to old group.
            delete self.groups[entity.group_id].entities[entityId];

            // Remove old group if now empty.
            if(size(self.groups[entity.group_id].entities) === 0){
                delete self.groups[entity.group_id];
                // Mark the change.
                changes.groups[entity.group_id] = "DELETE";
            }

            // Link the entity to the new group and update convenience links.
            entity.group_id = group_id;
            newGroup.entities[entityId] = entity;

            // Mark the change.
            changes.entities[entityId] = {group_id: group_id};
        }

        // Sync with server.
        sendChangesToServer(changes, callback);
    };

    /**
     * Updates the given group's name and synchronizes the change with the 
     * server.
     * 
     * @param {string} groupId The id of the group to modify.
     * @param {string} name The new name for the group.
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server. Should take a single 
     *                            object as a paramter with these fields: 
     *                              - success (boolean)
     *                              - data (response data, only if successful)
     *                              - error (only if unsuccessful)
     *                              - extra (only if unsuccessful)
     *                                 * jqXHR
     *                                 * textStatus
     */
    self.changeGroupName = function(groupId, name, callback){
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};

        self.groups[groupId].name = name;
        changes.groups[groupId] = {name: name};        

        // Sync with server.
        sendChangesToServer(changes, callback);
    };

    /**
     * Alias for removeGroup([groupId], callback).
     */
    self.removeGroup = function(groupId, callback) {
        self.removeGroups([groupId], callback);
    };

    /**
     * Removes all of the entities associated with the given list of group ids.
     * 
     * @param {string[]} groupIds The list of ids of groups to remove.
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server. Should take a single 
     *                            object as a paramter with these fields: 
     *                              - success (boolean)
     *                              - data (response data, only if successful)
     *                              - error (only if unsuccessful)
     *                              - extra (only if unsuccessful)
     *                                 * jqXHR
     *                                 * textStatus
     */
    self.removeGroups = function(groupIds, callback) {
        var entityIds = [];
        var i, entityId;
        for(i = 0; i < groupIds.length; i++){
            for(entityId in self.groups[groupIds[i]].entities){
                entityIds.push(entityId);
            }
        }
        self.removeEntities(entityIds, callback);
    };

    ////////////////////////////////////////////////////////////////////////////
    // Entity mentions (locations).
    ////////////////////////////////////////////////////////////////////////////

    /**
     * Adds a new mention.
     * 
     * @param {string} entityId The id of the entity being mentioned.
     * @param {integer} startingOffset The starting token offset of the mention.
     * @param {integer} endingOffset The ending token offset of the mention.
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server. Should take a single 
     *                            object as a paramter with these fields: 
     *                              - success (boolean)
     *                              - data (response data, only if successful)
     *                              - error (only if unsuccessful)
     *                              - extra (only if unsuccessful)
     *                                 * jqXHR
     *                                 * textStatus
     */
    self.addMention = function(entityId, startingOffset, endingOffset,callback){
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};
        var key = `${startingOffset}_${endingOffset}`;
        self.locations[key] = {
            entity_id: entityId,
            start: startingOffset,
            end: endingOffset
        };

        // Add convenience link from the entity to the mention.
        var entity = self.entities[entityId];
        if(entity.locations === undefined){
            entity.locations = {};
        }
        entity.locations[key] = self.locations[key];

        // Mark changes.
        changes.locations[key] = self.locations[key];

        // Sync with server.
        sendChangesToServer(changes, callback);
    };

    /**
     * Removes the given mention, as well as any ties associated with it.
     * 
     * @param {string} locationId The id of the mention to remove.
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server. Should take a single 
     *                            object as a paramter with these fields: 
     *                              - success (boolean)
     *                              - data (response data, only if successful)
     *                              - error (only if unsuccessful)
     *                              - extra (only if unsuccessful)
     *                                 * jqXHR
     *                                 * textStatus
     */
    self.removeMention = function(locationId, callback){
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};
        var location, nodeEntity, node, 
            nodes = {source_entity: 1, target_entity: 1};

        location = self.locations[locationId];

        // Remove from ties.
        for(tieId in location.ties){
            // Remove from the source and target entity's tie lists.
            tie = location.ties[tieId];
            for(node in nodes){
                nodeEntity = null;
                if(tie[node].location_id !== undefined){
                    nodeEntity = self.entities[
                        self.locations[tie[node].location_id].entity_id];
                } else if(tie[node].entity_id !== undefined) {
                    nodeEntity = self.entities[tie[node].entity_id];
                }

                if(nodeEntity != null){
                    delete nodeEntity.ties[tieId];
                }
            }

            delete self.ties[tieId];
            changes.ties[tieId] = "DELETE";
        }

        // Remove the location and mark the change.
        delete self.locations[locationId];
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
     *                                  * start (token offset; integer)
     *                                  * end (token offset; integer)
     *                                  * entity_id (string)
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server. Should take a single 
     *                            object as a paramter with these fields: 
     *                              - success (boolean)
     *                              - data (response data, only if successful)
     *                              - error (only if unsuccessful)
     *                              - extra (only if unsuccessful)
     *                                 * jqXHR
     *                                 * textStatus
     */
    self.updateMention = function(locationId, updatedMention, callback){
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}};
        var fields = ['start', 'end', 'entity_id'];
        var location = self.locations[locationId];
        var nodes = {source_entity: 1, target_entity: 1}, node, nodeEntity;

        // Update the fields.
        fields.forEach(field => {
            if(updatedMention[field] !== undefined){
                // If this is the entity_id field, update the old and new 
                // entity.
                if(field === 'entity_id'){
                    delete self.entities[location.entity_id].
                        locations[locationId];
                    self.entities[updatedMention.entity_id].
                        locations[locationId] = location;
                }

                location[field] = updatedMention[field];
                // Mark change.
                changes.locations[field] = location[field];
            }
        });

        // Sync with server.
        sendChangesToServer(changes, callback);
    };

    ////////////////////////////////////////////////////////////////////////////
    // Ties.
    ////////////////////////////////////////////////////////////////////////////

    /**
     * Adds a tie between two mentions, updating the convenience links, then
     * syncs with the server.
     * 
     * @param {object} tieData A map of tie fields and their values. Optional 
     *                         fields are asterisked. 
     *                             * start (token offset; integer)
     *                             * end (token offset; integer)
     *                             * source_entity (object)
     *                                 - location_id OR entity_id
     *                             * target_entity (object)
     *                                 - location_id OR entity_id
     *                             * label* (string)
     *                             * weight* (floating point)
     *                             * directed* (boolean)
     *                            e.g., 
     *                            {
     *                              start: 10, 
     *                              end: 30, 
     *                              source_entity: {location_id: "10_11"}, 
     *                              target_entity: {entity_id: "5"}, 
     *                              label: "speak"
     *                             }
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server. Should take a single 
     *                            object as a paramter with these fields: 
     *                              - success (boolean)
     *                              - data (response data, only if successful)
     *                              - error (only if unsuccessful)
     *                              - extra (only if unsuccessful)
     *                                 * jqXHR
     *                                 * textStatus
     */
    self.addTie = function(tieData, callback){
        var changes = {entities: {}, groups: {}, locations: {}, ties: {}}; 

        // Generate a new tie id.
        var tieId = `${++annotation.last_tie_id}`;

        // Add a placeholder for the tie data and mark the change.
        self.ties[tieId] = {source_entity: {}, target_entity: {}};
        changes.last_tie_id = annotation.last_tie_id;

        // Let updateTie do all the heavy lifting...
        self.updateTie(tieId, tieData, callback, changes);
    };

    /**
     * Updates the given tie and synchronizes changes with the server.
     * 
     * @param {string} tieId The id of the tie to update.
     * @param {object} updatedTie A map of modified entity fields and their
     *                            values. The following fields are supported:
     *                             * start (token offset; integer)
     *                             * end (token offset; integer)
     *                             * source_entity (object)
     *                                 - location_id OR entity_id
     *                             * target_entity (object)
     *                                 - location_id OR entity_id
     *                             * label (string)
     *                             * weight (floating point)
     *                             * directed (boolean)
     *                            e.g., 
     *                            {
     *                              start: 10, 
     *                              end: 30, 
     *                              source_entity: {location_id: "10_11"}, 
     *                              target_entity: {entity_id: "5"}, 
     *                              label: "speak"
     *                             }
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server. Should take a single 
     *                            object as a paramter with these fields: 
     *                              - success (boolean)
     *                              - data (response data, only if successful)
     *                              - error (only if unsuccessful)
     *                              - extra (only if unsuccessful)
     *                                 * jqXHR
     *                                 * textStatus
     * @param {object} changes (Optional) A map of changes to made to the 
     *                         annotation data. This is used for internal 
     *                         AnnotationManager calls.
     */
    self.updateTie = function(tieId, updatedTie, callback, changes){
        console.log(tieId, updatedTie, changes);

        var basicFields = ['start', 'end', 'label', 'weight', 'directed'],field;
        var nodes = {source_entity: 1, target_entity: 1}, node;
        var tie = self.ties[tieId];
        var i;

        if(changes === undefined){
            changes = {entities: {}, groups: {}, locations: {}, ties: {}};
        }

        changes.ties[tieId] = {};

        // Update the simple fields.
        for(i = 0; i < basicFields.length; i++){
            field = basicFields[i];
            if(updatedTie[field] !== undefined){
                tie[field] = updatedTie[field];
                // Mark change.
                changes.ties[tieId][field] = updatedTie[field];
            }
        }

        // Update the *_entity fields.
        for(node in nodes){
            if(updatedTie[node] !== undefined){
                // Remove convenience links.
                if (Object.keys(tie).length > 0) {
                    if(tie[node].location_id !== undefined){
                        delete self.locations[tie[node].location_id].ties[tieId];
                    } else if(tie[node].entity_id !== undefined) {
                        delete self.entities[tie[node].entity_id].ties[tieId];
                    }
                }

                // Add in new convenience links.
                if(updatedTie[node].location_id !== undefined){
                    tie[node] = {location_id: updatedTie[node].location_id};

                    // In case this is the first tie the location has been 
                    // associated with.
                    if(self.locations[tie[node].location_id].ties == undefined){
                        self.locations[tie[node].location_id].ties = {};
                    }
                    self.locations[tie[node].location_id].ties[tieId] = tie;

                    // In case this is the first tie this entity has been 
                    // associated with.
                    if(self.entities[self.locations[tie[node].location_id].
                        entity_id].ties == undefined) {
                            self.entities[self.locations[tie[node].location_id].
                        entity_id].ties = {};
                    }
                    self.entities[self.locations[tie[node].location_id].
                        entity_id].ties[tieId] = tie;

                    // Mark changes.
                    changes.ties[tieId][node] = {
                        location_id: updatedTie[node].location_id
                    };
                } else if(updatedTie[node].entity_id !== undefined){
                    tie[node] = {entity_id: updatedTie[node].entity_id};
                    self.entities[tie[node].entity_id].ties[tieId] = tie;

                    // Mark changes.
                    changes.ties[tieId][node] = {
                        entity_id: updatedTie[node].entity_id
                    };
                }
            }
        }

        // Sync with server.
        sendChangesToServer(changes, callback);
    };

    /**
     * Removes a tie and syncs with the server.
     * 
     * @param {string} tieId The id of the tie to remove.
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server. Should take a single 
     *                            object as a paramter with these fields: 
     *                              - success (boolean)
     *                              - data (response data, only if successful)
     *                              - error (only if unsuccessful)
     *                              - extra (only if unsuccessful)
     *                                 * jqXHR
     *                                 * textStatus
     */
    self.removeTie = function(tieId, callback){
        var changes = {
            entities: {}, groups: {}, locations: {}, ties: {}
        };
        var nodes = {source_entity: 1, target_entity: 1}, node;
        var tie = self.ties[tieId];

        changes.ties[tieId] = 'DELETE';

        // Update the *_entity fields.
        for(node in nodes){
            if(updatedTie[node] !== undefined){
                // Remove convenience links.
                if(tie[node].location_id !== undefined){
                    delete self.locations[tie[node].location_id].ties[tieId];
                } else if(tie[node].entity_id !== undefined) {
                    delete self.entities[tie[node].entity_id].ties[tieId];
                }
            }
        }

        // Sync with server.
        sendChangesToServer(changes, callback);
    };

    ////////////////////////////////////////////////////////////////////////////
    // Helpers, etc.
    ////////////////////////////////////////////////////////////////////////////

    /**
     * Synchronizes changes made to the annotation data with the server.
     * 
     * @param {object} changes An object that includes the entries to update or
     *                         delete. Here are the supported fields. To delete
     *                         an entity, group, location, or tie, simply use 
     *                         the id of the entry as the key and set its value
     *                         to the string "DELETE".
     * 
     *            - last_entity_id (integer)
     *            - last_group_id (integer)
     *            - last_tie_id (integer)
     *            - entities
     *               <entityId>: {name, group_id}
     *            - groups
     *               <groupId>: {name}
     *            - locations
     *               <locationId>: {start, end, entity_id}
     *            - ties
     *               <tieId>: {start, end, 
     *                         source_entity: {location_id: "" | entity_id: ""}, 
     *                         target_entity: {location_id: "" | entity_id: ""}, 
     *                         label, weight, directed}
     * @param {function} callback (Optional) A callback to invoke after sending
     *                            changes to the server. Should take a single 
     *                            object as a paramter with these fields: 
     *                              - success (boolean)
     *                              - data (response data, only if successful)
     *                              - error (only if unsuccessful)
     *                              - extra (only if unsuccessful)
     *                                 * jqXHR
     *                                 * textStatus
     */
    var sendChangesToServer = function(changes, callback){
        console.log('sending changes to server', changes);
        $.post({
            url: `/json/annotations/${self.annotation_data.annotation_id}`,
            data: {_method: 'PATCH', data: JSON.stringify(changes)},
            success: function(response){
                if(callback !== undefined && callback !== null){
                    callback({
                        success: true, 
                        data: response
                    });
                }
            },
            error: function(jqXHR, textStatus, errorThrown){
                if(callback !== undefined && callback !== null){
                    callback({
                        success: false, 
                        error: errorThrown, 
                        data: {
                            jqXHR: jqXHR,
                            textStatus: textStatus
                        }
                    });
                }
            }
        });
    };

    /**
     * Adds a map of entities to each group entry.
     */
    var linkEntitiesToGroups = function(){
        var entityId;
        for(entityId in self.entities){
            var entity = self.entities[entityId];
            var group = self.groups[entity.group_id];
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
        for(locationId in self.locations){
            var location = self.locations[locationId];
            var entity = self.entities[location.entity_id];
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
        var tieId, nodes = {source_entity: 1, target_entity: 1};

        for(tieId in self.ties){
            var tie = self.ties[tieId];

            for(node in nodes){
                // Add the tie to the specified location's tie list.
                if(tie[node] === undefined){
                    console.log(tie);
                }
                if(tie[node].location_id !== undefined){
                    var location = self.locations[tie[node].location_id];
                    if(!location.ties){
                        location.ties = {};
                    }
                    location.ties[tieId] = tie;

                    // Add this to the corresponding entity, as well.
                    var entity = self.entities[location.entity_id];
                    if(!entity.ties){
                        entity.ties = {};
                    }
                    entity.ties[tieId] = tie;

                // Add the tie to the specified entity's tie list.
                } else if(tie[node].entity_id !== undefined){
                    var entity = self.entities[tie[node].entity_id];
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
        linkLocationsToEntities();
        linkTiesToLocationsAndEntities();
    };

    init();

    return self;
};