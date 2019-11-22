// File:    study-logging.js
// Author:  Hank Feild
// Date:    22-Nov-2019
// Purpose: Logs user interactions with the EntiTies during a study. This 
//          logging is only active while the user is engaged in annotation 
//          tasks that are part of a study. No personally identifiable
//          information is logged.

/**
 
 *      
 * 
 * @param {Object} syncInterval The number of milliseconds between syncing
 *                              queued events with the server. Defaults to 1000
 *                              (1 second). 
 */
var StudyLogger = function(syncInterval){
    var self = {};
    var queue = [];
    synInterval = syncInterval === undefined ? 1000 : synInterval;
    var studyURI;
    var intervalTimerId;

    /**
     * Adds a generic event to the log. This generates its own timestamp.
     * 
     * @param {Object} eventInfo The event object -- any kind of simple object.
     */
    self.log = function(domEvent, eventInfo){
        eventInfo.timestamp = (new Date()).getTime();
        queue.push(eventInfo);
        console.log('logging', eventInfo);
    };

    /**
     * Sends the queued events to the server.
     */
    function syncEvents(){
        if(queue.length === 0) return;

        console.log('Syncing logged events...');

        // Unload the queue.
        var tmpQueue = queue;
        queue = [];

        $.post({
            url: '/json'+studyURI+'/data',
            data: {data: JSON.stringify(tmpQueue)},
            success: function(data){
                console.log("Heard back: ", data);
            },
            error: function(){
                console.log("Couldn't sync log data!");
                queue = queue.concat(tmpQueue);
            }
        });
    }

    /**
     * Places listeners and initializes the periodic synchronization of log 
     * events with the server.
     */
    function init(){
        self.log(null, {name: 'pageload'});

        intervalTimerId = setInterval(syncEvents, syncInterval);
        studyURI = $('.page-info').data('study-uri');

        $(document).on('entities:annotation', (event, changes)=>
            self.log(event,{
                name: 'annotation', 
                changes: changes
        }));

        $(document).on('blur', (event, changes)=>self.log(event, {
            name: 'blur'
        }));

        $(document).on('focus', (event, changes)=>self.log(event, {
            name: 'focus'
        }));


    }

    init();

    return self;
};

var studyLogger;
$(document).ready(function(){
    studyLogger = StudyLogger();
});