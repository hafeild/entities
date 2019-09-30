var timeoutId;
var currentTextId = null;
var annotation_data = null;
var annotationManager = null;

// Context Menu
var menuOpen = 0;
var menu;

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

    var groupList = $(".groups li");
    var clickedEntity = $(this).find('.entity');

    // This is gross, but I am not sure I have any other way of extracting the entity group class tag
    var classesAsString = clickedEntity.attr("class");
    var groupName = classesAsString.replace(/ .*/, '');

    if (clickedEntity.hasClass('selectedEntity')) {
        $('.' + groupName).each(function() {
            if ($(this).hasClass('entity')) {
                $(this).removeClass('selectedEntity');
            }
        })
        groupList.each(function(idx, li) {
            var group = $(li);
            if (group.find('span').hasClass(groupName)) {
                group.click();
                // Check the checkbox
                group.find('input').prop('checked', 0);
            }
        });
        return;
    }

    // Might need this later to manipulate the groups ; TODO
    var groupIDs =[];
    var numberOfEntitiesInGroup = 0;

	// Function to find every element in group
	$('.' + groupName).each(function() {
		// Note that this particular $(this) is different than the $(this) in var clicked
		if ($(this).hasClass('entity')) {
			$(this).addClass('selectedEntity');
			//$(this).wrap("<div class='highlighted'></div>");
			groupIDs[numberOfEntitiesInGroup] = $(this).attr("data-token");
			numberOfEntitiesInGroup++;
		}
	})
    //  Find group in group list
    groupList.each(function(idx, li) {
        var group = $(li);
        if (group.find('span').hasClass(groupName)) {
            group.click();
            // Check the checkbox
            group.find('input').prop('checked', 1);
        }
    });

	// Context Menu
	var active = "context-menu--active";

	if (menuOpen !== 1) {
		menuOpen = 1;
		menu.classList.add(active);
	
		var menuPosition = getPositionForMenu(event);

		// Coordinates
		menu.style.left = menuPosition.x + "px";
		menu.style.top = menuPosition.y + "px";

		// Dimensions
		var menuWidth = menu.offsetWidth;
		var menuHeight = menu.offsetHeight;


	} else {
		closeContextMenu();
		// Not a useless function
		// Also used in global click function.
	}


}

var closeContextMenu = function() {
	if (!$(this).find('.entity').hasClass('entity')) {
		menuOpen = 0;
		menu.classList.remove("context-menu--active");
	}
}

// from https://www.sitepoint.com/building-custom-right-click-context-menu-javascript/
// temporary
function getPositionForMenu(e) {
  var posx = 0;
  var posy = 0;

  if (!e) var e = window.event;

  if (e.pageX || e.pageY) {
    posx = e.pageX;
    posy = e.pageY;
  } else if (e.clientX || e.clientY) {
    posx = e.clientX + document.body.scrollLeft + 
                       document.documentElement.scrollLeft;
    posy = e.clientY + document.body.scrollTop + 
                       document.documentElement.scrollTop;
  }

  return {
    x: posx,
    y: posy
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
    // $(document).on('click', '#get-annotations', getAnnotations);
    // $(document).on('click', '.get-annotation', getAnnotations);
    $(document).on('click', '.group .select-all', selectAllInGroup);
    $(document).on('click', '#group-selected', groupSelected);
    $(document).on('click', '.logout-button', ()=>{$('#logout-form').submit()});

    
    // Manual Annotation
    menu = document.querySelector(".context-menu");
    $(document).on('click', '.annotated-entity', existingEntityClicked);
    
    // Close Context menu on click
    $(document).on('click', '.main-app', closeContextMenu);
    // Close context menu with escape key
    $(document).keyup(function(e) { if (e.keyCode == 27) closeContextMenu();})
    // Close context menu when window is resized
    $(window).on('resize', closeContextMenu);
    // Close context menu on text are scroll
    $("span").scroll(closeContextMenu);
    $("div").scroll(closeContextMenu);


    // Autofocus the first input of a modal.
    $('.modal').on('shown.bs.modal',()=>{$(this).find('input').focus()});




});