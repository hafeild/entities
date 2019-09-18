// Author:  Henry Feild
// Files:   WindowTieProcessor.java
// Date:    17-Sep-2019

package edu.endicott.cs.entities;    

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;

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
     *  - text id
     * 	- texts directory (where text records are stored)
     *  - text name
     *  - annotation id
     * 
     * This process will look for the content of the book in 
     * <texts directory>/<text id>/original.txt. It will create the following 
     * files in <texts directory>/<text id>/<annotation id>:
     * 
     *  - tokens.tsv      -- token information (TSV format)
     *  - tokens.json     -- token information (JSON format)
     *  - annotation.json -- annotation data (JSON format; also stored in the
     *                       annotations table of the database)
     *  - ids.json        -- marked up tokens (JSON format)
     *  - ids.html        -- marked up tokens (HTML)
     * 
     * TODO describe the format of these files.
     * 
     * Once the arguments are verified, but BEFORE processing begins, the
     * response "success\n" is printed to the socket and the socket is closed.
     * Processing then begins and the annotation table in the database is
     * updated with the proper `automated_method_in_progress` (set to 0 when
     * completed or an error is encountered) and `automated_method_error` (set
     * to 1 when an error is encountered) states.
     * 
     * If the arguments are not verified, or ids are not found in the database,
     * an error is printed to the socket and closed.
     * 
     * @return Whether processing completed successfully or not.
     */
    public boolean processRequest(EntiTiesSocket socket, String argsString, 
            EntiTiesLogger.RequestLogger logger, EntiTiesDatabase database){

        EntiTiesFileManager fileManager;
        String directoryPath, name, annotation;
        int textId = -1, annotationId = -1;
        File annotationDirectory, bookFile;
        this.logger = logger;
        boolean completedSuccessfully = false;


        return completedSuccessfully;
    }

    public static JSONObject extractTies(JSONOBject annotation){

    }
}