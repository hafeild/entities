var timeoutId;
var currentTextId = null;
var annotation_data = null;
var annotationManager = null;

var menuConfigData = {
    textSpans: null,
    newGroupId: null,
    selectedMentions: [],
    recentSelectedEntityId: null,
    recentSelectedEntity: null,
    selectedEntities: [],
    numSelectedEntities: 0,
    selectedGroups: [],
    numSelectedGroups: 0,
    tieObjectOne: null,
    tieObjectTwo: null,
    tieMentionHoveredOne: null,
    tieMentionHoveredTwo: null
};
var menuOpen = 0;
var menu;
var mouseClicked = 0;
var menuTimer = null;

var getTexts = function(){
    $.get({
        url: 'json/texts',
        success: function(data){
            $('#response').html(JSON.stringify(data, null, 4));

            if(data.success){
                var textListDiv = $('#text-list');
                var textListElm = $('<ul>');
                textListDiv.html('');
                textListDiv.append(textListElm);

                var i;
                for(i = 0; i < data.texts.length; i++){
                    var text = data.texts[i];
                    textListElm.append('<li>'+
                        '<a href="#" class="onpage" data-id="'+ text.id +'">'+
                        text.title +'</a> (processed: '+ 
                        ((text.processed+'' == '1') ? 'yes' : 'no') +')'+
                        '</li>');
                }
            }
        }
    });
};

var upload = function(event){
    console.log('Uploading form data...');

    $.post({
        url: 'json/texts', 
        data: new FormData($('#file-upload-form')[0]),
        success: function(data){
            $('#response').html(JSON.stringify(data, null, 4));

            console.log(data.success, data.additional_data.id !== undefined);
            // Keep fetching info about the book until it says that
            // it's been processed.
            if(data.success || data.additional_data.id !== undefined){
                pollTextStatus(data.additional_data.id);
            }
        },
        error: function(jqXHR, textStatus, errorThrown){
            $('#response').html('ERROR: '+ errorThrown);
        },
        dataType: 'json',
        processData: false,
        contentType: false
    });

    event.preventDefault();
};

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

var size = function(obj){
    var s = 0;
    for(var x in obj) s++;
        return s;
}

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



var addAnnotation = function(){
    if(currentTextId == null) return;

    console.log(`json/texts/${currentTextId}/annotations`);

    $.post({
        url: `json/texts/${currentTextId}/annotations`,
        success: function(data){
            console.log(data);
            $('#response').html(JSON.stringify(data, null, 4));
        },
        error: function(jqXHR, textStatus, errorThrown){
            console.log(errorThrown);
            $('#response').html('ERROR: '+ errorThrown);
        }
    });
};

var getAnnotations = function(){
    console.log(`json/annotations`);

    $.get({
        url: `json/annotations`,
        success: function(data){
            console.log(data);
            $('#response').html(JSON.stringify(data, null, 4));
            $('#annotation-list').html('');
            var annotationList = $('<ul>');
            annotationList.appendTo('#annotation-list');
            if(data.success){
                var i;
                for(i = 0; i < data.annotations.length; i++){
                    var a = data.annotations[i];
                    $(`<li>(${a.annotation_id}) ${a.title} annotated by `+
                        `${a.username} <button class="get-annotation" `+
                        `data-id="${a.annotation_id}">load `+
                        `annotation</button></li>`).appendTo(annotationList);
                }
            }

        },
        error: function(jqXHR, textStatus, errorThrown){
            console.log(errorThrown);
            $('#response').html('ERROR: '+ errorThrown);
        }
    });
};


var selectAllInGroup = function(){
    if($(this).parents('.group').find('input:checked').length > 0){
        $(this).parents('.group').find('input').prop('checked', false);
    } else {
        $(this).parents('.group').find('input').prop('checked', true);
    }
};

var loadText = function(){
    pollTextStatus($(this).data('id'));
};

var showPage = function(){
    var page = window.location.hash;
    if(page == "" || page == "#"){
        page = "#texts";
    }

    $('.page').hide();
    $(`${page}.page`).show();
};

////////////////////////////////////////////////////////////////////////////////
// TEXT CONTENT FUNCTIONS
////////////////////////////////////////////////////////////////////////////////

const TOKEN_CONTENT = 0;
const WHITESPACE_AFTER = 1;
const START = 0;
const END = 1;
const IS_DISPLAYED = 2;
const PAGE_SIZE = 700;
const TOKEN_MARGIN = 200; // Where to start looking for a newline.
var contentPages = []; // tuples: [startIndex, endIndex, isDisplayed]
var currentPage = 0;
var locationsByPages = [];


/**
 * Processes the tokenized content (made available in the annotation view HTML,
 * just below the #text-panel element). This includes splitting it into pages of
 * roughly PAGE_SIZE (plus or minus TOKEN_MARGIN) and then rendering the first
 * few pages with annotations highlighted.
 *
 * Token ranges for pages are held in the global `contentPages`, which consists
 * of an array of 3-tuples [startIndex, endIndex, isDisplayed]. The index is the
 * page number, starting at 0.
 *
 * This function also initializes the global `locationsByPages` array, each
 * element of which is the subset of keys in the
 * `annotation_data.annotation.locations` object. The index corresponds to the
 * content page index and aligns with `contentPages`. A location is considered a
 * part of a page if either its start or end location falls within the bounds of
 * the page: [startIndex, endIndex].
 *
 * Places listeners for when the content is scrolled and new content is needed.
 */
var initializeTokenizedContent = function(){
    // Split into pages.
    contentPages = [];
    var pageStart = 0;
    var tokenIndex = Math.min(pageStart+PAGE_SIZE-TOKEN_MARGIN, tokens.length-1);
    var locationKey, i;

    while(tokenIndex < tokens.length){
        if(tokenIndex === tokens.length-1 || 
            tokens[tokenIndex][1].indexOf("\n") != -1) {

            contentPages.push([pageStart, tokenIndex, false]);
            // Initialize the list of locations for this page.
            locationsByPages.push([]); 

            pageStart = tokenIndex+1;
            tokenIndex = pageStart + PAGE_SIZE - TOKEN_MARGIN;

        } else if(tokenIndex === (pageStart + PAGE_SIZE + TOKEN_MARGIN)){
            contentPages.push([pageStart, pageStart+PAGE_SIZE, false]);
            // Initialize the list of locations for this page.
            locationsByPages.push([]);

            pageStart = pageStart+PAGE_SIZE+1;
            tokenIndex = pageStart + PAGE_SIZE - TOKEN_MARGIN;

        } else {
            tokenIndex++;
        }
    }

    // Find the locations specific to each page.
    for(locationKey in annotation_data.annotation.locations){
        // Find range of pages containing this location.
        var pageIndexes = findPageWithLocation(annotation_data.annotation.locations[locationKey]);
        var i;

        // If a page isn't found, skip the location.
        if(pageIndexes[0] == -1 && pageIndexes[1] == -1){
            continue;
        }

        // Add the location key to each page that the location spans.
        for(i = pageIndexes[0]; i <= pageIndexes[1]; i++){
            locationsByPages[i].push(locationKey);
        }
    }

    // Set listeners for when the end of a page is reached.
    $('#text-panel').on('scroll', null, (event)=>{
        elementIsVisibleInTextPanel(event, $('#end-marker'), ($elm) => {
            appendContentPage(currentPage+1);
        });
    });

    // Display the first page.
    appendContentPage(0);
};

/**
 * Performs a binary search over content pages to find which pages a location
 * spans.
 * 
 * @param {Object} location An entry from annotation_data.locations; should
 *                          consist of at least `start` and `end` keys, which 
 *                          are the starting and ending index of the tokens 
 *                          the location spans.
 * @return A 2-tuple containing the starting and ending indexes of the pages the
 *         given location spans, inclusive. If not found, [-1,-1] is returned.
 */
var findPageWithLocation = function(location) {
    var min = 0, max = contentPages.length, mid = Math.floor((min+max)/2);
    var firstPage, lastPage;

    while(max >= min && contentPages[mid] !== undefined){
        var pageStart = contentPages[mid][START], 
        pageEnd = contentPages[mid][END];

        if(location.start >= pageStart && location.start <= pageEnd ||
            location.end >= pageStart && location.end <= pageEnd){

            firstPage = mid;
            while(firstPage >= 0 && 
                    location.start < contentPages[firstPage][START]){
                firstPage--;
            }
            lastPage = mid;
            while(lastPage < contentPages.length && 
                    location.end >= contentPages[lastPage][START]){
                lastPage++;
            }

            return [firstPage, lastPage-1];

        } else if(location.start > pageEnd) {
            min = mid+1;
            mid = Math.floor((min+max)/2);
        } else {
            max = mid-1;
            mid = Math.floor((min+max)/2);
        }
    }

    return [-1,-1];
};


