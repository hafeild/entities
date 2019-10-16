// File:    permissions.js
// Author:  Hank Feild
// Date:    16-Oct-2019
// Purpose: Handles interactions with the permissions modal on annotation and 
//          annotations views. 

var setPermissionListeners = function(){
    $(document).on('change', '#is-public', onPublicAccessChange);
    $(document).on('change', '.permission-level', onPermissionChange);
    $(document).on('click', '.remove-permission', onPermissionDelete);
    $(document).on('submit', '#new-permission', onNewPermission);

};

var onPublicAccessChange = function(e){
    console.log("Public access change requested.");
    // TODO
};

var onPermissionChange = function(e){
    console.log("Permission change requested.");
    // TODO
};

var onPermissionDelete = function(e){
    console.log("Permission removal requested.");
    // TODO
};

var onNewPermission = function(e){
    console.log("New permission requested.");
    // TODO
    e.preventDefault();
    return false;
};


$(document).ready(function(){
    setPermissionListeners();
});