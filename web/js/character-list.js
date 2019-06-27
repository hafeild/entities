var timeoutId;
var currentTextId = null;
var annotation_data = null;

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
    $('#annotation-list').html('');

    var charListOuterElm = $('#character-list');
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
        list += `<input type="checkbox" data-id="${entityId}"> ${entities[entityId].name}`;
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
    var changes = {entities: {}, groups: {}, locations: {}, interactions: {}};
    
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
    console.log(`To: json/annotations/${annotation_data.annotation_id}`, {_method: 'PATCH', data: JSON.stringify(changes)});
    // Upload changes to the server.
    $.post({
        url: `json/annotations/${annotation_data.annotation_id}`,
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

$(document).ready(function(){
    //getTexts();
    showPage();
    window.onhashchange = showPage;
    $(document).on('click', '#get-texts', getTexts);
    $('#file-upload-form').on('submit', upload);
    $(document).on('click', 'a.onpage', loadText);
    $(document).on('click', '#add-annotation', addAnnotation);
    $(document).on('click', '#get-annotations', getAnnotations);
    $(document).on('click', '.get-annotation', getAnnotation);
    $(document).on('click', '.group .select-all', selectAllInGroup);
    $(document).on('click', '#group-selected', groupSelected);
    $(document).on('click', '.logout-button', ()=>{$('#logout-form').submit()});
    // Autofocus the first input of a modal.
    $('.modal').on('shown.bs.modal',()=>{$(this).find('input').focus()});
});