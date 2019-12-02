// File:    ui-updater.js
// Author:  Hank Feild
// Date:    02-Dec-2019
// Purpose: Handles updating the interface based on annotation changes made by
//          the user.


var UIUpdater = function(){
    var self = {};


    self.addTie = function(event, data){
        // Update highlighting in text panel.
        var tieWrapper = {};
        tieWrapper[data.id] = data.tie;
        highlightTiesInContent(data.tie.start, data.tie.end, 
            $('#text-panel'), tieWrapper);

        // Update network visualization.
        // TODO
    }

    /**
     * Updates the highlighting for the given tie.
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

        // Update ties in the network visualization panel.
        // TODO
    };


    self.removeTie = function(event, data){
        // Update highlighting in text panel.
        iterateOverTokens($('#text-panel'), data.tie.start, data.tie.end,
            function($token, tokenId, isWhitespace){

            console.log($token, tokenId, isWhitespace);

            if($token.attr('tie-refs') && 
                    $token.attr('tie-refs').includes(`${data.id} `)){

                // Remove the tie id from the tie refs.
                $token.attr('tie-refs', $token.attr('tie-refs').
                    replace(`${data.id} `, ''));

                // Decrease the tie ref count.
                $token.attr('data-tie-ref-count', 
                    parseInt($token.attr('data-tie-ref-count')) - 1);

                // Remove the tie-text class if the token isn't involved
                // with another tie.
                if($token.attr('data-tie-ref-count') == '0'){
                    $token.removeClass('tie-text');
                }
            }
        });

        // Update network visualization.
        // TODO
    }



    function init(){
        $(document).on('entities.annotation.tie-removed', self.removeTie);
        $(document).on('entities.annotation.tie-updated', self.updateTie);
        $(document).on('entities.annotation.tie-added', self.addTie);
    }

    init();

    return self;
};

var uiUpdater;
$(document).ready(function(){
    uiUpdater = UIUpdater(); 
});