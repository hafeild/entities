package edu.endicott.cs.entities;

import java.util.Date;

public class EntiTiesLogger {

    public class RequestLogger {
        String prefix;

        public RequestLogger(String prefix){
            this.prefix = prefix;
        }

        public void log(String message){
            EntiTiesLogger.this.log(prefix + message);
        }
    }

    public RequestLogger createRequestLogger(String prefix){
        return new RequestLogger(prefix);
    }

    /**
     * Logs a message with timestamp. Should be reimplemented to be
     * thread safe...
     * 
     * @param message The message to log.
     */
    public void log(String message) {
        System.out.println(new Date().toString() +"\t"+ message);
    }

}