/**
 * Generates the HTML for the given page of tokens an appends it to the
 * #text-panel element, before the #end-marker element.
 * 
 * @param {integer} pageIndex The index of the page to append to the #text-panel.
 */
 var appendContentPage = function(pageIndex) {
     if(contentPages[pageIndex][IS_DISPLAYED]) return;

     var html = `<span data-page="${pageIndex}" class="content-page">`+ 
     tokensToHTML(contentPages[pageIndex][START], 
         contentPages[pageIndex][END]
         ) +'</span>';
     contentPages[pageIndex][IS_DISPLAYED] = true;

     currentPage = pageIndex;

     var $newPageElm = $(html);
     $('#end-marker').before($newPageElm);

    // Highlight locations for this page.
    highlightEntitiesInContent(locationsByPages[pageIndex], $newPageElm);
    highlightTiesInContent(contentPages[pageIndex][START], 
        contentPages[pageIndex][END], $newPageElm, annotationManager.ties);
}

/**
 * Returns a string of HTML in which each token in the given range is wrapped in
 * a span tag with the data-token attribute set to the token's id (index + 1).
 * &, <, and > are replaced with HTML entities. Whitespace is not converted to
 * HTML entities (so \n is \n, not <br/>).
 * 
 * @param {integer} startIndex The index of the token at the start of the range.
 * @param {integer} endIndex The index of the token at the end of the range.
 * @return The HTML of tokens in the given range.
 */
 var tokensToHTML = function(startIndex, endIndex) {
     var html = "";
     for(var i = startIndex; i <= endIndex; i++){
        /*
        html += `<span data-token="${i}">`+ 
         tokens[i][TOKEN_CONTENT].replace("&", "&amp;").
         replace("<", "&lt;").
         replace(">", "&gt;") +
         '</span><span>'+ tokens[i][WHITESPACE_AFTER] +"</span>";
        */
         html += `<span data-token="${i}">`+ 
         tokens[i][TOKEN_CONTENT].replace("&", "&amp;").
         replace("<", "&lt;").
         replace(">", "&gt;") +
         '</span>';
         if (tokens[i][WHITESPACE_AFTER] === "\n") {
            html += '<span> </span>';
         } else {
            html += '<span>'+ tokens[i][WHITESPACE_AFTER] + '</span>';
         }
     }
     return html;
 };

/**
 * Tests if the given element is visible in the #text-panel element.
 * 
 * @param {Event} event The DOM scroll event that triggered this listerner.
 * @param {jQuery Element} $element The element to test.
 * @param {function(jQuery element)} The function to invoke when a visible
 *                                   element is found. Should take a jQuery
 *                                   element (the match) as its only argument.
 */
 var elementIsVisibleInTextPanel = function(event, $element, onMatch){
     var textPanelTop = 0;
     var textPanelBottom = textPanelTop + $('#text-panel-wrapper').height();
     var elmScrollTop = $element.position().top;
     var elmScrollBottom = elmScrollTop + $element.height();
     if((elmScrollTop >= textPanelTop && elmScrollTop <= textPanelBottom) ||
         (elmScrollTop < textPanelTop && elmScrollBottom > textPanelTop)){

         onMatch($element);
 }
}

/**
 * Iterates over each token span between a starting and ending token id in the
 * given element, including whitespace. The provided function `func` is invoked
 * for each element.
 * 
 * @param {jQuery Element} $element The element to highlight entities in.
 * @param {integer} start The index of the first token to iterate over.
 * @param {integer} end The index of the last token to iterate over.
 * @param {function($token, tokenId, isWhitespace)} func 
 *                      The function to apply to each token. Should accept three
 *                      parameters:
 *                      {jQuery Element} $token The current token.
 *                      {integer} tokenId The id of the current token.
 *                      {boolean} isWhitespace True if the token is whitespace.
 *                      A return value of false will cause the iterator to exit.
 */
var iterateOverTokens = function($element, start, end, func){
    var $token = $element.find(`[data-token=${start}]`);
    var tokenId = parseInt($token.attr('data-token')) || -1;
    var prevTokenId = tokenId;

    // Moves down each token in the location, including the spaces.
    while($token.length > 0 && 
        ((!$token.attr('data-token') && prevTokenId != end) || 
        (tokenId >= start && tokenId <= end))){

        if(func($token, tokenId, !$token.attr('data-token'))){ 
            break; 
        }

        // If we're still in the current content page.
        if($token[0].nextSibling !== null){
            $token = $($token[0].nextSibling);

        // If there's a next content page.
        } else if($token[0].parentElement.nextSibling !== null){
            $token = $($token[0].parentElement.nextSibling.firstChild);

        // We're at the end of content pages.
        } else {
            break;
        }

        prevTokenId = tokenId;
        tokenId = parseInt($token.attr('data-token')) || -1;
    }
}

var getIntDataAttribute = function($elm, attribute){
    var value = $elm.attr(`data-${attribute}`);
    return parseInt(value ? value :'0');
}

var incrementDataAttribute = function($elm, attribute, incrementValue){
    if(incrementValue === undefined){ 
        incrementValue = 1; 
    }
    $elm.attr(`data-${attribute}`, getIntDataAttribute($elm, attribute) + 
        incrementValue);
}

/**
 * Highlights entities in the given text content element. Tokens in the given
 * element must contain an data-id="..." attribute with the token's id. Colors
 * are chosen by the global pallet. This relies on the global `annotation_data`
 * variable being properly initialized and maintained.
 *
 * @param {string[]} locationKeys A list of the location keys specific to the
 *                                $element.
 * @param {jQuery Element} $element The element to highlight entities in.
 */
 var highlightEntitiesInContent = function(locationKeys, $element){
    // This is just to test things quick and dirty.
    var i, j, location, $token, tokenId, prevTokenId;
    for(i = 0; i < locationKeys.length; i++){
        location = annotation_data.annotation.locations[locationKeys[i]];

        if(!location){
            console.log("location null; locationKeys:", locationKeys, "i:", i);
        }

        var entityGroupId = annotation_data.annotation.
            entities[location.entity_id].group_id;
        

        // Moves down each token in the location, including the spaces.
        iterateOverTokens($element, location.start, location.end, 
            function($token, tokenId, isWhitespace){

            $token.
                addClass(`g${entityGroupId}`). 
                addClass('entity').
                addClass('annotated-entity').
                attr({
                    'data-entity-id': location.entity_id,
                    'data-group-id': entityGroupId,
                    'data-location-id': locationKeys[i]  
                });
            // incrementDataAttribute($token, 'entity-count');

            // Special treatment for the first and last tokens.
            if(tokenId == location.start){
                $token.addClass('start-token');
                // incrementDataAttribute($token, 'start-token-count');
            }
            if(tokenId == location.end){
                $token.addClass('end-token');j
                // incrementDataAttribute($token, 'end-token-count');
            }
        });
   }
}

/**
 * Highlights ties in the given text content element. This relies on the global
 * `annotation_data` variable being properly initialized and maintained.
 *
 * @param {number} tokenStartIndex The id of the first token in $element.
 * @param {number} tokenEndIndex The id of the last token in $element.
 * @param {jQuery Element} $element The element to highlight ties in.
 * @param {object} ties A map of tie ids to ties objects; only these ties will 
 *                      be highlighted.
 */
 var highlightTiesInContent = function(tokenStartIndex, tokenEndIndex, $element, 
    ties){
    //var ties = annotation_data.annotation.ties;
    // console.log(annotation_data.annotation);

    for(tieId in ties){
        var tie = ties[tieId];

        // Skip this tie if it is not part of this element.
        if(tie.start > tokenEndIndex || tie.end < tokenStartIndex){ continue; }



        iterateOverTokens($element, Math.max(tie.start, tokenStartIndex), 
            Math.min(tie.end, tokenEndIndex),   
            function($token, tokenId, isWhitespace){
                // Skip entity tokens.
                if($token.hasClass('entity')){ return; }

                if(!$token.attr('tie-refs')) {
                    $token.attr('tie-refs', "");
                    $token.attr('data-tie-ref-count', '0');
                } 

                if (!$token.attr(`data-tie_${tieId}`)) {
                    $token.attr('tie-refs', $token.attr('tie-refs')+tieId+" ").
                           attr(`data-tie_${tieId}`, '1').
                           addClass('tie-text');

                    incrementDataAttribute($token, 'tie-ref-count');
                }

            });
    };
}



////////////////////////////////////////////////////////////////////////////////
// MANUAL ANNOTATION MANIPULATION FUNCTIONS
////////////////////////////////////////////////////////////////////////////////


