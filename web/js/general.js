/**
 * Includes listeners for non-annotation related elements (e.g., renaming a
 * text its texts/:id/annotations page).
 */


/**
 * Listens for a text to be renamed; updates the name on the server and in the
 * UI.
 */
function onTextTitleChange(event){
    var newTitle = $('#new-text-title').val();

    console.log('Changing name to: ', newTitle);

    // Send new name to server.
        // on success: update name everywhere in the UI
        $('.text-title').html(newTitle);
}

$(document).ready(function(){
    $(document).on('click', '#save-new-text-title', onTextTitleChange);

});