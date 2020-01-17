// File:    messages.js
// Author:  Hank Feild
// Purpose: Handles displaying error messages.

/**
 * Extracts GET parameters from the url. Taken from: 
 * https://stackoverflow.com/a/901144
 * 
 * @param name The parameter to extract.
 * @param url The url to extract it from (optional; defaults to current
 *            window location).
 * @return The value associated with the given parameter.
 */
function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return '';
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

/**
 * Sets the error text of the non-dismissible error message. This appears at the
 * top of the page, just below the header, under any modals that may be 
 * displayed. Use `setFloatingError` if you are setting an error from a modal.
 * 
 * @param {string} error The error message to display.
 */
function setError(error){
    var errorElm = document.getElementById('errors');
    errorElm.style.display = '';
    document.getElementById('error-content').innerHTML = error;
}

/**
 * Adds a dismissible error alert that floats above all other elements.
 * 
 * @param {string} error The error message to display.
 */
function setFloatingError(error){
    var $errorElm = $('#floating-error-template').clone().attr('id', '');
    $errorElm.find('.floating-error-content').html(error);
    $('#floating-error-container').append($errorElm);
}

// When the page first loads, this displays any error messages that are present
// in the URL as GET parameters.
window.addEventListener('load', function(){

    // Process errors and messages embedded in the url.
    var error = getParameterByName('error');
    var message = getParameterByName('message');

    if(error !== ''){
        var errorElm = document.getElementById('errors');
        errorElm.style.display = '';
        this.document.getElementById('error-content').innerHTML = error;
    }

    if(message !== ''){
        var messageElm = document.getElementById('messages');
        messageElm.style.display = '';
        this.document.getElementById('message-content').innerHTML = message;
    }
});