var existingEntityClicked = function(event) {
    // var clickedEntity = $(this).find('.entity');
    var clickedEntity = $(this);
    var entityId = clickedEntity.attr('data-entity-id');
    var groupId = clickedEntity.attr('data-group-id');

    if (clickedEntity.hasClass('selectedEntity')) {
        deselectEntity(clickedEntity);
        menuConfigData.selectedGroups.splice(menuConfigData.selectedGroups.indexOf(groupId), 1);
        menuConfigData.selectedMentions.splice(menuConfigData.selectedMentions.indexOf(clickedEntity.attr('data-location-id')), 1);

        // Uncheck the checkbox
        $('[data-id=' + groupId + ']').filter('li').find('input').filter('[data-id=' + entityId + ']').prop('checked', 0);

        updateSelectionInfoBox();
        return;
    }

    selectEntity(clickedEntity);
    menuConfigData.selectedGroups.push(groupId);
    menuConfigData.selectedMentions.push(clickedEntity.attr('data-location-id'));

    // Find entity in group list
    // Check the checkbox
    $('[data-id=' + groupId + ']').filter('li').find('input').filter('[data-id=' + entityId + ']').prop('checked', 1);

    var contextMenuOptions = [];

    contextMenuOptions.push("<li class='context-menu__item hover-option thisMentionHover'><a class='context-menu__link'><i>This Mention \></i></a></li>");
    contextMenuOptions.push("<li class='context-menu__item hover-option thisEntityHover'><a class='context-menu__link'><i>This Entity \></i></a></li>");
    contextMenuOptions.push("<li class='context-menu__item hover-option thisGroupHover'><a class='context-menu__link'><i>All Aliases \></i></a></li>");
    if (menuConfigData.numSelectedEntities > 1) {
        contextMenuOptions.push("<li class='context-menu__item hover-option selectedHover'><a class='context-menu__link'><i>Selected \></i></a></li>");
    }
    
    openContextMenu(contextMenuOptions, clickedEntity, event);
    updateSelectionInfoBox();
}


function selectEntity(entity) {
    entityId = entity.attr('data-entity-id');
    menuConfigData.numSelectedEntities++;
    menuConfigData.recentSelectedEntityId = entityId;
    menuConfigData.recentSelectedEntity = entity;
    menuConfigData.selectedEntities.push(entityId);

    if (entity.hasClass('entity')) {
        $('[data-location-id="' + entity.attr('data-location-id') + '"]').each(function() {
            $(this).addClass('selectedEntity');
        });
    }
}

function deselectEntity(entity) {
    entityId = entity.attr('data-entity-id');
    // Remove entity from selection list
    menuConfigData.numSelectedEntities--;
    menuConfigData.selectedEntities.splice(menuConfigData.selectedEntities.indexOf(entityId), 1);
    menuConfigData.recentSelectedEntity = null;
    menuConfigData.recentSelectedEntityId = null;

    if (entity.hasClass('entity')) {
        $('[data-location-id="' + entity.attr('data-location-id') + '"]').each(function() {
            $(this).removeClass('selectedEntity');
        });
    }
}

var checkSelectedText = function(event) {
    // if nothing is selected, return
    if (window.getSelection().toString() == "" || $('.modal').is(':visible')) return;

    var textSpans = [];
    var textSpans = getSelectedSpans();

    if (textSpans.length < 1) {
        return;
    } 

    // get unused group ID
    var newGroupID = Object.keys(annotation_data.annotation.groups).length + 1;

    var contextMenuOptions = [];

    contextMenuOptions.push("<li class='context-menu__item'><a class='context-menu__link addEntityOption'><i><span id=\"addEntity\">Add Entity</span></i></a></li>");
    contextMenuOptions.push("<li class='context-menu__item'><a class='context-menu__link addMentionOption'><i><span id=\"addMention\">Add Mention</span></i></a></li>");
    contextMenuOptions.push("<li class='context-menu__item'><a class='context-menu__link addTieOption'><i><span id=\"addTie\">Add Tie</span></i></a></li>");

    menuConfigData.textSpans = textSpans;
    menuConfigData.newGroupID = newGroupID;

    openContextMenu(contextMenuOptions, null, event);
}

function getSelectedSpans() {
    var startSpan;
    var endSpan;
    var spans = [];
    var spanCount = 0;

    sel = window.getSelection();
    
    if (typeof sel.anchorNode.nodeValue === typeof null || typeof sel.anchorNode.nodeValue === typeof undefined
        || typeof sel.focusNode.nodeValue === typeof null || typeof sel.focusNode.nodeValue === typeof undefined) {return [];}

    if (sel.anchorNode.nodeValue.trim() == "") {
        startSpan = $(sel.anchorNode.parentElement).prev()[0];
    } else {
        startSpan = sel.anchorNode.parentElement;
    }
    if (sel.focusNode.nodeValue.trim() == "") {
        endSpan = $(sel.focusNode.parentElement).prev()[0];
    } else {
        endSpan = sel.focusNode.parentElement;
    }

    if (!$(startSpan).is('span') || !$(endSpan).is('span') || !$(startSpan).parent().hasClass('content-page') || !$(endSpan).parent().hasClass('content-page')) {
        return [];
    }

    if (Number($(startSpan).attr('data-token')) > Number($(endSpan).attr('data-token'))) {

        var temp = startSpan;
        startSpan = endSpan;
        endSpan = temp;
    } 

    if (startSpan === endSpan) {
        spans = [];
        spans.push(startSpan);
        return spans;
    }

    var current;
    // for every <span> in text area
    $('.content-page').children('span').each(function() {
        current = $(this)[0];
        // if still searching for starting span
        if (spanCount == 0) {
            if (current === startSpan) {
                // add starting span
                spans[spanCount] = startSpan;
                spanCount++;
            }
        // if starting span has already been found
    } else {
            // if current is not last span selected
            if (!(current === endSpan)) {
                spans[spanCount] = current;
                spanCount++;
            }
            // if current IS last span selected
            else {
                spans[spanCount] = endSpan;
                // quit each loop
                return false;
            }
        }
    });

    return spans;
}

var deselectAllText = function() {
    window.getSelection().removeAllRanges();
    // maybe do some more stuff here later
}

var groupListCheckboxClicked = function() {
    if ($(this).is(":checked")) {
        selectEntity($('[data-entity-id="' + $(this).attr("data-id") + '"]'));
    } else {
        deselectEntity($('[data-entity-id="' + $(this).attr("data-id") + '"]'));
    }
}

var openContextMenu = function(options, clickedEntity, event) {
    if (options === null || options === undefined) return;

    var active = "context-menu--active";

    $('.context-menu__items').empty();
    var contextMenu = $('.context-menu__items');

    // add menu options to menu
    options.forEach(function(entry) {
        contextMenu.html(contextMenu.html() + entry);
    });

    if (!$(menu).hasClass(active)) {

        if (clickedEntity === null || clickedEntity === undefined) {
            var menuPosition = getPositionForMenu(event);
        } else {
            var menuPosition = getPositionForMenu(event, clickedEntity);
        }

        menu.classList.add(active);

        // Coordinates
        menu.style.left = menuPosition.x + "px";
        menu.style.top = menuPosition.y + "px";

        // Dimensions
        var menuWidth = menu.offsetWidth;
        var menuHeight = menu.offsetHeight;

        $(document).trigger('entities.context-menu-opened', 
            {contents: contextMenu.html()});


        return false;
    } else {
        closeContextMenu();
        return;
    }
}

var openTieContextMenu = function(e) {
    var contextMenuOptions = [];

    var tieRefs = $(this).attr('tie-refs');
    if (tieRefs === undefined || tieRefs === null) {return;}
    tieRefs = tieRefs.trim().split(' ');

    tieRefs.forEach(function(tieRef) {
        var tie = annotation_data.annotation.ties[tieRef];
        if(!tie){ return; }

        // get names of entities involved in tie
        if (typeof tie.source_entity.entity_id !== typeof null && typeof tie.source_entity.entity_id !== typeof undefined) {
            var entityNameOne = annotation_data.annotation.entities[tie.source_entity.entity_id].name;
        } else {
            var entityNameOne = annotation_data.annotation.entities[annotation_data.annotation.locations[tie.source_entity.location_id].entity_id].name;
        }
        if (typeof tie.target_entity.entity_id !== typeof null && typeof tie.target_entity.entity_id !== typeof undefined) {
            var entityNameTwo = annotation_data.annotation.entities[tie.target_entity.entity_id].name;
        } else {
            var entityNameTwo = annotation_data.annotation.entities[annotation_data.annotation.locations[tie.target_entity.location_id].entity_id].name;
        }
        contextMenuOptions.push("<li class='context-menu__item hover-option tieHover' tie-ref='" + tieRef + "'><a class='context-menu__link'><i> "
            + entityNameOne + " --\> " + entityNameTwo + " \></i></a></li>");
    });

    openContextMenu(contextMenuOptions, null, e);
}

var closeContextMenu = function() {
    
    // unhighlight previously highlighted tie mentions if they exist
    if (menuConfigData.tieMentionHoveredOne !== null || menuConfigData.tieMentionHoveredOne !== undefined) {
        $('[data-location-id="' + menuConfigData.tieMentionHoveredOne + '"]').removeClass('selectedEntity');
        $('[data-location-id="' + menuConfigData.tieMentionHoveredTwo + '"]').removeClass('selectedEntity');
        menuConfigData.tieMentionHoveredOne = null;
        menuConfigData.tieMentionHoveredTwo = null;
    }
    if (window.getSelection() == "" && !($(event.target).hasClass('entity')) && 
        !($(event.target).hasClass('context-menu__link')) && !($(event.target).hasClass('context-menu__item'))) {
        menuOpen = 0;
        menu.classList.remove("context-menu--active");

        $('.context-menu__items').html("");

        $(document).trigger('entities.context-menu-closed');

        closeHoverMenu();
    }
}

