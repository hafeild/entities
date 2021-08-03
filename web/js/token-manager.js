// File: text-panel-manager.js
// Author: Hank Feild
// Date: 2021-07-21
// Purpose: Provides functions for interacting with the text panel on an
//          annotation page.


/**
 * Handles specifically the token rendering, iteration, etc. in the text panel.
 * 
 * @param textPanelManager An instance of the parent TextPanelManager instance.
 */
var TokenManager = function(textPanelManager){
    var self = {
        textPanelManager: textPanelManager,
        tokens: undefined
    };

    const TOKEN_CONTENT = 0;
    const WHITESPACE_AFTER = 1;
    const START = 0;
    const END = 1;
    const IS_DISPLAYED = 2;
    const PAGE_SIZE = 1000;
    const TOKEN_MARGIN = 200; // Where to start looking for a newline.
    const APPEND_NEXT_PAGE_INTERVAL = 100;
    // const APPEND_NEXT_PAGE_INTERVAL = -1;
    const SCROLL_DELAY = 150; // Amount of time to wait for scroll to stop before highlighting.
    var contentPages = []; // tuples: [startIndex, endIndex, isDisplayed]
    var currentPage = 0;
    var locationsByPages = [];

    // TODO -- this should be accessed via annotationManager in the future so that
    // changes are saved to and loaded from the server.
    // A list of mentions to suggest.
    var suggestedMentions = [];

    /**
     * Processes the tokenized content (made available in the annotation view HTML,
     * just below the #text-panel element). This includes splitting it into pages of
     * roughly PAGE_SIZE (plus or minus TOKEN_MARGIN) and then rendering the first
     * few pages with annotations highlighted.
     *
     * Token ranges for pages are held in the global `contentPages`, which consists
     * of an array of 3-tuples [tokenStartIndex, tokenEndIndex, isDisplayed]. 
     * The index within `contentPages` is the page number, starting at 0.
     *
     * This function also initializes the global `locationsByPages` array, each
     * element of which is the subset of keys in the
     * `annotation_data.annotation.locations` object. The index corresponds to the
     * content page index and aligns with `contentPages`. A location is considered a
     * part of a page if either its start or end location falls within the bounds of
     * the page: [tokenStartIndex, tokenEndIndex].
     *
     * Places listeners for when the content is scrolled and new content is needed.
     */
    self.initializeTokenizedContent = function(){
        // Split into pages.
        contentPages = [];
        var pageStart = 0;
        var tokenIndex = Math.min(pageStart+PAGE_SIZE-TOKEN_MARGIN, self.tokens.length-1);
        var locationKey, i;

        while(tokenIndex < self.tokens.length){
            // Check if we're at the last token OR if we've hit a natural break
            // (a new line).
            if(tokenIndex === self.tokens.length-1 || 
                self.tokens[tokenIndex][1].indexOf("\n") >= 0) {

                contentPages.push([pageStart, tokenIndex, false]);
                // Initialize the list of locations for this page.
                locationsByPages.push([]); 

                pageStart = tokenIndex+1;
                tokenIndex = pageStart + PAGE_SIZE - TOKEN_MARGIN;

            // Check if we've hit a page boundary.
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

        // Add the final bit of text to the set of content pages.
        if(pageStart < self.tokens.length){
            contentPages.push([pageStart, self.tokens.length-1, false]);
            // Initialize the list of locations for this page.
            locationsByPages.push([]);
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

        // // Set listeners for when the end of a page is reached.
        // $('#text-panel').on('scroll', null, (event)=>{
        //     elementIsVisibleInTextPanel(event, $('#end-marker'), ($elm) => {
        //         appendContentPage(currentPage+1);
        //     });
        // });

        // Creates text-only pages which are all displayed.
        for(i = 0; i < contentPages.length; i++){
            var pageHTML = `<span data-page="${i}" class="content-page">`;
            for(var j = contentPages[i][START]; j <= contentPages[i][END]; j++){
                pageHTML += self.tokens[j][TOKEN_CONTENT].replace('&', '&amp;').
                    replace('<', '&lt;').
                    replace('>', '&gt;');
                
                if (self.tokens[j][WHITESPACE_AFTER] === '\n') {
                    pageHTML += ' ';
                } else {
                    pageHTML += self.tokens[j][WHITESPACE_AFTER];
                }
            }
            pageHTML += '</span>';
            $('#end-marker').before(pageHTML);
        }


        // Display the first page.
        //appendContentPage(0, APPEND_NEXT_PAGE_INTERVAL);
        setTimeout(function(){ annotatePagesOnDisplay(1, 50); }, SCROLL_DELAY);
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
     * Listens for scrolls in the #text-panel. When a page is viewed, it and the 
     * `pagesMargin` pages just before and after will be annotated. All other pages
     * will be unannotated.
     * 
     * @param {number} pagesMargin The number of pages before and after to 
     *                              annotate. This should be at least 1.
     * @param {number} delay The number of milliseconds to wait after a scroll
     *                        event (with no other scroll events occurring) to 
     *                        annotate.
     */
    var annotatePagesOnDisplay = function(pagesMargin, delay){
        var timeoutId = 0;
        var annotating = false;

        var annotate = function(){
            //console.log('[annotate] Entering');
            if(annotating === true){ 
                //console.log('[annotate] Leaving (annotating==true)');
                return; 
            }

            annotating = true;

            var previouslyAnnotatedPages = 
                $('#text-panel .content-page[data-is_displayed=1]');

            // Find what pages are visible + margin.
            var pagesToAnnotate = findPagesInView();
            if(pagesToAnnotate.length == 0){
                annotating = false;
                //console.log('No pages to annotate!');
                return;
            }

            var firstVisiblePageIndex = parseInt(pagesToAnnotate[0].data('page'));
            var lastVisiblePageIndex = parseInt(
                pagesToAnnotate[pagesToAnnotate.length-1].data('page'));
            var firstAnnotatedPageIndex = Math.max(0, 
                firstVisiblePageIndex-pagesMargin);
            var lastAnnotatedPageIndex = Math.min(contentPages.length-1, 
                lastVisiblePageIndex+pagesMargin);
            var i;

            // Annotate the visible pages (we want this to happen ASAP).
            for(i = firstVisiblePageIndex; i <= lastVisiblePageIndex; i++){
                annotateContentPage(i);
            }

            // Add "previous page" margin and annotate them.
            for(i = firstVisiblePageIndex-1; i >= firstAnnotatedPageIndex; i--){
                annotateContentPage(i);
            }

            // Add "next page" margin.
            for(i = lastVisiblePageIndex+1; i <= lastAnnotatedPageIndex; i++){
                annotateContentPage(i);
            }
    
            // Find what pages are currently marked up
                // - unannotate them if they are not part of the set to annotate.
            previouslyAnnotatedPages.each(function(i, elm){
                var $elm = $(elm);
                var pageIndex = parseInt($elm.data('page'));
                // console.log(`[annotate] checking if page ${pageIndex} should be unannotated.`, elm);
                if(pageIndex < firstAnnotatedPageIndex || 
                    pageIndex > lastAnnotatedPageIndex){

                    // console.log('[annotate] yes');
                    unannotateContentPage($elm);
                } else {
                    // console.log('[annotate] no');

                }
            });

            annotating = false;
            //console.log('[annotate] Leaving');

        };

        var onScroll = function(event){
            //console.log('[onScroll] Entering');

            if(timeoutId){
                //console.log(`[onScroll] clearing timeout ${timeoutId}`);
                clearTimeout(timeoutId);
            }

            // if(annotating === true){
            //     console.log('[onScroll] annotating == true; setting timeout for onScroll');
            //     timeoutId = setTimeout(function(){onScroll(event);}, 200);
            // } else {
                // console.log('[onScroll] annotating == false; setting timeout for annotate');
                timeoutId = setTimeout(annotate, delay);
            // }

            //console.log('[onScroll] Leaving');

        };

        $('#text-panel').on('scroll', onScroll);
        onScroll();
    };

    /**
     * Reannotates the currently annotated pages. Use this, e.g., when the
     * underlying data has changed.
     */
    self.reannotatePagesAnnotatedPages = function(){
        $('#text-panel .content-page[data-is_displayed=1]').each(function(i,elm){
            annotateContentPage($(elm), true);
        });
    };

    /**
     * Finds the pages that are in view at the given scroll offset in the 
     * #text-panel element.
     * 
     * @param {integer} scrollTop The #text-panel scroll position to consider. If 
     *                            undefined, the current position is used.
     *                           
     * @return A list of .content-page jQuery elements.
     */
    var findPagesInView = function(scrollTop){
        // console.log('[findPagesInView] Entering');

        var $textPanel = $('#text-panel');
        var viewportTop = (
            scrollTop === undefined ? $textPanel.scrollTop() : scrollTop) + 
            // This accounts for the padding present before pages are displayed.
            $textPanel.find('.content-page[data-page="0"]').position().top;
        var viewportBottom = $textPanel.height();

        var pagesInView = [];
        var min = 0, max = contentPages.length, mid = Math.floor((min+max)/2);
        var page, prevPage, nextPage;

        var getPageTopBottom = function(pageNum){
            var $page = $textPanel.find(`.content-page[data-page="${pageNum}"]`);
            var pageTop, pageBottom;
            if($page.length > 0){
                pageTop = $page.position().top;
                pageBottom = pageTop + $page.height();
            }
            return {$elm: $page, top: pageTop, bottom: pageBottom, index: pageNum};
        }

        while(max >= min){

            page = getPageTopBottom(mid);

            // console.log(`[findPagesInView] viewportTop: ${viewportTop}; `+
            //    `viewportBottom: ${viewportBottom}; pageNum: ${page.index}; `+
            //    `pageTop: ${page.top}; pageBottom: ${page.bottom}`);

            // Found a visible page. Now find all the surrounding pages that are
            // displayed and add them to `pagesInView`.
            if(page.top <= viewportBottom && page.bottom >= viewportTop){

                //console.log(`[findPagesInView] Found page in view: ${page.index}`);

                pagesInView.push(page.$elm);

                // Find previous pages that are visible.
                prevPage = getPageTopBottom(mid-1);
                while(prevPage.index >= 0 && 
                        prevPage.bottom >= viewportTop){
                    //console.log(`[findPagesInView] Adding prev page ${prevPage.index} `+
                    //    `because ${prevPage.bottom} >= ${viewportTop}`);
                    
                    pagesInView.push(prevPage.$elm);
                    prevPage = getPageTopBottom(prevPage.index-1);
                }

                // Find following pages that are visible.
                nextPage = getPageTopBottom(mid+1);
                while(nextPage.index < contentPages.length && 
                        nextPage.top <= viewportBottom){

                    
                    //console.log(`[findPagesInView] Adding next page ${nextPage.index} `+
                    //    `because ${nextPage.bottom} <= ${viewportBottom}`);
                    pagesInView.push(nextPage.$elm);
                    nextPage = getPageTopBottom(nextPage.index+1);            
                }

                //console.log('[findPagesInView] Leaving', pagesInView);
                return pagesInView;

            // Search later pages.
            } else if(page.bottom < viewportTop) {
                min = mid+1;
                mid = Math.floor((min+max)/2);

            // Search earlier pages.
            } else {
                max = mid-1;
                mid = Math.floor((min+max)/2);
            }
        }

        //console.log('[findPagesInView] Leaving', pagesInView);
        return pagesInView;
    };


    /**
     * Generates the HTML for the given page of tokens and replaces the text-only
     * page in the #text-panel element with it. If the page is displayed and 
     * refresh is false or unset, then no action is taken.
     * 
     * @param {integer | jQuery element} pageElmOrIndex The index of the page to 
     *                                                  annotate in the #text-panel.
     * @param {boolean} refresh If true, refreshes the page if it's already
     *                          displayed. Default: false.
     */
    var annotateContentPage = function(pageElmOrIndex, refresh) {
        //console.log('[annotateContentPage] Entering', pageElmOrIndex);

        var $newPageElm = pageElmOrIndex;
        var pageIndex = pageElmOrIndex;

        if(typeof pageElmOrIndex === "number"){
            $newPageElm = $(`#text-panel .content-page[data-page="${pageElmOrIndex}"]`); 
        } else {
            pageIndex = parseInt($newPageElm.data('page'));
        }

        if(!refresh && $newPageElm.attr('data-is_displayed') === '1') return;


        // Replace the text-only content with span-wrapped HTML.
        $newPageElm.html(tokensToHTML(contentPages[pageIndex][START], 
            contentPages[pageIndex][END]));

        contentPages[pageIndex][IS_DISPLAYED] = true;
        currentPage = pageIndex;

        // Highlight locations for this page.
        //console.log(`[annotateContentPage] Highlighting entities`);
        highlightEntitiesInContent(locationsByPages[pageIndex], $newPageElm);
        //console.log(`[annotateContentPage] Highlighting ties`);
        highlightTiesInContent(contentPages[pageIndex][START], 
            contentPages[pageIndex][END], $newPageElm, annotationManager.ties);
        markSuggestedMentions(suggestedMentions[pageIndex], $newPageElm);

        $newPageElm.attr('data-is_displayed', '1');

        //console.log(`[annotateContentPage] Leaving`);
    }

    /**
     * Removes all annotations and HTML markup from a content page in the 
     * #text-panel.
     * 
     * @param {integer | jQuery element} pageElmOrIndex The index of the page in the 
     *                                                  #text-panel to remove HTML 
     *                                                  from.
     */
    var unannotateContentPage = function(pageElmOrIndex){
        // console.log('[unannotateContentPage] Entering');


        var $newPageElm = pageElmOrIndex;
        var pageIndex = pageElmOrIndex;

        if(typeof pageElmOrIndex === "number"){
            $newPageElm = $(`#text-panel .content-page[data-page="${pageElmOrIndex}"]`); 
        } else {
            pageIndex = parseInt($newPageElm.data('page'));
        }

        if($newPageElm.attr('data-is_displayed') !== '1'){
            // console.log(`[unannotateContentPage] Leaving (is_displayed = ${$newPageElm.attr('data-is_displayed')})`);
            return;
        }


        $newPageElm.html($newPageElm.text());

        $newPageElm.attr('data-is_displayed', '0');
        contentPages[pageIndex][IS_DISPLAYED] = false;

        // console.log('[unannotateContentPage] Leaving');
    }


    /**
     * Generates the HTML for the given page of tokens an appends it to the
     * #text-panel element, before the #end-marker element.
     * 
     * @param {integer} pageIndex The index of the page to append to the #text-panel.
     * @param {boolean} appendNextTimeout The number of milliseconds to wait before 
     *                                    appending the next content page. -1 means 
     *                                    do not append the next page automatically.
     *                                    Default: -1
     */
    var appendContentPage = function(pageIndex, appendNextTimeout) {
        console.log(`Top of appendContentPage(${pageIndex} ${appendNextTimeout})`);
        if(contentPages[pageIndex][IS_DISPLAYED]) return;

        console.log('   `--> Appending content page.');
        

        var html = `<span data-page="${pageIndex}" class="content-page">`+ 
        tokensToHTML(contentPages[pageIndex][START], 
            contentPages[pageIndex][END]
            ) +'</span>';
        contentPages[pageIndex][IS_DISPLAYED] = true;

        currentPage = pageIndex;

        console.log(`[appendContentPage] Inserting new html`);
        var $newPageElm = $(html);
        $('#end-marker').before($newPageElm);

        // Highlight locations for this page.
        console.log(`[appendContentPage] Highlighting entities`);
        highlightEntitiesInContent(locationsByPages[pageIndex], $newPageElm);
        console.log(`[appendContentPage] Highlighting ties`);
        highlightTiesInContent(contentPages[pageIndex][START], 
            contentPages[pageIndex][END], $newPageElm, annotationManager.ties);
        

        // Load the next page after the specified timeout, if one was given.
        if(appendNextTimeout !== undefined && appendNextTimeout >= 0 && 
            pageIndex < contentPages.length-1){
            console.log(`[appendContentPage] setting timeout to append next page`);

            setTimeout(function(){
                appendContentPage(pageIndex+1, appendNextTimeout);
            }, appendNextTimeout);
        }


        console.log(`[appendContentPage] Leaving`);

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
            html += `<span data-token="${i}" class="token">`+ 
            self.tokens[i][TOKEN_CONTENT].replace("&", "&amp;").
            replace("<", "&lt;").
            replace(">", "&gt;") +
            '</span>';
            if (self.tokens[i][WHITESPACE_AFTER] === "\n") {
                html += '<span class="whitespace"> </span>';
            } else {
                html += '<span class="whitespace">'+ 
                    self.tokens[i][WHITESPACE_AFTER] + '</span>';
            }
        }
        return html;
    };

    /**
     * Tests if the given element is visible in the #text-panel element.
     * 
     * @param {Event} event The DOM scroll event that triggered this listener.
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
    self.iterateOverTokens = function($element, start, end, func){
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
        // console.log(`[highlightEntitiesInContent] entering (locationKeys, element):`,
            // locationKeys, $element);

        var i, j, location, $token, tokenId, prevTokenId;
        for(i = 0; i < locationKeys.length; i++){
            location = annotation_data.annotation.locations[locationKeys[i]];

            if(!location){
                console.log("location null; locationKeys:", locationKeys, "i:", i);
            }

            var entityGroupId = annotation_data.annotation.
                entities[location.entity_id].group_id;
            

            // Moves down each token in the location, including the spaces.
            self.iterateOverTokens($element, location.start, location.end, 
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

        // console.log(`[highlightEntitiesInContent] leaving`);
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



            self.iterateOverTokens($element, Math.max(tie.start, tokenStartIndex), 
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

    /**
     * Marks suggested entity mentions in the given text content element. 
     * Tokens in the given element must contain an data-id="..." attribute with the token's id. Colors
     * are chosen by the global pallet. 
     *
     * @param {object{}} suggestedMentions A map of keys to suggested mentions
     *                                        specific to the $element. Each should 
     *                                        the fields:
     *              - entity_id
     *              - start (the token id where the mention starts)
     *              - end (the token id where the mention ends)
     *              - page_start (the content page where the mention begins)
     *              - page_end (the content page where the mention stops)
     * @param {jQuery Element} $element The element to highlight entities in.
     */
    var markSuggestedMentions = function(suggestedMentions, $element){
    //     // console.log(`[highlightEntitiesInContent] entering (locationKeys, element):`,
    //         // locationKeys, $element);

        for(let key in suggestedMentions){
            let mention = suggestedMentions[key];

            var entityGroupId = annotation_data.annotation.
                entities[mention.entity_id].group_id;
            

            // Moves down each token in the location, including the spaces.
            self.iterateOverTokens($element, mention.start, mention.end, 
                function($token, tokenId, isWhitespace){

                $token.
                    addClass(`g${entityGroupId}`). 
                    addClass('entity').
                    addClass('suggested-entity').
                    attr({
                        'data-entity-id': mention.entity_id,
                        'data-group-id': entityGroupId,
                        'data-location-id': key  
                    });
                // incrementDataAttribute($token, 'entity-count');

                // Special treatment for the first and last tokens.
                if(tokenId == mention.start){
                    $token.addClass('start-token');
                    // incrementDataAttribute($token, 'start-token-count');
                }
                if(tokenId == mention.end){
                    $token.addClass('end-token');
                    // incrementDataAttribute($token, 'end-token-count');
                }
            });
    }

    //     // console.log(`[highlightEntitiesInContent] leaving`);
    }

    /**
     * Finds the mentions associated with the given token span.
     * 
     * @param {number} tokenStartId The id of the first token in the span.
     * @param {number} tokenEndId The id of the last token in the span. 
     * @return A list of mention ids that subsume the range of tokens.
     */
    var findSupersetMentions = function(tokenStartId, tokenEndId){
        var supersetMentions = [];
        for(let locationId in annotationManager.locations){
            let mention =  annotationManager.locations[locationId];
            if(mention.start <= tokenStartId && mention.end >= tokenEndId){
                supersetMentions.push(locationId);
            }
        }
        return supersetMentions;
    }


    /**
     * Finds the mentions in the text that match the given entity (sequence of 
     * tokens).
     * 
     * @param {string[]} entityTokens A sequence of tokens representing an entity.
     * @param {number} entityId The id of the entity.
     * @return A list of locations where the entity is mentioned. Each mention is
     *         an object with these fields:
     *              - entity_id
     *              - start (the token id where the mention starts)
     *              - end (the token id where the mention ends)
     *              - page_start (the content page where the mention begins)
     *              - page_end (the content page where the mention stops)
     */
    self.findMentionsOfEntity = function(entityTokens, entityId){
        var mentions = [];
        var entityTokensText = [];
        var startingPage, endingPage, i, j;
        var matchFound;

        // Replace html codes in entityTokens (&lt;, &gr; and &amp;)
        for(i = 0; i < entityTokens.length; i++){
            entityTokensText.push(entityTokens[i].replace("&amp;", "&").
            replace("&lt;", "<").
            replace("&gt;", ">"));
        }

        console.log('[findMentionsOfEntity]', entityTokens, entityTokensText);

        startingPage = 0;
        for(i = 0; i < self.tokens.length; i++){
            // See if we've crossed to a new page.
            if(i > contentPages[startingPage][END]){
                startingPage++;
            }
            endingPage = startingPage;
            matchFound = true;

            // See if there's a match starting here.
            for(j = 0; j < entityTokensText.length && j+i < self.tokens.length; j++){
                if(self.tokens[i+j][TOKEN_CONTENT] != entityTokensText[j]){
                    matchFound = false;
                    break;
                }
                console.log('Found a match:', self.tokens[i+j][TOKEN_CONTENT], 
                    entityTokensText[j]);
                // Advance ending page if we've crossed to the next page.
                if(i+j > contentPages[endingPage][END]){
                    endingPage++;
                }
            }

            let candidateMention = {
                page_start: startingPage,
                page_end: endingPage,
                start: i,
                end: i+entityTokensText.length-1,
                entity_id: entityId
            };

            // Add this mention if it's not a subset of an existing mention.
            if(matchFound && findSupersetMentions(
                candidateMention.start, candidateMention.end).length == 0){

                mentions.push(candidateMention);
            }
        }
    
        console.log('[findMentionsOfEntity] found these mentions:', mentions);
        return mentions;
    }

    /**
     * Adds each mention to the `suggestedMentions` object under its corresponding
     * page.
     * 
     * @param {object[]} mentions A list of entity mentions in the format returned
     *                            by `findMentionsOfEntity`.
     */
    self.addToSuggestedMentions = function(mentions){
        var i;
        for(i = 0; i < mentions.length; i++){
            let mention = mentions[i];
            let startPage = suggestedMentions[mention.page_start];
            if(startPage === undefined){
                suggestedMentions[mention.page_start] = {};
                startPage = suggestedMentions[mention.page_start];
            } 
            
            startPage[`${mention.start}_${mention.end}`] = mention;

            // // If this mention spans two pages, add it to both.
            // if(mention.page_start != mention.page_end){
            //     let endPage = suggestedMentions[mention.page_end];
            //     if(endPage === undefined){
            //         suggestedMentions[mention.page_end] = {};
            //         endPage = suggestedMentions[mention.page_end];
            //     }
            //     endPage[`${mention.start}_${mention.end}`] = mention;
            // }
        }
    }

    var initialize = function(){
        self.tokens = JSON.parse(textPanelManager.$textContents.
            html().replace(/,\s*\]\s*$/, ']'));
    };

    initialize();

    return self;
};