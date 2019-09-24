var timeoutId;
var currentTextId = null;
var annotation_data = null;

// Context Menu
var menuDataToPass;
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

var displayAnnotation = function(data){
    // Clear the annotation list.
    // $('#annotation-list').html('');
    console.log("In displayAnnotation");

    var charListOuterElm = $('#entity-list');
    var charListElm = $('<ul class="groups">');
    charListOuterElm.html(
        '<button id="group-selected">Group selected</button> ');
    charListOuterElm.append(charListElm);

    var entityId, groupId, i;
    for(entityId in data.annotation.entities){
        var entity = data.annotation.entities[entityId];
        var group = data.annotation.groups[entity.group_id];
        if(!group.entities){
            group.entities = {};
        }
        group.entities[entityId] = entity;
        // group.entities.push(entity);
        // entity.id = entityId;

        // var names = [];
        // var j;
        // for(j = 0; j < char.names.length; j++){
        //     names.push(char.names[j].n +' ('+ 
        //         char.names[j].c +')');
        // }
        // charListElm.append('<li>'+ names.join(', ') +'</li>');
    }

    for(groupId in data.annotation.groups){
        var group = data.annotation.groups[groupId];
        // var names = [];
        // for(i = 0; i < group.entities.length; i++){
        //     names.push(group.entities[i].name);
        // }
        charListElm.append(makeGroupChecklist(groupId, group.entities));
    }

    annotation_data = data;
};

var size = function(obj){
    var s = 0;
    for(var x in obj) s++;
    return s;
}

