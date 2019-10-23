var timeoutId;
var currentTextId = null;
var annotation_data = null;
var annotationManager = null;

// Context Menu
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
    tieObjectTwo: null
};
var menuOpen = 0;
var menu;
var mouseClicked = 0;

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

var makeGroupChecklist = function(groupId, entities){
    var list = `<li class="group unselectable" data-id="${groupId}">`, entityId, i,
    entitiesSize = size(entities);
    for(entityId in entities){
        list += `<input type="checkbox" class="group-checkbox" data-id="${entityId}"> <span class="g${groupId} unselectable">${entities[entityId].name}</span>`;
        if(i < entitiesSize-1){
            list += ', ';
        }
        i++;
    }
    if(entitiesSize > 1){
        list += ' <button class="select-all">[de]select all</button>';
    }
    list += '</li>';
    return list;
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
    if($(this).siblings('input:checked').length > 0){
        $(this).siblings('input').prop('checked', false);
    } else {
        $(this).siblings('input').prop('checked', true);
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
 * roughly PAGE_SIZE (plus or minus TOKEN_MARGIN) and then redering the first
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
         while(firstPage >= 0 && location.start >= contentPages[firstPage][START]){
             firstPage--;
         }
         lastPage = mid;
         while(lastPage < contentPages.length && location.end >= contentPages[lastPage][START]){
             lastPage++;
         }

         return [firstPage+1, lastPage-1];

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
         html += `<span data-token="${i}">`+ 
         tokens[i][TOKEN_CONTENT].replace("&", "&amp;").
         replace("<", "&lt;").
         replace(">", "&gt;") +
         '</span><span>'+ tokens[i][WHITESPACE_AFTER] +"</span>";
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
 * Highlights entities in the given text content element. Tokens in the given
 * element must contain an data-id="..." attribute with the token's id. Colors
 * are chosen by the global pallet. This relies on the global `annotation_data`
 * variable being properly initialized and maintained.
 *
 * @param {jQuery Element} The element to highlight entities in.
 */
 var highlightEntitiesInContent = function(locationKeys, $element){
    // This is just to test things quick and dirty.
    var i, j, location, $token, tokenId, prevTokenId;
    for(i = 0; i < locationKeys.length; i++){
        location = annotation_data.annotation.locations[locationKeys[i]];
        var entityGroupId = annotation_data.annotation.
            entities[location.entity_id].group_id;
        
        $token = $element.find(`[data-token=${location.start}]`);
        tokenId = parseInt($token.attr('data-token'));
        prefTokenId = tokenId;

        // Moves down each token in the location, including the spaces.
        while($token.length > 0 && 
            (($token.attr('data-token') === undefined && prevTokenId != location.end) || 
            (tokenId >= location.start && tokenId <= location.end))){

            $token.
                addClass(`g${entityGroupId}`). 
                addClass('entity').
                addClass('annotated-entity').
                attr({
                    'data-entity-id': location.entity_id,
                    'data-group-id': entityGroupId,
                    'data-location-id': locationKeys[i]  
                });

            // Special treatment for the first and last tokens.
            if(tokenId == location.start){
                $token.addClass('start-token');
            }
            if(tokenId == location.end){
                $token.addClass('end-token');j
            }

            $token = $($token[0].nextSibling);
            prevTokenId = tokenId;
            tokenId = parseInt($token.attr('data-token'));

        }
   }
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
        deselectEntity(entityId);
        menuConfigData.selectedGroups.splice(menuConfigData.selectedGroups.indexOf(groupId), 1);
        menuConfigData.selectedMentions.splice(menuConfigData.selectedMentions.indexOf(clickedEntity.attr('data-location-id')), 1);

        // Uncheck the checkbox
        $('[data-id=' + groupId + ']').filter('li').find('input').filter('[data-id=' + entityId + ']').prop('checked', 0);

        return;
    }

    selectEntity(entityId);
    menuConfigData.selectedGroups.push(groupId);
    menuConfigData.selectedMentions.push(clickedEntity.attr('data-location-id'));

    // Find entity in group list
    // Check the checkbox
    $('[data-id=' + groupId + ']').filter('li').find('input').filter('[data-id=' + entityId + ']').prop('checked', 1);

    var contextMenuOptions = [];
    var optionNumber = 0;

    contextMenuOptions[optionNumber++] = "<li class='context-menu__item hover-option thisMentionHover'><a class='context-menu__link'><i>This Mention \></i></a></li>";
    contextMenuOptions[optionNumber++] = "<li class='context-menu__item hover-option thisEntityHover'><a class='context-menu__link'><i>This Entity \></i></a></li>";
    contextMenuOptions[optionNumber++] = "<li class='context-menu__item hover-option thisGroupHover'><a class='context-menu__link'><i>This Group \></i></a></li>";
    if (menuConfigData.numSelectedEntities > 1) {
        contextMenuOptions[optionNumber++] = "<li class='context-menu__item hover-option selectedHover'><a class='context-menu__link'><i>Selected \></i></a></li>";
    }
    
    openContextMenu(contextMenuOptions, clickedEntity);
}

var checkSelectedText = function(event) {
    // if nothing is selected, return
    if (window.getSelection().toString() == "") return;

    var textSpans = [];
    var textSpans = getSelectedSpans();
    console.log(textSpans);

    if (textSpans === []) {
        return;
    } 

    // get unused group ID
    var newGroupID = Object.keys(annotation_data.annotation.groups).length + 1;

    var contextMenuOptions = [];
    var optionNumber = 0;

    contextMenuOptions[optionNumber++] = "<li class='context-menu__item'><a class='context-menu__link addEntityOption'><i>Add Entity</i></a></li>";
    contextMenuOptions[optionNumber++] = "<li class='context-menu__item'><a class='context-menu__link addMentionOption'><i>Add Mention</i></a></li>";
    contextMenuOptions[optionNumber++] = "<li class='context-menu__item'><a class='context-menu__link addTieOption'><i>Add Tie</i></a></li>";

    menuConfigData.textSpans = textSpans;
    menuConfigData.newGroupID = newGroupID;

    openContextMenu(contextMenuOptions);
}

function getSelectedSpans() {
    var startSpan;
    var endSpan;
    var spans = [];
    var spanCount = 0;

    sel = window.getSelection();

    if (sel.anchorNode.nodeValue.trim() == "") {
        console.log("anchor");
        startSpan = $(sel.anchorNode.parentElement).prev()[0];
    } else {
        startSpan = sel.anchorNode.parentElement;
    }
    if (sel.focusNode.nodeValue.trim() == "") {
        console.log("focus");
        endSpan = $(sel.focusNode.parentElement).prev()[0];
    } else {
        endSpan = sel.focusNode.parentElement;
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
        selectEntity($(this).attr("data-id"));
    } else {
        deselectEntity($(this).attr("data-id"));
    }
}

var openContextMenu = function(options, clickedEntity) {
    if (options == null) return;

    var active = "context-menu--active";

    $('.context-menu__items').empty();
    var contextMenu = $('.context-menu__items');

    // add menu options to menu
    options.forEach(function(entry) {
        contextMenu.html(contextMenu.html() + entry);
    });

    if (menuOpen !== 1) {
        menuOpen = 1;
        menu.classList.add(active);

        if (clickedEntity == null) {
            var menuPosition = getPositionForMenu(event);
        } else {
            var menuPosition = getPositionForMenu(event, clickedEntity);
        }

        // Coordinates
        menu.style.left = menuPosition.x + "px";
        menu.style.top = menuPosition.y + "px";

        // Dimensions
        var menuWidth = menu.offsetWidth;
        var menuHeight = menu.offsetHeight;

        return false;
    } else {
        closeContextMenu();
        return;
    }
}

var closeContextMenu = function() {
    if (window.getSelection() == "" && !($(event.target).hasClass('entity')) && 
        !($(event.target).hasClass('context-menu__link')) && !($(event.target).hasClass('context-menu__item'))) {
        menuOpen = 0;
        menu.classList.remove("context-menu--active");

        $('.context-menu__items').html("");

        closeHoverMenu();
    }
}

var openHoverMenu = function(e) {
    var hoverOption = $(event.target).parent();
    var hoverMenu = $('.context-menu-hover');
    var hoverMenuItems = $('.context-menu-hover').find('.context-menu__items');
    var options = [];
    var optionNumber = 0;
    var locationMultiplier = 1;

    if (hoverOption.hasClass('thisMentionHover')) {
        options[optionNumber++] = "<li class='context-menu__item deleteMentionOption'><a class='context-menu__link'><i>Delete</i></a></li>";
        options[optionNumber++] = "<li class='context-menu__item reassignMentionOption'><a class='context-menu__link'><i>Reassign</i></a></li>";

        locationMultiplier = 1;
    }
    else if (hoverOption.hasClass('thisEntityHover')) {
        options[optionNumber++] = "<li class='context-menu__item deleteEntityOption'><a class='context-menu__link'><i>Delete</i></a></li>";
        options[optionNumber++] = "<li class='context-menu__item moveEntityToGroupOption'><a class='context-menu__link'><i>Move to Group</i></a></li>";

        locationMultiplier = 2;
    }
    else if (hoverOption.hasClass('thisGroupHover')) {
        options[optionNumber++] = "<li class='context-menu__item deleteGroupOption'><a class='context-menu__link'><i>Delete</i></a></li>";
        options[optionNumber++] = "<li class='context-menu__item changeGroupNameOption'><a class='context-menu__link'><i>Change Group Name</i></a></li>";

        locationMultiplier = 3;
    }
    else if (hoverOption.hasClass('selectedHover')) {
        if (menuConfigData.numSelectedEntities > 1) {
            options[optionNumber++] = "<li class='context-menu__item groupEntitiesOption'><a class='context-menu__link'><i>Group Entites</i></a></li>";
        }
        if (menuConfigData.selectedGroups.length > 1) {
            options[optionNumber++] = "<li class='context-menu__item combineSelectedGroupsOption'><a class='context-menu__link'><i>Combine Groups Here</i></a></li>";
            options[optionNumber++] = "<li class='context-menu__item deleteSelectedGroupsOption'><a class='context-menu__link'><i>Delete Selected Groups</i></a></li>";
        }

        locationMultiplier = 4;
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
}

var closeHoverMenu = function(e) {
    var hoverMenu = $('.context-menu-hover');
    var hoverMenuItems = $('.context-menu-hover').find('.context-menu__items');

    hoverMenuItems.empty();

    hoverMenu.removeClass("context-menu--active");
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

function selectEntity(entityId) {
    menuConfigData.numSelectedEntities++;
    menuConfigData.recentSelectedEntityId = entityId;
    menuConfigData.selectedEntities.push(entityId);

    // Function to find every token in entity
    $('[data-entity-id=' + entityId + ']').filter('span').each(function() {
        // Cannot use JQuery selector because entity isn't the only class
        if ($(this).hasClass('entity')) {
            $(this).addClass('selectedEntity');
        }
    })
}

function deselectEntity(entityId) {
    // Remove entity from selection list
    menuConfigData.numSelectedEntities--;
    menuConfigData.selectedEntities.splice(menuConfigData.selectedEntities.indexOf(entityId), 1);
    menuConfigData.recentSelectedEntity = null;
    menuConfigData.recentSelectedEntityId = null;

    $('[data-entity-id=' + entityId + ']').filter('span').each(function() {
        // Cannot use JQuery selector because entity isn't the only class
        if ($(this).hasClass('entity')) {
            $(this).removeClass('selectedEntity');
        }
    }) 
}

////////////////////////////////////////////////////////////////////////////////
// CONTEXT MENU FUNCTIONS
////////////////////////////////////////////////////////////////////////////////

var makeEntityModalChecklist = function(groupId, entities, radioOptionName) {
    var list = `<li class="group unselectable" data-id="${groupId}">`, entityId, i,
    entitiesSize = size(entities);
    for(entityId in entities){
        list += `<input type="radio" name="${radioOptionName}" class="group-checkbox" data-id="${entityId}" value="${entityId}"> <span class="g${groupId} unselectable">${entities[entityId].name}</span>`;
        if(i < entitiesSize-1){
            list += ', ';
        }
        i++;
    }
    list += '</li>';
    return list;
}

var openAddMentionModal = function() {
    $('#addMentionEntitySelectorChecklist').empty();

    for(groupId in annotationManager.groups){
        var group = annotationManager.groups[groupId];
        $('#addMentionEntitySelectorChecklist').append(makeEntityModalChecklist(groupId, group.entities, 'addMentionEntityRadioOption'));
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
    annotationManager.addMention(selectedEntity, $(spans[0]).attr('data-token'), $(spans[spans.length-1]).attr('data-token'), null);

    resetMenuConfigData();

    // TEMPORARY
    window.location.reload(true);
}

var openReassignMentionModal = function() {
    $('#reassignMentionEntityChecklist').empty();

    for(groupId in annotationManager.groups){
        var group = annotationManager.groups[groupId];
        $('#reassignMentionEntitySelectorChecklist').append(makeEntityModalChecklist(groupId, group.entities, 'reassignMentionEntityRadioOption'));
    }

    $('#reassignMentionModalOpener').click();
}

//////////
//   TODO
//   FIX THIS
//////////
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
    }, null);

    resetMenuConfigData();

    // TEMPORARY
    window.location.reload(true);
}

var addEntityFromSelection = function() {
    closeContextMenu();
    console.log("In addEntityFromSelection");

    var spans = menuConfigData.textSpans;
    var name = "";

    spans.forEach(s => {
        name += s.innerHTML + " ";
        name += " ";
    })
    name = name.trim();

    // addEntity(name, startOffset, endOffset, groupID (optional), callback (optional));
    var entityId = annotationManager.addEntity(name, $(spans[0]).attr('data-token'), $(spans[spans.length-1]).attr('data-token'), null, null);

    resetMenuConfigData();

    // TEMPORARY
    window.location.reload(true);
}

var openAddTieModal = function() {

    if (menuConfigData.textSpans.length < 1) { return; }

    tieModalTextArea = $('#tieModalTextArea');
    dropdownOne = $('#tieObjectOneSelector');
    dropdownTwo = $('#tieObjectTwoSelector');
    tieNameBox = $('#tieNameBox');

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
    while (curSpan.prev() !== null && curSpan.prev() !== undefined &&
           curSpan.prev().length !== 0 && curSpan.prev().html().trim() !== "") {
                curSpan = curSpan.prev();
    }


    while (curSearch < objectSearchWindowSize) {
        if (curSpan === null || curSpan === undefined || curSpan.length===0) { break; }
        if (typeof curSpan.attr('data-token') !== typeof undefined && typeof curSpan.attr('data-token') !== typeof null) {curSearch++;}
        // need to push clone to spanList but need original for DOM navigation
        curSpanClone = curSpan.clone();
        if (curSpan.html().trim() !== "" && parseInt(curSpan.attr('data-token')) >= parseInt($(menuConfigData.textSpans[0]).attr("data-token")) && parseInt(curSpan.attr('data-token')) <= parseInt($(menuConfigData.textSpans[menuConfigData.textSpans.length-1]).attr("data-token"))) {
            curSpanClone.addClass('text-primary');
            tieNameBox.attr('placeholder', tieNameBox.attr('placeholder') + curSpan.html() + " ").blur();
            curSearch--;
        }
        spanList.push(curSpanClone); 
        curSpan = curSpan.next();
    }
    // don't end on punctuative tokens
    while (curSpan.next() !== null && curSpan.next() !== undefined &&
           curSpan.next().length !== 0 && curSpan.next().html().trim() !== "") {
                spanList.push(curSpan.next().clone());
                curSpan = curSpan.next();
    }

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

    var objects = "";

    spanList.forEach(span => {
        tieModalTextArea.append(span.clone());
        if (span.hasClass('entity')) {
            objects += ('<li class="tie-object list-group-item" data-location-id="' + span.attr('data-location-id') + '">' + 
                '<span class="unselectable">' + span.html() + '</span></li>');
        }
    });

    objects += "<li class='list-group-item disabled' style='text-align: center;'><span style='text-align: center;'>--- Entities ---</span></li>";

    for (entity in annotation_data.annotation.entities) {
        objects += ('<li class="tie-object list-group-item" data-entity-id="' + entity.toString() + '">' + 
                '<span class="unselectable">' + annotation_data.annotation.entities[entity].name + '</span></li>');
    }

    dropdownOne.append(objects);
    dropdownTwo.append(objects);

    $('#addTieModalOpener').click();
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
        var dropdownText = object.find('span').html();
        if (object.attr('data-entity-id') !== undefined && object.attr('data-entity-id') !== null) {dropdownText+=" (entity)";}
        $('#tieObjectOneDropdown').empty().html(dropdownText + ' <span class="caret"></span>');
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
            label: "speak"
        }
    */
    var tieData = {
        start: parseInt($(menuConfigData.textSpans[0]).attr('data-token')),
        end: parseInt($(menuConfigData.textSpans[menuConfigData.textSpans.length-1]).attr('data-token')),
        source_entity: null,
        target_entity: null,
        label: $('#tieNameBox').val()
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

    console.log(tieData);

    // addTie(tieData, callback)
    annotationManager.addTie(tieData, ()=>{window.location.reload(true);});

    resetMenuConfigData();

    // TEMPORARY
    // window.location.reload(true);
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

    annotationManager.moveEntitiesToGroup(entities, menuConfigData.selectedGroups.pop(), null);

    resetMenuConfigData();

    // TEMPORARY
    window.location.reload(true);
}

var deleteSelectedMention = function() {
    console.log("In deleteSelectedMention");

    annotationManager.removeMention(menuConfigData.selectedMentions[menuConfigData.selectedMentions.length-1], null);

    resetMenuConfigData();

    // TEMPORARY
    window.location.reload(true);
}

var deleteSelectedEntity = function() {
    console.log("In deleteSelectedEntity");

    console.log(menuConfigData.recentSelectedEntityId);

    var entityId = annotationManager.removeEntity(menuConfigData.recentSelectedEntityId, null);
    
    resetMenuConfigData();

    // TEMPORARY
    window.location.reload(true);
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

    var entityId = annotationManager.removeEntities(menuConfigData.selectedEntities, null);

    resetMenuConfigData();

    // TEMPORARY
    window.location.reload(true);
}

var deleteSelectedGroup = function() {
    console.log("In deleteSelectedGroup");

    // removeEntities(entityIds, callback);
    // annotationManager.removeEntities(Object.keys(annotation_data.annotation.groups[$(menuConfigData.recentSelectedEntity).attr('data-group-id')].entities), null);

    // removeGroup(groupId, callback);
    annotationManager.removeGroup($(menuConfigData.recentSelectedEntity).attr('data-group-id'), null);

    resetMenuConfigData();

    // TEMPORARY
    window.location.reload(true);
}

var deleteSelectedGroups = function() {
    console.log("In deleteSelectedGroups");

    // removeGroups(groupIds, callback);
    annotationManager.removeGroups(menuConfigData.selectedGroups, null);

    resetMenuConfigData();

    // TEMPORARY
    window.location.reload(true);
}

var deleteSelectedTie = function() {
    console.log("In deleteSelectedTie");

    resetMenuConfigData();
}

var groupSelectedEntities = function() {
    console.log("In groupSelectedEntities");

    // groupEntities(entityIds, callback);
    console.log(menuConfigData.selectedEntities);
    annotationManager.groupEntities(menuConfigData.selectedEntities, null);

    resetMenuConfigData();

    // TEMPORARY
    window.location.reload(true);
}

var openGroupSelectorModal = function() {
    $('#groupSelectorChecklist').empty();

    var groupRadios = "";
    for(groupId in annotationManager.groups){
        var list = `<li class="group unselectable" data-id="${groupId}">`;
        list += `<input type="radio" name="groupChoices" class="group-checkbox" data-id="${groupId}" value="${groupId}"> <span class="g${groupId} unselectable">${annotationManager.groups[groupId].name}</span>`;
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
    annotationManager.moveEntityToGroup(menuConfigData.recentSelectedEntityId, selectedGroup, null);

    resetMenuConfigData();

    // TEMPORARY
    window.location.reload(true);
}

var openGroupNameChangeModal = function() {
    $('#changeGroupnameModalOpener').click();
}

var confirmGroupNameChange = function() {
    console.log("In confirmGroupNameChange");

    // changeGroupName(groupId, name, callback);
    annotationManager.changeGroupName($(menuConfigData.recentSelectedEntity).attr('data-group-id'), $('#newGroupNameBox').val(), null);

    resetMenuConfigData();

    // TEMPORARY
    window.location.reload(true);

}

var resetMenuConfigData = function() {
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
    networkViz.exportTSV(); 
    $('#tsvDownloader').remove();   
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
    $(document).on('click', '.tie-object', tieModalObjectChosen)
    $(document).on('mouseenter', '.tie-object', highlightTieModalTextArea)
    $(document).on('mouseleave', '.tie-object', highlightTieModalTextArea)

    $(document).on('mouseenter', '.thisMentionHover', openHoverMenu);
    $(document).on('mouseenter', '.thisEntityHover', openHoverMenu);
    $(document).on('mouseenter', '.thisGroupHover', openHoverMenu);
    $(document).on('mouseenter', '.selectedHover', openHoverMenu);

    $(document).on('click', '#graph-export', exportAsTSV);


    // Autofocus the first input of a modal.
    $('.modal').on('shown.bs.modal',()=>{$(this).find('input').focus()});
});