var startHoverMenuTimer = function(e) {
    if (typeof menuTimer === typeof null || typeof menuTimer === typeof undefined) { 
        menuTimer = setTimeout(openHoverMenu, 150, $(e.target).parent());
    }
}

var clearHoverMenuTimer = function(e) {
    if (menuConfigData.tieMentionHoveredOne === null || menuConfigData.tieMentionHoveredOne === undefined) {
        // unhighlight what's highlighted by hover menu
        $('.selectedEntity').each(function() {
            $(this).removeClass('selectedEntity');
        })

        // rehighlight what was specifically clicked
        menuConfigData.selectedMentions.forEach(function(m) {
            $('[data-location-id="' + m + '"]').each(function() {
                $(this).addClass('selectedEntity');
            });
        }) 
    }
    
    if (typeof menuTimer === typeof null || typeof menuTimer === typeof undefined) { return; }
    clearTimeout(menuTimer);
    menuTimer = null;
}

var openHoverMenu = function(hoverOption) {
    if (!hoverOption.hasClass('tieHover') && (menuConfigData.recentSelectedEntity === null || menuConfigData.recentSelectedEntity === undefined)) {
        return;
    }

    var entity = menuConfigData.recentSelectedEntity;

    var hoverMenu = $('.context-menu-hover');
    var hoverMenuItems = $('.context-menu-hover').find('.context-menu__items');
    var options = [];
    var locationMultiplier = 1;

    if (!hoverOption.hasClass('tieHover')) {
        // unhighlight everything, preparing for more specific highlighting
        $('[data-group-id="' + entity.attr('data-group-id') + '"]').each(function() {
            $(this).removeClass('selectedEntity');
        });
    }

    // base locationMultiplier off of number of context menu options
    $(hoverOption.parent()).children().each(function() {
        if (!hoverOption.is($(this))) {locationMultiplier++;}
        else {return false;}
    });

    if (hoverOption.hasClass('thisMentionHover')) {
        options.push("<li class='context-menu__item deleteMentionOption'><a class='context-menu__link'><i><span id=\"deleteMention\">Delete</span></i></a></li>");
        options.push("<li class='context-menu__item reassignMentionOption'><a class='context-menu__link'><i><span id=\"reassignMention\">Reassign</span></i></a></li>");

        $('[data-location-id="' + entity.attr('data-location-id') + '"]').addClass('selectedEntity');
    }
    else if (hoverOption.hasClass('thisEntityHover')) {
        options.push("<li class='context-menu__item deleteEntityOption'><a class='context-menu__link'><i><span d=\"deleteEntity\">Delete</span></i></a></li>");
        options.push("<li class='context-menu__item moveEntityToGroupOption'><a class='context-menu__link'><i><span id=\"moveEntityToGroup\">Move to Group</span></i></a></li>");

        $('[data-entity-id="' + entity.attr('data-entity-id') + '"]').each(function() {
            $(this).addClass('selectedEntity');
        });
    }
    else if (hoverOption.hasClass('thisGroupHover')) {
        options.push("<li class='context-menu__item deleteGroupOption'><a class='context-menu__link'><i><span id=\"deleteGroup\">Delete</span></i></a></li>");
        options.push("<li class='context-menu__item changeGroupNameOption'><a class='context-menu__link'><i><span id=\"changeGroupName\">Change Group Name</span></i></a></li>");

        $('[data-group-id="' + entity.attr('data-group-id') + '"]').each(function() {
            $(this).addClass('selectedEntity');
        });
    }
    else if (hoverOption.hasClass('selectedHover')) {
        if (menuConfigData.numSelectedEntities > 1) {
            options.push("<li class='context-menu__item groupEntitiesOption'><a class='context-menu__link'><i>Group Entites</i></a></li>");
        }
        if (menuConfigData.selectedGroups.length > 1) {
            options.push("<li class='context-menu__item combineSelectedGroupsOption'><a class='context-menu__link'><i><span id=\"combineSelectedGroups\">Combine Groups Here</span></i></a></li>");
            options.push("<li class='context-menu__item deleteSelectedGroupsOption'><a class='context-menu__link'><i><span id=\"deleteSelectedGroups\">Delete Selected Groups</span></i></a></li>");
        }

        menuConfigData.selectedGroups.forEach(function(g) {
            $('[data-group-id="' + g + '"]').each(function() {
                $(this).addClass('selectedEntity');
            });
        });
    }
    else if (hoverOption.hasClass('tieHover')) {
        options.push("<li class='context-menu__item editTieOption' tie-ref='" + hoverOption.attr('tie-ref') + "'><a class='context-menu__link'><i><span id=\"editTie\">Edit Tie</span></i></a></li>");
        options.push("<li class='context-menu__item deleteTieOption' tie-ref='" + hoverOption.attr('tie-ref') + "'><a class='context-menu__link'><i><span id=\"deleteTie\">Delete Tie</span></i></a></li>");


        // unhighlight previously highlighted mentions if they exist
        if (menuConfigData.tieMentionHoveredOne !== null || menuConfigData.tieMentionHoveredOne !== undefined) {
            $('[data-location-id="' + menuConfigData.tieMentionHoveredOne + '"]').removeClass('selectedEntity');
            $('[data-location-id="' + menuConfigData.tieMentionHoveredTwo + '"]').removeClass('selectedEntity');
        }
        menuConfigData.tieMentionHoveredOne = annotation_data.annotation.ties[hoverOption.attr('tie-ref')].source_entity.location_id;
        menuConfigData.tieMentionHoveredTwo = annotation_data.annotation.ties[hoverOption.attr('tie-ref')].target_entity.location_id;
        // highlight mentions if they exist
        $('[data-location-id="' + menuConfigData.tieMentionHoveredOne + '"]').addClass('selectedEntity');
        $('[data-location-id="' + menuConfigData.tieMentionHoveredTwo + '"]').addClass('selectedEntity');
    }

    hoverMenuItems.empty();
    options.forEach(function(entry) {
        hoverMenuItems.html(hoverMenuItems.html() + entry);
    });

    // Coordinates
    hoverMenu.css('left', parseInt(menu.style.left) + parseInt($(menu).css('width')));
    if (locationMultiplier === 1) {
        hoverMenu.css('top', parseInt(menu.style.top));
    } else {
        var heightOffset = $('.context-menu').height() / $('.context-menu > .context-menu__items > .context-menu__item').length;
        hoverMenu.css('top', parseInt(menu.style.top) + (heightOffset * locationMultiplier) - parseInt($('.context-menu').css('padding-top')) - parseInt($('.context-menu > .context-menu__items > .context-menu__item').css('margin-bottom')));
    }

    hoverMenu.addClass("context-menu--active");

    $(document).trigger('entities.hover-menu-opened', {contents: hoverMenu.html()});

}

var closeHoverMenu = function(e) {  
    var hoverMenu = $('.context-menu-hover');
    var hoverMenuItems = $('.context-menu-hover').find('.context-menu__items');

    hoverMenuItems.empty();

    hoverMenu.removeClass("context-menu--active");
    $(document).trigger('entities.hover-menu-closed');

}

function getPositionForMenu(e, clickedEntity) {
    if (clickedEntity == null) {
        // mouse position
        return {
            y: e.clientY,
            x: e.clientX
        }
    }

    var offset =  clickedEntity.offset();

    return {
        x: offset.left + clickedEntity.width(),
        y: offset.top + clickedEntity.height()
    };
}

var updateSelectionInfoBox = function(e) {
    function onlyUnique(value, index, self) { 
        return self.indexOf(value) === index;
    }

    $('#entityInfoBox').html(menuConfigData.selectedEntities.filter(onlyUnique).length + " entities selected");
    $('#mentionInfoBox').html(menuConfigData.selectedMentions.filter(onlyUnique).length + " mentions selected");
    $('#groupInfoBox').html(menuConfigData.selectedGroups.filter(onlyUnique).length + " alias groups selected");
}


////////////////////////////////////////////////////////////////////////////////
// CONTEXT MENU FUNCTIONS
////////////////////////////////////////////////////////////////////////////////

var makeEntityModalChecklist = function(groupId, entities, radioOptionName) {
    var list = `<li class="groups group unselectable" data-id="${groupId}">`, entityId, i,
    entitiesSize = size(entities);
    for(entityId in entities){
        list += `<div class="pretty p-default p-round p-smooth"><input type="radio" name="${radioOptionName}" class="group-checkbox" data-id="${entityId}" value="${entityId}"><div class="state p-primary"><i class="icon mdi mdi-check"></i><label><span class="g${groupId} unselectable">${entities[entityId].name}</span></label></div></div>`;
        if(i < entitiesSize-1){
            list += ', ';
        }
        i++;
    }
    list += '</li>';
    return list;
}

