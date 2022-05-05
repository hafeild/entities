var timeoutId;
var currentTextId = null;
var annotation_data = null;
var annotationManager = null;
var entitiesPanelManager = null;

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

var menu;
var mouseClicked = 0;
var menuTimer = null;

/**
 * Converts a string with potentially embedded HTML into text with HTML entities
 * instead. 
 */
var cleanHTML = function(s) {
    return String(s).
        replace(/&/g, '&amp;').
        replace(/</g, '&lt;').
        replace(/>/g, '&gt;');
}

var editTieNetworkViz = null;

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

var size = function(obj){
    var s = 0;
    for(var x in obj) s++;
        return s;
}




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



// Helper functions.
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


////////////////////////////////////////////////////////////////////////////////
// MANUAL ANNOTATION MANIPULATION FUNCTIONS
////////////////////////////////////////////////////////////////////////////////




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
    var edgeGML = "";
    $.each(edges, function(index, edge) {
        edgeGML = `<edge id="${edge.id}" source="${nodes[edge.source].label}" target="${nodes[edge.target].label}" `;
        if (typeof edge.is_directed !== typeof undefined && typeof edge.is_directed !== typeof null && edge.is_directed) {
            edgeGML += `directed="true">`;
        } else {
            edgeGML += `>`;
        }
        lines.push(edgeGML);
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

var exportAsSVG = function() {
    var svgData = $("#network-svg")[0].outerHTML;
    var svgBlob = new Blob([svgData], {type:"image/svg+xml;charset=utf-8"});
    var svgUrl = URL.createObjectURL(svgBlob);
    var downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = "network.svg";
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

var exportAsSVG = function() {
    var svgData = $("#network-svg")[0].outerHTML;
    var svgBlob = new Blob([svgData], {type:"image/svg+xml;charset=utf-8"});
    var svgUrl = URL.createObjectURL(svgBlob);
    var downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = "network.svg";
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

var exportAsPNG = function() {
    $('body').append('<canvas id="svg-canvas"></canvas>');

    targetCanvas = $('#svg-canvas')[0];

    // https://developer.mozilla.org/en/XMLSerializer
    svg_xml = (new XMLSerializer()).serializeToString($('#network-svg')[0]);
    var ctx = targetCanvas.getContext('2d');

    var img = new Image();
    // http://en.wikipedia.org/wiki/SVG#Native_support
    // https://developer.mozilla.org/en/DOM/window.btoa
    img.src = "data:image/svg+xml;base64," + btoa(svg_xml);

    img.onload = function() {
        ctx.drawImage(img, 0, 0);
    }

    var link = document.createElement('a');
      link.download = 'network.png';
      link.href = $('#svg-canvas')[0].toDataURL()
      link.click();
    link.remove();
}

/**
 * Toggles maximizing and shrinking the text panel.
 */
function toggleFullscreen() {
    $('body').toggleClass('fullscreen');
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
    $(document).on('click', '.logout-button', ()=>{$('#logout-form').submit()});

    // Bootstrap tooltips.
    $('[data-toggle="tooltip"]').tooltip()



    // Resize the content based on the size of the nav bar header.
    $('body').css('padding-top', $('.navbar-fixed-top').height()+'px');
    $(window).on('resize', function(){
        $('body').css('padding-top', $('.navbar-fixed-top').height()+'px');
    });


    // Autofocus the first input of a modal.
    $('.modal').on('shown.bs.modal',function(){
        console.log('focusing on the first input.');
        $(this).find('input')[0].focus();
    });
});