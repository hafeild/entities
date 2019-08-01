package edu.endicott.cs.entities;    

import java.net.Socket;


public abstract class Processor {

    EntiTiesDatabase database;
    EntiTiesLogger.RequestLogger logger;

    // public Processor(EntiTiesDatabase database) {
    //     this.database = database;
    // }

    public abstract void processRequest(Socket socket, String args, 
        EntiTiesLogger.RequestLogger logger, EntiTiesDatabase database);
}