var openAddMentionModal = function() {
    if (menuConfigData.textSpans.length < 1) {
        return;
    }
    
    var $allEntitiesChecklist = $('#addMentionEntitySelectorChecklist');
    var $recentlyMentionedEntitiesDiv = $('#addMentionModal .recentlySeenWrapper');
    var $recentlyMentionedEntitiesChecklist = $recentlyMentionedEntitiesDiv.find('ul');
    $allEntitiesChecklist.empty();
    $recentlyMentionedEntitiesChecklist.empty();
    $recentlyMentionedEntitiesDiv.hide();

    // First, add the 10 most recently mentioned entities/groups (prior to the
    // selection). 
    var curToken = menuConfigData.textSpans[0];
    var groupsSeen = {};
    var groupsSeenOrdered = [];
    var count = 0, i;
    while(count < 10 && curToken !== null){
        if(curToken.hasAttribute('data-group-id')){
            var groupId = curToken.getAttribute('data-group-id');
            if(groupsSeen[groupId] === undefined){
                groupsSeen[groupId] = true;
                groupsSeenOrdered.push(groupId);
                count++;
            }
        }

        // We're still in the current content page.
        if(curToken.previousSibling !== null){
            curToken = curToken.previousSibling;

        // We might be at a content page border; move curToken to the end of the 
        // previous page.
        } else if(curToken.parentElement.getAttribute('data-page') !== '0') {
            curToken = curToken.parentElement.previousSibling.lastChild;

        // We've hit the beginning.
        } else {
           break;
        }
    }

    // This section will only be shown if there's at least one entity to list.
    if(count > 0){
        for(i = 0; i < count; i++){
            var groupId = groupsSeenOrdered[i];
            var group = annotationManager.groups[groupId];
            $recentlyMentionedEntitiesChecklist.append(makeEntityModalChecklist(groupId, group.entities, 'addMentionEntityRadioOption'));
        }
        $recentlyMentionedEntitiesDiv.show();
    }

    // Make a list of ALL the entities.
    for(groupId in annotationManager.groups){
        var group = annotationManager.groups[groupId];
        $allEntitiesChecklist.append(makeEntityModalChecklist(groupId, group.entities, 'addMentionEntityRadioOption'));
    }

    $('#addMentionModalOpener').click();
}

var confirmAddMention = function() {
    console.log("In confirmAddMention");

    var selectedEntity = $("input:radio[name='addMentionEntityRadioOption']:checked").val();

    if (selectedEntity === undefined) {
        return;
    }

    var spans = menuConfigData.textSpans;
    console.log(spans);

    // addMention(entityId, startingOffset, endingOffset, callback);
    annotationManager.addMention(selectedEntity, $(spans[0]).attr('data-token'), $(spans[spans.length-1]).attr('data-token'));

    resetMenuConfigData();
}

var openReassignMentionModal = function() {
    var $allEntitiesChecklist = $('#reassignMentionEntitySelectorChecklist');
    var $recentlyMentionedEntitiesDiv = $('#reassignMentionModal .recentlySeenWrapper');
    var $recentlyMentionedEntitiesChecklist = $recentlyMentionedEntitiesDiv.find('ul');
    $allEntitiesChecklist.empty();
    $recentlyMentionedEntitiesChecklist.empty();
    $recentlyMentionedEntitiesDiv.hide();

    // First, add the 10 most recently mentioned entities/groups (prior to the
    // selection). 
    console.log($('#text-panel [data-location-id='+ 
                        menuConfigData.selectedMentions[
                            menuConfigData.selectedMentions.length-1] +']'));
    var curToken = $('#text-panel [data-location-id='+ 
                        menuConfigData.selectedMentions[
                            menuConfigData.selectedMentions.length-1] +']')[0];
    var groupsSeen = {};
    var groupsSeenOrdered = [];
    var count = 0, i;
    while(count < 10 && curToken !== null){
        if(curToken.hasAttribute('data-group-id')){
            var groupId = curToken.getAttribute('data-group-id');
            if(groupsSeen[groupId] === undefined){
                groupsSeen[groupId] = true;
                groupsSeenOrdered.push(groupId);
                count++;
            }
        }

        // We're still in the current content page.
        if(curToken.previousSibling !== null){
            curToken = curToken.previousSibling;

        // We might be at a content page border; move curToken to the end of the 
        // previous page.
        } else if(curToken.parentElement.getAttribute('data-page') !== '0') {
            curToken = curToken.parentElement.previousSibling.lastChild;

        // We've hit the beginning.
        } else {
           break;
        }
    }

    // This section will only be shown if there's at least one entity to list.
    if(count > 0){
        for(i = 0; i < count; i++){
            var groupId = groupsSeenOrdered[i];
            var group = annotationManager.groups[groupId];
            $recentlyMentionedEntitiesChecklist.append(makeEntityModalChecklist(groupId, group.entities, 'reassignMentionEntityRadioOption'));
        }
        $recentlyMentionedEntitiesDiv.show();
    }

    for(groupId in annotationManager.groups){
        var group = annotationManager.groups[groupId];
        $allEntitiesChecklist.append(makeEntityModalChecklist(groupId, group.entities, 'reassignMentionEntityRadioOption'));
    }

    $('#reassignMentionModalOpener').click();
}

var confirmReassignMention = function() {
    console.log("In confirmReassignMention");

    var selectedEntity = $("input:radio[name='reassignMentionEntityRadioOption']:checked").val();

    if (selectedEntity === undefined) {
        return;
    }

    var selectedMention = menuConfigData.selectedMentions[menuConfigData.selectedMentions.length-1];

    // updateMention(locationId, {start: start, end: end, entity_id: entityId}, callback);
    annotationManager.updateMention(selectedMention, {
        start: annotation_data.annotation.locations[selectedMention].start,
        end: annotation_data.annotation.locations[selectedMention].end,
        entity_id: selectedEntity
    });

    resetMenuConfigData();
}

var addEntityFromSelection = function() {
    console.log("In addEntityFromSelection");
    closeContextMenu();
    
    if (menuConfigData.textSpans.length < 1) {
        return;
    }

    var spans = menuConfigData.textSpans;
    var name = "";

    spans.forEach(s => {
        name += s.innerHTML + " ";
        name += " ";
    })
    name = name.trim();

    // addEntity(name, startOffset, endOffset, groupID (optional), callback (optional));
    var entityId = annotationManager.addEntity(name, $(spans[0]).attr('data-token'), $(spans[spans.length-1]).attr('data-token'), null);

    resetMenuConfigData();
}

