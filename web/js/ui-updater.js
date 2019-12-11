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

        // Remove from text panel.
        // $(`#text-panel .entity[data-entity-id=${data.id}]`).each(function(){
        //     $(this).
        //         removeClass('entity').
        //         removeClass('annotated-entity'). 
        //         removeClass(`g${data.groupId}`).
        //         removeClass('start-token'). 
        //         removeClass('end-token'). 
        //         attr({
        //             'data-entity-id': null,
        //             'data-group-id': null,
        //             'data-location-id': null,
        //         });
        // });

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
        // TODO
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

        // Remove from entity panel.
        // TODO

        // Remove from network viz panel.
        networkViz.addGroup(data, true);

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
        var page = locationsByPages[findPageWithLocation(data.location)];
        page.push(data.id);

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
                attr({
                    'data-entity-id': null,
                    'data-group-id': null,
                    'data-location-id': null,
                });
        });
    };



    /**
     * Adds listeners for annotation update events.
     */
    function init(){
        // Tie listeners.
        $(document).on('entities.annotation.tie-removed', self.removeTie);
        $(document).on('entities.annotation.tie-updated', self.updateTie);
        $(document).on('entities.annotation.tie-added', self.addTie);

        // Entity listeners.
        $(document).on('entities.annotation.entity-removed', self.removeEntity);

        // Alias group listeners.
        $(document).on('entities.annotation.group-removed', 
                       self.removeAliasGroup);
        $(document).on('entities.annotation.group-added', 
                       self.addAliasGroup);

        // Mention listeners.
        $(document).on('entities.annotation.mention-removed', 
                       self.removeMention);
        $(document).on('entities.annotation.mention-added', self.addMention);

    }

    init();

    return self;
};

var uiUpdater;
$(document).ready(function(){
    uiUpdater = UIUpdater(); 
});