var makeGroupChecklist = function(groupId, entities){
    var list = `<li class="group" data-id="${groupId}">`, entityId, i,
        entitiesSize = size(entities);
    for(entityId in entities){
        list += `<input type="checkbox" data-id="${entityId}"> <span class="g${groupId}">${entities[entityId].name}</span>`;
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
    // Cases:
    // 1. N selected entities in same group of size N 
    //      -- do nothing.
    // 2. All groups with selections have at least one unselected entity
    //      -- create a new group and move selected to it.
    //      -- remove select from original groups
    // 3. N selected entities where one or more subsets of N are in a
    //    fully selected group
    //      -- move all selected to a fully selected group (id X)
    //      -- remove select entities from original groups, except group X
    //      -- remove empty groups

    //var selectedCheckboxes = 
    var selectedEntities = {};
    var selectedGroups = {};
    var groupId, entityId;
    var fullySelectedGroups = [];
    var selectedEntitiesSize, selectedGroupsSize, fullySelectedGroupsSize;
    var changes = {entities: {}, groups: {}, locations: {}, ties: {}};
    
    $('.groups input:checked').each(function(i, elm){
        var groupId = $(this).parents('li.group').data('id');
        if(!selectedGroups[groupId]){
            selectedGroups[groupId] = 0;
        }
        selectedGroups[groupId]++;

        selectedEntities[$(this).data('id')] = groupId;
    });
    

    for(groupId in selectedGroups){
        if(selectedGroups[groupId] == size(annotation_data.annotation.groups[groupId].entities)){
            fullySelectedGroups.push(groupId);
        }
    }

    selectedEntitiesSize = size(selectedEntities);
    selectedGroupsSize = size(selectedGroups);

    // Case 1.
    if(selectedGroupsSize == 1 && fullySelectedGroups.length == 1){
        console.log("Case 1");
        return;
    }

    // Case 2.
    if(fullySelectedGroups.length == 0){
        console.log("Case 2", selectedEntities, selectedGroups, fullySelectedGroups);
        // Create a new id.
        var newGroupId = 0;
        while(annotation_data.annotation.groups[newGroupId+''] !== undefined){
            newGroupId++;
        }
        annotation_data.annotation.groups[newGroupId] = {
            name: null,
            entities: {}
        };

        // Move entities there and remove them from the old ones.
        for(entityId in selectedEntities){
            var oldGroupId = selectedEntities[entityId];
            // TODO -- this needs to go to the server!
            changes.entities[entityId] = {group_id: newGroupId};
            annotation_data.annotation.entities[entityId].group_id = newGroupId;

            delete annotation_data.annotation.groups[oldGroupId].entities[entityId];

            if(annotation_data.annotation.groups[newGroupId].name == null){
                // TODO -- this needs to go to the server.
                changes.groups[newGroupId] = {name:  
                    annotation_data.annotation.entities[entityId].name};
                annotation_data.annotation.groups[newGroupId].name = 
                    annotation_data.annotation.entities[entityId].name;
            }
            annotation_data.annotation.groups[newGroupId].entities[entityId] = 
                annotation_data.annotation.entities[entityId];
        }

    // Case 3.
    } else {
        console.log("Case 3");
        var targetGroupId = fullySelectedGroups[0];
        
        // Move entities there and remove them from the old ones.
        for(entityId in selectedEntities){
            var oldGroupId = selectedEntities[entityId];

            // Skip this one if it's part of the target group already.
            if(oldGroupId == targetGroupId) continue;

            // TODO -- this needs to go to the server!
            changes.entities[entityId] = {group_id: targetGroupId}
            annotation_data.annotation.entities[entityId].group_id = targetGroupId;

            delete annotation_data.annotation.groups[oldGroupId].entities[entityId];

            annotation_data.annotation.groups[targetGroupId].entities[entityId] = 
                annotation_data.annotation.entities[entityId];

        }

        // Delete the old fully selected groups.
        for(i = 0; i < fullySelectedGroups.length; i++){
            groupId = fullySelectedGroups[i];

            // Skip if this is the target group.
            if(groupId == targetGroupId) continue;

            // TODO -- this needs to go to the server!
            changes.groups[groupId] = "DELETE";
            delete annotation_data.annotation.groups[groupId];
        }
    }

    console.log(annotation_data);
    console.log(`To: /json/annotations/${annotation_data.annotation_id}`, {_method: 'PATCH', data: JSON.stringify(changes)});
    // Upload changes to the server.
    $.post({
        url: `/json/annotations/${annotation_data.annotation_id}`,
        data: {_method: 'PATCH', data: JSON.stringify(changes)},
        success: function(data){
            $('#response').html(`Updating modifications `+
                `(${JSON.stringify(changes)}) `+
                `${JSON.stringify(data, null, 4)}`);
        },
        error: function(jqXHR, textStatus, errorThrown){
            $('#response').html('ERROR: '+ errorThrown);
            console.log(jqXHR, textStatus, errorThrown);
        }
    });

    // This isn't efficient! 
    displayAnnotation(annotation_data);
};

var pollTextStatus = function(id){
    var attemptNo = 0;

    // Cancel existing timeouts.
    if(timeoutId !== undefined){
        clearTimeout(timeoutId);
    }

    var getTextInfo = function(){
        $.get({
            url: 'json/texts/'+id,
            success: function(data){


                $('#response').html('Attempt '+ attemptNo +'\n'+
                    JSON.stringify(data, null, 4));
                if(data.success && ''+data.text.processed === '0'){
                    attemptNo++;
                    timeoutId = setTimeout(getTextInfo, 2500);
                } else if(data.success) {
                    currentTextId = id;

                    $('#title').html(data.text.title);

                    displayAnnotation(data);
                }
            }
        });
    };
    getTextInfo();
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

var getAnnotation = function(){
    var annotationId = $(this).data('id');

    console.log(`json/annotations/${annotationId}`);

    $.get({
        url: `json/annotations/${annotationId}`,
        success: function(data){
            console.log(data);
            $('#response').html(JSON.stringify(data, null, 4));
            

            displayAnnotation(data.annotation_data);

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
            '</span>'+ tokens[i][WHITESPACE_AFTER];
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
    // TODO

    // This is just to test things quick and dirty.
    var i, j, location;
    for(i = 0; i < locationKeys.length; i++){
        location = annotation_data.annotation.locations[locationKeys[i]];
        var entityGroupId = annotation_data.annotation.entities[location.entity_id].group_id;
        for(j = location.start; j <= location.end; j++){
            $element.find(`[data-token=${j}]`).
                addClass(`g${entityGroupId}`). 
                addClass('entity').
                attr({
                    'data-entity-id': location.entity_id,
                    'data-group-id': entityGroupId
                }).
                // Wrap all entities in an invisible button
                // Note: simply adding "onClick" to text is an ugly solution, hence the button wrap
                wrap("<button class='annotated-entity'></button>");

        }
    }
}

var existingEntityClicked = function(event) {
    // TODO
    // Allow for multiple groups to be selected at once

    var clickedEntity = $(this).find('.entity');
    var group = clickedEntity.attr('data-group-id');

    if (clickedEntity.hasClass('selectedEntity')) {
        $('[data-group-id=' + group + ']').filter('span').each(function() {
        	// Cannot use JQuery selector because entity isn't the only class
            if ($(this).hasClass('entity')) {
                $(this).removeClass('selectedEntity');
            }
        })
        $('[data-id=' + group + ']').filter('li').each(function() {
        	// Cannot use JQuery selector because group may not always be the only class
        	if ($(this).hasClass('group')) {
    	        $(this).click();
    	        // Uncheck the checkbox
    	        $(this).find('input').prop('checked', 0);
        	}
        })
        return;
    }

    // Might need this later to manipulate the groups ; TODO
    var groupIDs =[];
    var numberOfEntitiesInGroup = 0;

	// Function to find every element in group
	$('[data-group-id=' + group + ']').filter('span').each(function() {
		// Cannot use JQuery selector because entity isn't the only class
		if ($(this).hasClass('entity')) {
			$(this).addClass('selectedEntity');
			groupIDs[numberOfEntitiesInGroup] = $(this).attr("data-token");
			numberOfEntitiesInGroup++;
		}
	})
    //  Find group in group list
    $('[data-id=' + group + ']').filter('li').each(function() {
    	// Cannot use JQuery selector because group may not always be the only class
    	if ($(this).hasClass('group')) {
	        $(this).click();
	        // Check the checkbox
	        $(this).find('input').prop('checked', 1);
    	}
    })

    /*
        TODO - INTELLIGENTLY POPULATE CONTEXT MENU FOR CLICKED ENTITIES
    */

    var contextMenuOptions;

    openContextMenu(contextMenuOptions);
}

var checkSelectedText = function(event) {
	// if nothing is selected, return
	if (window.getSelection().toString() == "") return;

	var textSpans = [];
	var textSpans = getSelectedSpans();

	if (textSpans === []) {
		return;
	} 

    // get unused group ID
	var newGroupID = Object.keys(annotation_data.annotation.groups).length + 1;

    var contextMenuOptions = [];
    contextMenuOptions[0] = "<li class='context-menu__item'><a href='#' id='addGroupOption' class='context-menu__link'><i>Add Group</i></a></li>";

    menuDataToPass = {
        textSpans: textSpans,
        newGroupID: newGroupID
    }

    openContextMenu(contextMenuOptions);
}

function getSelectedSpans() {
	var startSpan;
	var endSpan;
	var spans = [];
	var spanCount = 0;

    sel = window.getSelection();
    startSpan = sel.anchorNode.parentElement;
    endSpan = sel.extentNode.parentElement;

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

var addGroupFromSelected = function() {
    // create new annotation_data group
    var entities = {};
    for (var i = 0; i < textSpans.length; i++) {
        entities[i] = {
            group_id: menuDataToPass.newGroupID,
            name: menuDataToPass.textSpans[i].innerHTML
        }
    }

    // append new annotation_data group
    annotation_data.annotation.groups[newGroupID] = {
        name: menuDataToPass.textSpans[0].innerHTML,
        entities
    };

    console.log(annotation_data.annotation.groups);
}

var openContextMenu = function(options, clickedEntity) {
    if (options == null) return;

    var active = "context-menu--active";


    /*
        WHAT THE ACTUAL HELL
    */




    $('.context-menu__items').empty();
    options.forEach(function(entry) {
        $('.context-menu__items').text($('.context-menu__items').text() + entry);
    });

    if (menuOpen !== 1) {
        menuOpen = 1;
        menu.classList.add(active);
    
        if (clickedEntity == null) {
            var menuPosition = getPositionForMenu(event);
        } else {
            var menuPositon = getPositionForMenu(event, clickedEntity);
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
        // Not a useless function
        // Also used in global click function.
    }
}

var closeContextMenu = function() {
	menuOpen = 0;
	menu.classList.remove("context-menu--active");

    $('.context-menu__items').html("");
}

// @ entity
function getPositionForMenu(e, clickedEntity) {
	var offset = clickedEntity.parent().offset();

	return {
		y: offset.top + clickedEntity.parent().height(),
		x: offset.left + clickedEntity.parent().width()
	}
}

// @ mouse position
function getPositionForMenu(e) {
    return {
        y: e.clientY,
        x: e.clientX
    }
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
    $(document).on('click', '#get-annotations', getAnnotations);
    $(document).on('click', '.get-annotation', getAnnotation);
    $(document).on('click', '.group .select-all', selectAllInGroup);
    $(document).on('click', '#group-selected', groupSelected);
    $(document).on('click', '.logout-button', ()=>{$('#logout-form').submit()});

    
    // Manual Annotation
    menu = document.querySelector(".context-menu");
    $(document).on('click', '.annotated-entity', existingEntityClicked);
    $(document).mouseup(checkSelectedText);
    
    // Close Context menu on click
    $(document).on('click', closeContextMenu);
    // Close context menu with escape key
    $(document).keyup(function(e) { if (e.keyCode == 27) closeContextMenu();})
    // Close context menu when window is resized
    $(window).on('resize', closeContextMenu);
    // Close context menu on text are scroll
    $("span").scroll(closeContextMenu);
    $("div").scroll(closeContextMenu);

    // Context Menu Options
    $('#addGroupOption').on('click', addGroupFromSelected);


    // Autofocus the first input of a modal.
    $('.modal').on('shown.bs.modal',()=>{$(this).find('input').focus()});




});