var openAddTieModal = function(e) {

    if (menuConfigData.textSpans.length < 1) { return; }

    tieModalTextArea = $('#tieModalTextArea');
    dropdownOne = $('#tieObjectOneSelector');
    dropdownTwo = $('#tieObjectTwoSelector');
    tieNameBox = $('#tieNameBox');
    tieWeightBox = $('#tieWeightBox');

    // Clear old modal body
    tieModalTextArea.empty();
    dropdownOne.empty();
    dropdownTwo.empty();
    tieNameBox.val("");
    tieNameBox.attr('placeholder', "").blur();
    $('#tieObjectOneDropdown').empty().html("Object One <span class='caret'></span>");
    $('#tieObjectTwoDropdown').empty().html("Object One <span class='caret'></span>");
    menuConfigData.tieObjectOne = null;
    menuConfigData.tieObjectTwo = null;

    // display n spans before and after selected spans
    var objectSearchWindowSize = 100;
    var curSearch = 0;
    var spanList = [];
    // start of spans to be displayed
    var startToken = parseInt($(menuConfigData.textSpans[0]).attr("data-token")) - objectSearchWindowSize/2;
    if (startToken < 1) { startToken = 1;}
    var curSpan = $("span[data-token=" + startToken.toString() + "]");
    var curSpanClone = null;

    // don't start on puncutative tokens
    while (curSpan.prev().prev() !== null && curSpan.prev().prev() !== undefined &&
           curSpan.prev().prev().length !== 0 && curSpan.prev().html().trim() !== "") {
                curSpan = curSpan.prev();
    }
    curSpan = curSpan.prev();
    while (curSearch < objectSearchWindowSize) {
        if (curSpan === null || curSpan === undefined || curSpan.length===0) { break; }
        if (typeof curSpan.attr('data-token') !== typeof undefined && typeof curSpan.attr('data-token') !== typeof null) {curSearch++;}
        // need to push clone to spanList but need original for DOM navigation
        curSpanClone = curSpan.clone();
        if (curSpan.html().trim() !== "" && parseInt(curSpan.attr('data-token')) >= parseInt($(menuConfigData.textSpans[0]).attr("data-token")) && parseInt(curSpan.attr('data-token')) <= parseInt($(menuConfigData.textSpans[menuConfigData.textSpans.length-1]).attr("data-token"))) {
            curSpanClone.css('color', '#ff2d50');
            curSpanClone.css('font-weight', 'bold');
            curSearch--;
            tieNameBox.attr('placeholder', tieNameBox.attr('placeholder') + curSpan.html() + " ").blur();
        }
        spanList.push(curSpanClone); 
        curSpan = curSpan.next();
    }
    curSpan = curSpan.prev();
    // don't end on punctuative tokens
    while (curSpan.next() !== null && curSpan.next() !== undefined &&
           curSpan.next().length !== 0) {
                spanList.push(curSpan.next().clone());
                if (curSpan.next().html().trim() === "") {break};
                console.log(curSpan.next());
                curSpan = curSpan.next();
    }

    // set tooltip of tie name box to show entire label
    tieNameBox.attr('title', tieNameBox.attr('placeholder'));

    // old method for pushing spans to text window
    /*
    for (var i = startToken; i <= endToken; i++) {
        if (i < 1) { break; }
        curSpan = $("span[data-token=" + i.toString() + "]").clone();
        if (i >= parseInt($(menuConfigData.textSpans[0]).attr("data-token")) && i <= parseInt($(menuConfigData.textSpans[menuConfigData.textSpans.length-1]).attr("data-token"))) {
            curSpan.addClass('text-primary');
            tieNameBox.attr('placeholder', tieNameBox.attr('placeholder') + curSpan.html() + " ").blur();
        }
        spanList.push(curSpan);
    }
    */

    var objects = [];
    var objectsAsString = "";
    var preselectOne = null;
    var preselectTwo = null;

    // don't start on a space
    if ($(spanList[0]).html().trim() === "") {
        spanList.splice(0, 1);
    }

    spanList.forEach(span => {
        tieModalTextArea.append(span.clone());
        if (span.hasClass('entity')) {
            if (parseInt(span.attr('data-token')) < parseInt($(menuConfigData.textSpans[0]).attr("data-token"))) {
                preselectOne = '<li class="tie-object list-group-item" data-location-id="' + span.attr('data-location-id') + '">' + 
                '<span class="unselectable">' + span.html() + '</span></li>';
            }
            if (parseInt(span.attr('data-token')) > parseInt($(menuConfigData.textSpans[0]).attr("data-token")) && preselectTwo === null) {
                preselectTwo = '<li class="tie-object list-group-item" data-location-id="' + span.attr('data-location-id') + '">' + 
                '<span class="unselectable">' + span.html() + '</span></li>';
            }
            objects.push('<li class="tie-object list-group-item" data-location-id="' + span.attr('data-location-id') + '">' + 
                '<span class="unselectable">' + span.html() + '</span></li>');
        }
    });

    objects.push("<li class='list-group-item disabled' style='text-align: center;'><span style='text-align: center;'>--- Entities ---</span></li>");

    for (entity in annotation_data.annotation.entities) {
        objects.push('<li class="tie-object list-group-item" data-entity-id="' + entity.toString() + '">' + 
                '<span class="unselectable">' + annotation_data.annotation.entities[entity].name + '</span></li>');
    }

    objectsAsString = objects.join("");
    dropdownOne.append(objectsAsString);
    dropdownTwo.append(objectsAsString);

    // preselect objects closest to selected text area, if they exist
    if (typeof preselectOne !== typeof null && typeof preselectOne !== typeof undefined) {
        preselectOne = $(preselectOne);
        var mention = $('#tieModalTextArea').find('[data-location-id=' + preselectOne.attr('data-location-id') + ']');  
        mention.addClass('selectedTieObject');
        mention.addClass('selectedEntity');

        // disable this mention in dropdowns
        $('#tieObjectOneSelector').find('[data-location-id=' + preselectOne.attr('data-location-id') + ']').addClass("disabled");
        menuConfigData.tieObjectOne = $('#tieObjectOneSelector').find('[data-location-id=' + preselectOne.attr('data-location-id') + ']');
        var dropdownText = preselectOne.find('span').html();
        if (preselectOne.attr('data-entity-id') !== undefined && preselectOne.attr('data-entity-id') !== null) {dropdownText+=" (entity)";}
        $('#tieObjectOneDropdown').empty().html(dropdownText + ' <span class="caret"></span>');
    }
    if (typeof preselectTwo !== typeof null && typeof preselectTwo !== typeof undefined) {
        preselectTwo = $(preselectTwo);
        var mention = $('#tieModalTextArea').find('[data-location-id=' + preselectTwo.attr('data-location-id') + ']');  
        mention.addClass('selectedTieObject');
        mention.addClass('selectedEntity');

        // disable this mention in dropdowns
        $('#tieObjectTwoSelector').find('[data-location-id=' + preselectTwo.attr('data-location-id') + ']').addClass("disabled");
        preselectTwo.addClass("disabled");
        menuConfigData.tieObjectTwo = $('#tieObjectTwoSelector').find('[data-location-id=' + preselectTwo.attr('data-location-id') + ']');
        var dropdownText = preselectTwo.find('span').html();
        if (preselectTwo.attr('data-entity-id') !== undefined && preselectTwo.attr('data-entity-id') !== null) {dropdownText+=" (entity)";}
        $('#tieObjectTwoDropdown').empty().html(dropdownText + ' <span class="caret"></span>');
    }

    $('#addTieModalOpener').click();

    $(document).trigger('entities.tie-modal-autofill', {
        source_location_id: preselectOne ? preselectOne.attr('data-location-id') : null,
        source_list: $('#tieObjectOneSelector')[0].outerHTML,
        target_location_id: preselectTwo ? preselectTwo.attr('data-location-id') : null,
        target_list: $('#tieObjectTwoSelector')[0].outerHTML
    });
}

var highlightTieModalTextArea = function(e) {
    var location = $('#tieModalTextArea').find('[data-location-id=' + $(this).attr('data-location-id') + ']');
    
    if (location.hasClass('selectedEntity') && !location.hasClass('selectedTieObject')) {
        location.removeClass('selectedEntity');
    } else {
        location.addClass('selectedEntity');
    }
}

var tieModalObjectChosen = function(e) {
    
    var object = $(this);

    var mention = $('#tieModalTextArea').find('[data-location-id=' + object.attr('data-location-id') + ']');  
    mention.addClass('selectedTieObject');
    mention.addClass('selectedEntity');

    if (object.parent().is('#tieObjectOneSelector')) {
        if (menuConfigData.tieObjectOne !== null) {
            $('#tieModalTextArea').find('[data-location-id=' + menuConfigData.tieObjectOne.attr('data-location-id') + ']').removeClass('selectedTieObject');
            $('#tieModalTextArea').find('[data-location-id=' + menuConfigData.tieObjectOne.attr('data-location-id') + ']').removeClass('selectedEntity');
            $('#tieObjectOneSelector').find('[data-location-id=' + menuConfigData.tieObjectOne.attr('data-location-id') + ']')
                .removeClass("disabled");
            $('#tieObjectTwoSelector').find('[data-location-id=' + menuConfigData.tieObjectOne.attr('data-location-id') + ']')
                .removeClass("disabled");
            $('#tieObjectOneSelector').find('[data-entity-id=' + menuConfigData.tieObjectOne.attr('data-entity-id') + ']')
                .removeClass("disabled");
        }
        object.addClass("disabled");
        $('#tieObjectTwoSelector').find('[data-location-id=' + object.attr('data-location-id') + ']').addClass("disabled");
        menuConfigData.tieObjectOne = object;
        console.log(menuConfigData.tieObjectOne);
        var dropdownText = object.find('span').html();
        if (object.attr('data-entity-id') !== undefined && object.attr('data-entity-id') !== null) {dropdownText+=" (entity)";}
        $('#tieObjectOneDropdown').empty().html(dropdownText + ' <span class="caret"></span>');

        $(document).trigger('entities.tie-modal-source-change', {
            source_location_id: object.attr('data-location-id'),
            source_list: $('#tieObjectOneSelector')[0].outerHTML
        });
    } else {
        if (menuConfigData.tieObjectTwo !== null) {
            $('#tieModalTextArea').find('[data-location-id=' + menuConfigData.tieObjectTwo.attr('data-location-id') + ']').removeClass('selectedTieObject');
            $('#tieModalTextArea').find('[data-location-id=' + menuConfigData.tieObjectTwo.attr('data-location-id') + ']').removeClass('selectedEntity');
            $('#tieObjectOneSelector').find('[data-location-id=' + menuConfigData.tieObjectTwo.attr('data-location-id') + ']')
                .removeClass("disabled");
            $('#tieObjectTwoSelector').find('[data-location-id=' + menuConfigData.tieObjectTwo.attr('data-location-id') + ']')
                .removeClass("disabled");  
            $('#tieObjectTwoSelector').find('[data-entity-id=' + menuConfigData.tieObjectTwo.attr('data-entity-id') + ']')
                .removeClass("disabled");
        }
        $('#tieObjectOneSelector').find('[data-location-id=' + object.attr('data-location-id') + ']').addClass("disabled");
        object.addClass("disabled");
        menuConfigData.tieObjectTwo = object;
        var dropdownText = object.find('span').html();
        if (object.attr('data-entity-id') !== undefined && object.attr('data-entity-id') !== null) {dropdownText+=" (entity)";}
        $('#tieObjectTwoDropdown').empty().html(dropdownText + ' <span class="caret"></span>');

        $(document).trigger('entities.tie-modal-target-change', {
            target_location_id: object.attr('data-location-id'),
            target_list: $('#tieObjectTwoSelector')[0].outerHTML
        });
    }
}

