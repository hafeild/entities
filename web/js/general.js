// File: general.js
// Author: Hank Feild
// Date: 2021-05-28
// Purpose: Includes listeners for non-annotation related elements (e.g., 
//          renaming a text on its texts/:id/annotations page).


/**
 * Listens for a text to be renamed; updates the name on the server and in the
 * UI.
 */
function onTextTitleChange(event){
    var newTitle = this.newTextTitle.value;
    var uri = `/json${$('#annotations').data('uri')}`;
    var $errorAlert = $('#error-alert');
    $('#rename-modal').modal('hide');
    $errorAlert.addClass('hidden');

    // Send new name to server.
    $.ajax({
        url: uri,
        method: 'post',
        data: {
            title: newTitle,
            _method: 'PATCH'
        },
        success: function(data){
            if(data.success){
                $('.text-title').html(newTitle);
            } else {
                $errorAlert.find('.content').html(
                    'There was an error saving your title change: '+
                    data.message +'<br/>Please try again.');
                $errorAlert.removeClass('hidden');
            }
        },
        error: function(xhr, status, error){
            $errorAlert.find('.content').html(
                    'There was an error saving your title change: '+
                    status +', ' + error +'<br/>Please try again.');
            $errorAlert.removeClass('hidden');
        }
    });

    event.preventDefault();
    return false;
}

/**
 * Listens for an annotation to be renamed; updates the name on the server and
 * in the UI.
 */
function onAnnotationLabelChange(event){
    console.log(event);

    var newLabel = this.newAnnotationLabel.value;
    var uri = `/json${$('.page-info').data('uri')}`;
    var $errorAlert = $('#error-alert');
    $('#rename-modal').modal('hide');
    $errorAlert.addClass('hidden');

    // Send new name to server.
    $.ajax({
        url: uri,
        method: 'post',
        data: {
            label: newLabel,
            _method: 'PATCH'
        },
        success: function(data){
            if(data.success){
                $('.annotation-label').html(newLabel);
            } else {
                $errorAlert.find('.content').html(
                    'There was an error saving your label change: '+
                    data.message +'<br/>Please try again.');
                $errorAlert.removeClass('hidden');
            }
        },
        error: function(xhr, status, error){
            $errorAlert.find('.content').html(
                    'There was an error saving your label change: '+
                    status +', ' + error +'<br/>Please try again.');
            $errorAlert.removeClass('hidden');
        }
    });

    event.preventDefault();
    return false;
}

/**
 * Sets all the event listeners.
 */
$(document).ready(function(){
    $(document).on('submit', '#text-title-form', onTextTitleChange);
    $(document).on('submit', '#annotation-label-form', onAnnotationLabelChange);

});