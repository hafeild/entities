// File:    permissions.js
// Author:  Hank Feild
// Date:    16-Oct-2019
// Purpose: Handles interactions with the permissions modal on annotation and 
//          annotations views. 

/**
 * Sets listeners on the permissions modal.
 */
var setPermissionListeners = function(){
    $(document).on('change', '#is-public', onPublicAccessChange);
    $(document).on('change', '.permission-level', onPermissionChange);
    $(document).on('click', '.remove-permission', onPermissionDelete);
    $(document).on('submit', '#new-permission', onNewPermission);
};

/**
 * Updates the current text or annotation's to be public (or not). A server 
 * side error will result in an error message being displayed.
 * 
 * @param {Event} e The change event that triggered this listener.
 */
var onPublicAccessChange = function(e){
    var $formGroup = $(this).parents('.is-public-form-group');
    var $page = $('.page');
    var isPublic;

    // Get the new public status.
    isPublic = $(this).prop('checked');

    // Contact the server.
    $.ajax(`/json${$page.data('uri')}`, {
        method: 'post',
        data: {is_public: isPublic, _method: 'PATCH'},
        success: function(data, textStatus, jqXHR){
            // On success: display "success" icon.
            if(data.success){
                console.log($formGroup);
                console.log($formGroup.find('.saved-icon'));
                flashElement($formGroup.find('.saved-icon'));

            } else {
                // On failure: display an error message.
                setError(`Error: ${data.message} `+ 
                    `${JSON.stringify(data.additional_data)}.`);
            }
        },
        // On failure: display an error message.
        error: function(jqXHR, textStatus, errorThrown){
            setError(`Error: ${textStatus} ${errorThrown}.`);
        }
    });
};

/**
 * Updates changes to a user's permissions on the server. A server side error
 * will result in an error message being displayed.
 * 
 * @param {Event} e The change event that triggered this listener.
 */
var onPermissionChange = function(e){
    console.log("Permission change requested.");
    // TODO

    // Get id of permission and new permission.
    // Contact the server.
    // On success: display "success" icon.
    // On failure: display an error message.
};

/**
 * Deletes the permission associated with the clicked deletion button.
 * 
 * @param {Event} e The click event that triggered this handler.
 */
var onPermissionDelete = function(e){
    console.log("Permission removal requested.");
    // TODO

    // Get id of permission.
    // Contact the server.
    // On success: remove the permission control from the permissions modal.
    // On failure: display an error message.
};

/**
 * Submits the new permission to the server and adds a permission control to
 * the permissions modal if successful. If not, an error message is displayed.
 * 
 * @param {Event} e The form submission event that triggered this handler.
 */
var onNewPermission = function(e){
    console.log("New permission requested.");
    // TODO

    var $formGroup = $(this).parents('.new-permission-form');
    var $page = $('.page');
    var username, permissionLevel;

    // Collect username and permission.
    username = $('#new-permission-username').val();
    permissionLevel = $('#new-permission-level').val();

    // Contact the server.
    $.ajax(`/json${$page.data('uri')}/permissions`, {
        method: 'post',
        data: {username: username, permission_level: permissionLevel},
        success: function(data, textStatus, jqXHR){
             // On successfully hearing back, add permission controls.
            if(data.success){
                var $newPermissionControl = $('#permission-template').clone();
                $newPermissionControl.attr('id', '');
                $newPermissionControl.appendTo('.existing-permissions');
                $newPermissionControl.find('.permission-username').text(username);
                $newPermissionControl.find('.permission-level').val(permissionLevel);
                $newPermissionControl.attr('data-permission-id', 
                    data.additional_data.permission_id);
            } else {
                // On failure: display an error message.
                setError(`Error: ${data.message} `+ 
                    `${JSON.stringify(data.additional_data)}.`);
            }
        },
        // On failure: display an error message.
        error: function(jqXHR, textStatus, errorThrown){
            setError(`Error: ${textStatus} ${errorThrown}.`);
        }
    });

    e.preventDefault();
    return false;
};

/**
 * Displays the given element, then fades it out over 2 seconds.
 * 
 * @param {JQuery element} $elm The element to flash.
 */
var flashElement = function($elm){
    $elm.removeClass('hidden')
    $elm.show();
    $elm.fadeOut(2000);
}

////////////////////////////////////////////////////////////////////////////////
// MAIN
////////////////////////////////////////////////////////////////////////////////

// Initializes permission listeners.
$(document).ready(function(){
    setPermissionListeners();
});