var confirmAddTie = function() {
    console.log("In confirmAddTie");

    if (menuConfigData.tieObjectOne === null || menuConfigData.tieObjectTwo === null) {
        resetMenuConfigData();
        return;
    }

    /* tieData {
            start: 10, 
            end: 30, 
            source_entity: {location_id: "10_11"}, 
            target_entity: {entity_id: "5"}, 
            label: "speak",
            weight: 3,
            directed: true
        }
    */
    var tieData = {
        start: parseInt($(menuConfigData.textSpans[0]).attr('data-token')),
        end: parseInt($(menuConfigData.textSpans[menuConfigData.textSpans.length-1]).attr('data-token')),
        source_entity: null,
        target_entity: null,
        label: $('#tieNameBox').val(),
        weight: parseFloat($('#tieWeightBox').val()),
        directed: $('#tieDirectedToggle').is(':checked')
    }

    if (menuConfigData.tieObjectOne.attr('data-location-id') !== null && menuConfigData.tieObjectOne.attr('data-location-id') !== undefined) {
            tieData.source_entity = {location_id: menuConfigData.tieObjectOne.attr('data-location-id')};
    } else {
        tieData.source_entity = {entity_id: menuConfigData.tieObjectOne.attr('data-entity-id')};
    }
    if (menuConfigData.tieObjectTwo.attr('data-location-id') !== null && menuConfigData.tieObjectTwo.attr('data-location-id') !== undefined) {
            tieData.target_entity = {location_id: menuConfigData.tieObjectTwo.attr('data-location-id')};
    } else {
        tieData.target_entity = {entity_id: menuConfigData.tieObjectTwo.attr('data-entity-id')};
    }

    if (tieData.label === "") {
        tieData.label = $('#tieNameBox').attr('placeholder').trim();
    }

    // addTie(tieData, callback)
    annotationManager.addTie(tieData);

    resetMenuConfigData();
}

var openEditTieModal = function(e) {
    var tie = annotation_data.annotation.ties[$(this).attr('tie-ref')];

    tieNameBox = $('#edit-tieNameBox');
    tieWeightBox = $('#edit-tieWeightBox');
    tieDirectedToggle = $('#edit-tieDirectedToggle')

    // Fill in current tie values
    if (typeof tie.label === typeof null) {
        tieNameBox.val("");
    } else { tieNameBox.val(tie.label); }
    // Fill in current tie values
    if (typeof tie.directed === typeof null || typeof tie.directed === typeof undefined) {
        tieDirectedToggle.prop('checked', false);
    } else { tieDirectedToggle.prop('checked', tie.directed); }
    tieWeightBox.val(tie.weight);

    $('#confirmEditTie').attr("tie-ref", $(this).attr('tie-ref'));
    $('#editTieModalOpener').click();
}

var confirmEditTie = function(e) {
    console.log("In confirmEditTie");

    var tie = annotation_data.annotation.ties[$(this).attr('tie-ref')];

    /* tieData {
            start: 10, 
            end: 30, 
            source_entity: {location_id: "10_11"}, 
            target_entity: {entity_id: "5"}, 
            label: "speak",
            weight: 3,
            directed: true
        }
    */
    var tieData = {
        start: tie.start,
        end: tie.end,
        source_entity: tie.source_entity,
        target_entity: tie.target_entity,
        label: $('#edit-tieNameBox').val(),
        weight: parseFloat($('#edit-tieWeightBox').val()),
        directed: $('#edit-tieDirectedToggle').is(':checked')
    }

    // addTie(tieData, callback)
    annotationManager.updateTie($(this).attr('tie-ref'), tieData);

    resetMenuConfigData();
}

var deleteSelectedTie = function(e) {
    console.log("In deleteSelectedTie");
    closeContextMenu();

    // removeTie(TieID, callback);
    console.log($(this).attr('tie-ref'));
    annotationManager.removeTie($(this).attr('tie-ref'));

    resetMenuConfigData();
}

var combineSelectedEntities = function() {
    console.log("In combineSelectedEntities");

    resetMenuConfigData();
}

var combineSelectedGroups = function() {
    console.log("In combineSelectedGroups");

    if (menuConfigData.selectedGroups.length < 2) {
        return;
    }

    var entities = [];
    menuConfigData.selectedGroups.forEach(g => {
        Object.keys(annotation_data.annotation.groups[g].entities).forEach(e => {
            entities.push(e);
        });
    });

    annotationManager.moveEntitiesToGroup(entities, menuConfigData.selectedGroups.pop());

    resetMenuConfigData();
}

var deleteSelectedMention = function() {
    console.log("In deleteSelectedMention");

    annotationManager.removeMention(menuConfigData.selectedMentions[menuConfigData.selectedMentions.length-1]);

    resetMenuConfigData();
}

var deleteSelectedEntity = function() {
    console.log("In deleteSelectedEntity");

    var entityId = annotationManager.removeEntity(menuConfigData.recentSelectedEntityId);
    
    resetMenuConfigData();
}

var deleteSelectedEntities = function() {
    console.log("in deleteSelectedEntities");

    // Get entity ids without the "ID-1" or "ID-2"
    //////////
    // TEMPORARY
    //////////

    menuConfigData.selectedEntities.forEach(s => {
        if (s.includes('-')) {
            s = s.match(/.+?(?=-)/)[0];
        }        
        s = Number(s);
    });

    var entityId = annotationManager.removeEntities(menuConfigData.selectedEntities);

    resetMenuConfigData();
}

var deleteSelectedGroup = function() {
    console.log("In deleteSelectedGroup");

    // removeEntities(entityIds, callback);
    // annotationManager.removeEntities(Object.keys(annotation_data.annotation.groups[$(menuConfigData.recentSelectedEntity).attr('data-group-id')].entities), null);

    // removeGroup(groupId, callback);
    annotationManager.removeGroup($(menuConfigData.recentSelectedEntity).attr('data-group-id'));

    resetMenuConfigData();
}

var deleteSelectedGroups = function() {
    console.log("In deleteSelectedGroups");

    // removeGroups(groupIds, callback);
    annotationManager.removeGroups(menuConfigData.selectedGroups);

    resetMenuConfigData();
}

var groupSelectedEntities = function() {
    console.log("In groupSelectedEntities");

    // groupEntities(entityIds, callback);
    console.log(menuConfigData.selectedEntities);
    annotationManager.groupEntities(menuConfigData.selectedEntities);

    resetMenuConfigData();
}

var openGroupSelectorModal = function() {
    $('#groupSelectorChecklist').empty();

    var groupRadios = "";
    for(groupId in annotationManager.groups){
        var list = `<li class="group unselectable" data-id="${groupId}">`;
        list += `<div class="pretty p-default p-round p-smooth"><input type="radio" name="groupChoices" class="group-checkbox" data-id="${groupId}" value="${groupId}"><div class="state p-primary"><label><span class="g${groupId} unselectable">${annotationManager.groups[groupId].name}</span></label></div></div>`;
        list += '</li>';

        groupRadios += list;
    }

    $('#groupSelectorChecklist').append(groupRadios);
    $('#groupSelectorModalOpener').click();
}

var confirmMoveEntityToGroup = function() {
    console.log("In confirmMoveEntityToGroup");

    var selectedGroup = $("input:radio[name='groupChoices']:checked").val();

    if (selectedGroup === undefined) {
        return;
    }

    // moveEntityToGroup(entityId, groupId, callback);
    annotationManager.moveEntityToGroup(menuConfigData.recentSelectedEntityId, selectedGroup);

    resetMenuConfigData();
}

var openGroupNameChangeModal = function() {
    $('#changeGroupnameModalOpener').click();
}

var confirmGroupNameChange = function() {
    console.log("In confirmGroupNameChange");

    // changeGroupName(groupId, name, callback);
    annotationManager.changeGroupName($(menuConfigData.recentSelectedEntity).attr('data-group-id'), $('#newGroupNameBox').val());

    resetMenuConfigData();
}

var resetMenuConfigData = function() {
    // deselect every entity in text and checklist
    menuConfigData.selectedEntities.forEach(function(entity) {
        $('[data-entity-id="' + entity + '"]').removeClass('selectedEntity');
        $('.group-checkbox').prop('checked', false);
    });

    menuConfigData = {
        textSpans: null,
        newGroupId: null,
        selectedMentions: [],
        recentSelectedEntityId: null,
        recentSelectedEntity: null,
        selectedEntities: [],
        numSelectedEntities: 0,
        selectedGroups: [],
        numSelectedGroups: 0,
        tieObjectOne: null,
        tieObjectTwo: null
    };

    updateSelectionInfoBox();
}

////////////////////////////////////////////////////////////////////////////////
// NETWORK VISUALIZATION FUNCTIONS
////////////////////////////////////////////////////////////////////////////////

