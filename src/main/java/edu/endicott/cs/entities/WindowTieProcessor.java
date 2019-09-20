// Author:  Henry Feild
// Files:   WindowTieProcessor.java
// Date:    17-Sep-2019

package edu.endicott.cs.entities;    

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;

import java.io.IOException;
import java.io.PrintWriter;

import edu.endicott.cs.entities.EntiTiesDatabase;
import edu.endicott.cs.entities.annotations.Annotation;
import edu.endicott.cs.entities.annotations.Tie;
import edu.endicott.cs.entities.annotations.TieEntity;
import edu.endicott.cs.entities.annotations.Entity;
import edu.endicott.cs.entities.annotations.Group;
import edu.endicott.cs.entities.annotations.Location;

/**
 * Extracts ties between entities by assigning a tie any time two entities are 
 * mentioned within $n$ tokens of each other.
 *
 * @author Henry Feild
 */
public class WindowTieProcessor extends Processor {

    /**
     * Handles an incoming request. A request should consist of a single line
     * with the following tab-delimited columns:
     *
     *  - annotation id (primary key the annotation table of the database)
     *  - n (size of window in tokens)
     *  - truncate existing ties (true or false)
     *
     * A tie is extracted for any pair of entities mentioned within $n$ or fewer
     * tokens of each other. These are mention-based, which means that a
     * mention of entity A may be be matched with several mentions of entity B
     * in the same window.
     * 
     * 
     * If any error is encountered, a relevant message is printed to the socket
     * and closed.
     *
     * @return Whether processing completed successfully or not.
     */
    public boolean processRequest(EntiTiesSocket socket, String argsString, 
            EntiTiesLogger.RequestLogger logger, EntiTiesDatabase database){

        EntiTiesFileManager fileManager;
        int n = 0, annotationId = -1;
        this.logger = logger;
        boolean completedSuccessfully = false, truncateExistingTies = false;
        Annotation annotation;

        try {
            // Reads the incoming arguments.
            String[] args = argsString.split("\t");

            logger.log("Message received:");
            logger.log(argsString);

            // Check that there are exactly three arguments.
            if(args.length != 3){
                error(socket.out, "Error: there should be 3 tab"+
                    "-delimited arguments (annotation id, n, "+
                    "truncate existing ties), not "+ 
                    (args.length));
                return false;
            }

            // Parse the arguments.
            annotationId = Integer.parseInt(args[0]);
            n = Integer.parseInt(args[1]);
            truncateExistingTies = args[2] == "true";

            // Check that we can open the database.
            if(!database.openConnection()){
                error(socket.out, "Error: could not establish a database "+
                            "connection.");
                return false;
            }

            // Check that there's an entry for the annotation in the database.
            switch(database.getAnnotationStatus(annotationId)){
                case ID_NOT_PRESENT:
                    error(socket.out, 
                        "Error: no annotation with this id exists in "+
                        "the database.");
                    database.close();
                    return false;
                case ERROR_QUERYING_DB:
                    error(socket.out, 
                        "Error: couldn't query the metadata table.");
                    database.close();
                    return false;
                default:
                    break;
            }

            // Get the annotation from the database.
            annotation = database.getAnnotation(annotationId);
            if(annotation == null){
                error(socket.out, "Retrieved annotation (id = "+ annotationId +
                    ") is null; cannot continue.");
                return false;
            }

            // Truncate existing ties if necessary.
            if(truncateExistingTies){
                annotation.truncateTies();
            }

            // Extract ties.
            extractTies(annotation, n);

            // Post the updated annotation.
            if(!database.postAnnotation(annotationId, annotation.toString()))
                logger.log("Error: unable to post annotation to database.");
            else
                completedSuccessfully = true;

        } catch (SQLException e) {
            logger.log("Problems connecting to the database.");
            e.printStackTrace();
        } catch (Exception e) {
            logger.log("Caught Exception: "+ e);
            e.printStackTrace();
            if(annotationId != -1)
                try{
                    if(database.setAnnotationErrorFlag(annotationId))
                        logger.log("Error writing error to database.");
                } catch(SQLException sqlE){
                    logger.log("Error writing error to database: "+ sqlE);
                }
            else
                logger.log("Error: could not mark error in database; no id.");
        } finally {
            try {
                if(!socket.isClosed())
                    socket.close();

            } catch (IOException e) {
                logger.log("Couldn't close a socket, what's going on?");
                e.printStackTrace();
                completedSuccessfully = false;
            } finally {
                try{
                    database.close();
                } catch (SQLException e) {
                    logger.log("Couldn't close database connection.");
                    completedSuccessfully = false;
                }
            }
            logger.log("Connection closed");
        }

        return completedSuccessfully;
    }

    public void extractTies(Annotation annotation, int n){
        for(Location loc1 : annotation.locations.values()){
            for(Location loc2 : annotation.locations.tailMap(loc1.id).values()){
                if(loc2.start - loc1.start <= n &&
                        annotation.entities.get(loc1.entityId).groupId != 
                        annotation.entities.get(loc2.entityId).groupId) {
                    Tie tie = new Tie();
                    tie.sourceEntity.locationId = loc1.id;
                    tie.targetEntity.locationId = loc2.id;
                    annotation.addTie(tie);        
                }
            }
        }
    }

    /**
     * Sends an error to the given output stream and logs it.
     * 
     * @param out The stream to write to.
     * @param error The error message to print.
     */
    public void error(PrintWriter out, String error) throws IOException {
        out.println(error);
        logger.log(error);
    }

}