// File: text-panel-manager.js
// Author: Hank Feild
// Date: 2021-07-21
// Purpose: Provides functions for interacting with the text panel on an
//          annotation page.

var TextPanel = {};

/**
 * Manages the text panel that appears in the center of an annotation page.
 * Users can select text an annotate them as new or existing entities or
 * a link between entities.
 * 
 * @param _annotationManager An instance of AnnotationManager; this is used to
 *                          access details of the annotation.
 */
TextPanel.TextPanelManager = function(annotationManager){
    var self = {
        $textPanel: $('#text-panel'),
        $textContents: $('#text-contents'),
        tokenManger: undefined,
        contextMenuManager: undefined
    };
    var $endMarker = $('#end-marker');
    var textSelectionInProgress = false;
    var textSelection = {
        start: -1,
        end: -1
    };

    /**
     * Clears a selection -- either the entire selection if `prevSelection` and
     * `curSelection` aren't provided, or just the tokens in the previous
     * selection that are no longer in the current selection.
     * 
     * @param {Object} prevSelection The previous selection; should have the
     *                               fields: `start`, `end`.
     * @param {Object} curSelection The current selection; should have the
     *                              fields: `start`, `end`.
     */
    self.clearSelection = function(prevSelection, curSelection){
        // Clear entire selection.
        if(prevSelection == undefined || curSelection == undefined){
            self.$textPanel.find('.selected').removeClass(
                ['selected', 'selection-start', 'selection-end']);
            return;
        }

        // Clear only non-overlapping bits from the previous selection.
        var prevStart = Math.min(prevSelection.start, prevSelection.end);
        var prevEnd = Math.max(prevSelection.start, prevSelection.end);
        var curStart = Math.min(curSelection.start, curSelection.end);
        var curEnd = Math.max(curSelection.start, curSelection.end);
        var deselectFn = function(firstTokenId, lastTokenId){ 
            return function($token, tokenId, isWhitespace){
                $token.removeClass( 
                    ['selected', 'selection-start', 'selection-end']);
                if(tokenId == firstTokenId){
                    $token.prev('.whitespace').removeClass(
                        ['selected', 'selection-start', 'selection-end']);
                }
                if(tokenId == lastTokenId){
                    $token.next('.whitespace').removeClass(
                        ['selected', 'selection-start', 'selection-end']);
                }
            }
        };


        // Clear any tokens that need to be deselected before the current
        // selection.
        if(prevStart < curStart){
            let end = Math.min(curStart-1, prevEnd);
            self.tokenManager.iterateOverTokens(self.$textPanel, prevStart, end,
                deselectFn(prevStart, end));
        }

        // Clear any tokens that need to be deselected after the current 
        // selection.
        if(prevEnd > curEnd){
            let start =  Math.max(curEnd+1, prevStart);
            self.tokenManager.iterateOverTokens(self.$textPanel,start, prevEnd,
                deselectFn(start, prevEnd));
        }
    };

    /**
     * Highlights the tokens referred to by the given `textSelection` argument,
     * or if undefined, the global data member. Note that if
     * `textSelection.start` and `textSelection.end` are out of order, this
     * function will put them in order.
     */
    self.selectText = function(start, end){
        var i;
        if(start == undefined){
            start = textSelection.start;
        }
        if(end == undefined){
            end = textSelection.end;
        }


        // Swap the start and end if they're out of order.
        if(start > end){
            var tmp = start;
            start = end;
            end = tmp;
        }

        // Deselect only tokens not in the current selection, then
        // select tokens in the current selection that aren't already marked up
        // in the DOM.
        var selectFn = function($token, tokenId, isWhitespace){
            $token.addClass('selected');
            if(tokenId == start){
                $token.addClass('selection-start');
            }
            if(tokenId == end) {
                $token.addClass('selection-end');
            } 
        };
        var prevStart = Math.min(textSelection.start, textSelection.end);
        var prevEnd = Math.max(textSelection.start, textSelection.end);

        self.clearSelection(textSelection, {start: start, end: end});
        if(start < prevStart) {
            self.$textPanel.find('.selection-start').removeClass('selection-start');
            self.tokenManager.iterateOverTokens(self.$textPanel, start, 
                Math.min(end, prevStart), selectFn);
        }
        if(end > prevEnd){
            self.$textPanel.find('.selection-end').removeClass('selection-end');
            self.tokenManager.iterateOverTokens(self.$textPanel, 
                Math.max(start, prevEnd), end, selectFn);

        }
    };

    /**
     * Clears any existing text selections and begins a new selection; makes the
     * current token the selection.
     *
     * @param {Event} event The mousedown DOM event.
     */
    var onMouseDownOnToken = function(event){
        console.log('in onMouseDownOnToken', textSelectionInProgress, textSelection);

        var $elm = $(this);
        var id;

        if($elm.hasClass('whitespace')){
            $elm = $elm.next('.token');
        }

        id = parseInt($elm.attr('data-token'));
        textSelectionInProgress = true;
        textSelection = {
            start: id,
            end: id
        };
        self.selectText(id, id);
    };

    /**
     * Ends text selection -- iff one is in progress -- and emits a
     * text-panel.token-selection event along with the id of the starting and
     * ending tokens in the selection and the (x,y) (client) coordinates of the
     * mouse location when the selection ended.
     *
     * @param {Event} event The mouseup DOM event.
     */
    var onMouseUpOnToken = function(event){
        console.log('in onMouseUpOnToken', textSelectionInProgress, textSelection, event);

        if(!textSelectionInProgress){ return; }

        textSelectionInProgress = false;

        var orderedSelection = {
            start: Math.min(textSelection.start, textSelection.end),
            end: Math.max(textSelection.start, textSelection.end),
        };

        $(this).trigger('text-panel.token-selection', [
            orderedSelection, 
            {x: event.originalEvent.clientX, y: event.originalEvent.clientY}
        ]);
    };

    /**
     * If currently in a selection, adds the current token to the selection. 
     * This does a check to ensure that the mouse is still down. If it's not,
     * the text selection is stopped. 
     * 
     * @param {Event} event The mousedown DOM event.
     */
    var onMouseEnterToken = function(event){
        console.log('in onMouseEnterToken', textSelectionInProgress, textSelection);

        if(event.buttons != 1){
            textSelectionInProgress = false;
            // TODO: trigger event that the selection has ended.
        }

        if(textSelectionInProgress){
            var $elm = $(this);
            if($elm.hasClass('whitespace')){
                $elm = $elm.next('.token');
            }

            var id = parseInt($elm.attr('data-token'));
            self.selectText(textSelection.start, id);
            textSelection.end = id;
        }
    };

    /**
     * Adds listeners for events to do with the text panel.
     */
    var addListeners = function(){
        // Add listener for mouse down events.
        self.$textPanel.on('mousedown', '.token,.whitespace', onMouseDownOnToken);
        // Add listener for enter events over tokens (check for mouse down).
        self.$textPanel.on('mouseenter', '.token,.whitespace', onMouseEnterToken);
        // Add listener for mouse up events.
        self.$textPanel.on('mouseup', '.token,.whitespace', onMouseUpOnToken);

        // Clear selection on clicks on other things.
        self.$textPanel.on('mousedown', function(event){
            var $originalTarget = $(event.originalTarget);
            if(!$originalTarget.hasClass('token') && !$originalTarget.hasClass('whitespace')){
                self.clearSelection();
            }
        });
    };

    /**
     * Initializes the instance, including adding listeners.
     */
    var initialize = function(){
        addListeners();
        self.tokenManager = TextPanel.TokenManager(self);
        self.contextMenuManager = TextPanel.ContextMenuManager(self);
    }

    initialize();

    return self;
};