var findTies = function(n){
    console.log('Finding ties...');
    mentions = [];
    var i, j;

    function insertMention(locationId){
        var location = annotation_data.annotation.locations[locationId];
        var min = 0, max = mentions.length-1, mid = Math.floor((min+max)/2);
        var insertIndex = 0;

        while(min <= max){
            insertIndex = mid;

            if(mentions[mid][0] === location.start){
                break;
            } else if(mentions[mid][0] > location.start) {
                max = mid-1;
                mid = Math.floor((min+max)/2);
            } else {
                min = mid+1;
                mid = Math.floor((min+max)/2);
            }
        }
        if(insertIndex < mentions.length && 
            mentions[insertIndex][0] < location.start){
            insertIndex++;
    }

    mentions.splice(insertIndex, 0, 
        [location.start, locationId, location.entity_id]);
}

for(locationId in annotation_data.annotation.locations){
    insertMention(locationId);
}

for(i = 0; i < mentions.length; i++){
    for(j = i+1; j < mentions.length; j++){
        if(mentions[j][0]-mentions[i][0] > n || 
            annotation_data.annotation.entities[mentions[i][2]].group_id ===
            annotation_data.annotation.entities[mentions[j][2]].group_id){
            break;
    }
    annotation_data.annotation.ties.push({
        weight: 1,
        source_entity: {location_id: mentions[i][1]},
        target_entity: {entity_id: mentions[j][2]}
    });
}
}

console.log(`Found ${annotation_data.annotation.ties.length} ties!`);
};

var exportAsTSV = function() {
    var graph = annotationManager.generateGraph();
    var edges = graph.edges;
    var nodes = graph.nodes;

    /*
        // sort links alphabetically 
        edges.sort(function(a,b) {
            var nameA = a.source.name;
            var nameB = b.source.name;

            if(nameA < nameB) { return -1; }
            if(nameA > nameB) { return 1; }
            return 0;
        })
    */

    var rows = [
        ["Source", "Target", "Label", "Weight", "directed"],
    ];
    //var used = {};

    // push link to rows if it does not reference itself and is not a duplicate
    $.each(edges, function(index, edge) {
        if (nodes[edge.source].label !== nodes[edge.target].label) {
            // var curLink = [link.source.name, link.target.name, link.label, link.weight, link.directed];
            var curEdge = [nodes[edge.source].label, nodes[edge.target].label, edge.label, edge.weight, edge.directed.toString()];
            //if (!(used[curLink[0] + curLink[1]] === true)) {
                rows.push(curEdge);
                //used[curEdge[0] + curEdge[1] + edge.label] = true;
            //}
        } 
    });

    // push rows 
    let tsvContent = "data:text/tsv;charset=utf-8," 
        + rows.map(e => e.join("\t")).join("\n");

    var encodedUri = encodeURI(tsvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("id", "tsvDownloader")
    link.setAttribute("download", "my_graph.tsv");
    document.body.appendChild(link); 

    link.click();
    $('#tsvDownloader').remove();
}

var exportAsGraphML = function() {
    var graph = annotationManager.generateGraph();
    var edges = graph.edges;
    var nodes = graph.nodes;

    /*
        // sort links alphabetically 
        edges.sort(function(a,b) {
            var nameA = a.source.name;
            var nameB = b.source.name;

            if(nameA < nameB) { return -1; }
            if(nameA > nameB) { return 1; }
            return 0;
        })
    */

    var lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns">');
    lines.push('<key attr.name="label" attr.type="string" for="node" id="label"/>');
    lines.push('<key attr.name="Edge Label" attr.type="string" for="edge" id="edgelabel"/>');
    lines.push('<key attr.name="weight" attr.type="double" for="edge" id="weight"/>');
    lines.push('<graph edgedefault="directed">');

    $.each(nodes, function(index, node) {
        lines.push(`<node id="${node.label}">`);
        lines.push(`<data key="label">${node.label}</data>`);
        lines.push(`<data key="label">${node.label}</data>`);
        lines.push('</node>');
    });
    $.each(edges, function(index, edge) {
        lines.push(`<edge id="${edge.id}" source="${nodes[edge.source].label}" target="${nodes[edge.target].label}">`);
        lines.push(`<data key="weight">${edge.weight}</data>`);
        lines.push(`<data key="Edge Label">${edge.label}</data>`)
        lines.push('</edge>')
    });

    lines.push('</graph>');
    lines.push('</graphml>');


    // push rows 
    let graphMLContent = "data:text/graphml;charset=utf-8," 
        + lines.join("\n");

    var encodedUri = encodeURI(graphMLContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("id", "graphMLDownloader")
    link.setAttribute("download", "my_graphML.graphml");
    document.body.appendChild(link); 

    link.click();
    $('#graphMLDownloader').remove();
}




////////////////////////////////////////////////////////////////////////////////
// MAIN
////////////////////////////////////////////////////////////////////////////////

$(document).ready(function(){
    //getTexts();
    showPage();
    //window.onhashchange = showPage;
    $(document).on('click', '#get-texts', getTexts);
    $('#file-upload-form').on('submit', upload);
    $(document).on('click', 'a.onpage', loadText);
    $(document).on('click', '#add-annotation', addAnnotation);
    // $(document).on('click', '#get-annotations', getAnnotations);
    // $(document).on('click', '.get-annotation', getAnnotations);
    $(document).on('click', '.group .select-all', selectAllInGroup);
    $(document).on('click', '#group-selected', groupSelected);
    $(document).on('click', '.logout-button', ()=>{$('#logout-form').submit()});
    $(document).on('click', "#entity-list > ul.groups > li > input.group-checkbox", groupListCheckboxClicked);

    
    // Manual Annotation
    menu = document.querySelector(".context-menu");
    $(document).on('click', '#text-panel > .content-page > .annotated-entity', existingEntityClicked);
    $(document).mouseup(checkSelectedText);

    $(document).on('click', '#resetSelectionButton', function() {
        resetMenuConfigData();
        closeContextMenu();
    });
    
    // Close Context menu on click
    $(document).on('click', closeContextMenu);
    // Close context menu with escape key
    $(document).keyup(function(e) { if (e.keyCode == 27) closeContextMenu();})
    // Close context menu when window is resized
    $(window).on('resize', closeContextMenu);
    // Close context menu on text are scroll
    $("span").scroll(function() {
        deselectAllText();
        closeContextMenu();
    });
    $("div").scroll(function() {
        deselectAllText();
        closeContextMenu();
    });


    // Context Menu Options
    $(document).on('click', '.addMentionOption', openAddMentionModal);
    $(document).on('click', '#confirmAddMention', confirmAddMention);
    $(document).on('click', '.reassignMentionOption', openReassignMentionModal);
    $(document).on('click', '#confirmReassignMention', confirmReassignMention);
    $(document).on('click', '.addEntityOption', addEntityFromSelection);
    $(document).on('click', '.deleteMentionOption', deleteSelectedMention);
    $(document).on('click', '.deleteEntityOption', deleteSelectedEntity);
    $(document).on('click', '.deletedSelectedEntitiesOption', deleteSelectedEntities);
    $(document).on('click', '.deleteGroupOption', deleteSelectedGroup);
    $(document).on('click', '.deleteSelectedGroupsOption', deleteSelectedGroups);
    $(document).on('click', '.groupEntitiesOption', groupSelectedEntities);
    $(document).on('click', '.combineSelectedGroupsOption', combineSelectedGroups);
    $(document).on('click', '.changeGroupNameOption', openGroupNameChangeModal);
    $(document).on('click', '#confirmGroupNameChange', confirmGroupNameChange);
    $(document).on('click', '.moveEntityToGroupOption', openGroupSelectorModal)
    $(document).on('click', '#confirmGroupSelect', confirmMoveEntityToGroup)

    $(document).on('click', '.addTieOption', openAddTieModal);
    $(document).on('click', '#confirmAddTie', confirmAddTie);
    $(document).on('click', '.editTieOption', openEditTieModal);
    $(document).on('click', '#confirmEditTie', confirmEditTie);
    $(document).on('click', '.deleteTieOption', deleteSelectedTie)
    $(document).on('click', '.tie-text', openTieContextMenu)
    $(document).on('click', '.tie-object', tieModalObjectChosen)
    $(document).on('mouseenter', '.tie-object', highlightTieModalTextArea)
    $(document).on('mouseleave', '.tie-object', highlightTieModalTextArea)


    $(document).on('mouseenter', '.thisMentionHover', startHoverMenuTimer);
    $(document).on('mouseenter', '.thisMentionHover', startHoverMenuTimer);
    $(document).on('mouseenter', '.thisEntityHover', startHoverMenuTimer);
    $(document).on('mouseenter', '.thisGroupHover', startHoverMenuTimer);
    $(document).on('mouseenter', '.selectedHover', startHoverMenuTimer);
    $(document).on('mouseenter', '.tieHover', startHoverMenuTimer);
    $(document).on('mouseleave', '.thisMentionHover', clearHoverMenuTimer);
    $(document).on('mouseleave', '.thisMentionHover', clearHoverMenuTimer);
    $(document).on('mouseleave', '.thisEntityHover', clearHoverMenuTimer);
    $(document).on('mouseleave', '.thisGroupHover', clearHoverMenuTimer);
    $(document).on('mouseleave', '.selectedHover', clearHoverMenuTimer);
    $(document).on('mouseleave', '.tieHover', clearHoverMenuTimer);

    $(document).on('click', '#graph-export-tsv', exportAsTSV);
    $(document).on('click', '#graph-export-graphml', exportAsGraphML);



    // Autofocus the first input of a modal.
    $('.modal').on('shown.bs.modal',function(){
        console.log('focusing on the first input.');
        $(this).find('input')[0].focus();
    });
});