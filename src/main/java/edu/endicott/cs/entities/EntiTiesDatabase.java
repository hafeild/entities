package edu.endicott.cs.entities;

import java.util.HashMap;
import java.util.Date;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;

public class EntiTiesDatabase {
    public static enum IdStatus {SUCCESS, ID_NOT_PRESENT, ID_ALREADY_PROCESSED,
        ERROR_QUERYING_DB};

    HashMap<String, String> settings;
    private EntiTiesLogger.RequestLogger logger;
    private Connection dbh;

    public EntiTiesDatabase(HashMap<String, String> settings, 
        EntiTiesLogger.RequestLogger logger){

        this.logger = logger;
        this.settings = settings;
        openConnection();
    }
    
    /**
     * Establishes a connection to the database.
     * 
     * @return Whether a connection was successfully made.
     */
    public boolean openConnection() {
        String dsn = "jdbc:"+ settings.get("dsn");
        if(settings.get("authentication").equals("true")){
            dsn += "?user="+ settings.get("username") +
                    "&password="+ settings.get("password");
        }

        try {
            dbh = DriverManager.getConnection(dsn);
            return true;
        } catch (SQLException e) {
            logger.log(e.getMessage());
            return false;
        }
    }

    /**
     * Checks that the annotation entry with the given id is present and
     * it's `processed` column is 0 in the annotation table of the database.
     * 
     * @param annotationId The id of the annotation to look up.
     * @return One of SUCCESS, ID_NOT_PRESENT, or ID_ALREADY_PROCESSED.
     */
    public IdStatus getAnnotationStatus(int annotationId) {
        try{
            PreparedStatement statement = dbh.prepareStatement(
                "select automated_method_in_progress, "+
                    "automated_method_error " +
                    "from annotations where id = ?");
            statement.setInt(1, annotationId);

            ResultSet result = statement.executeQuery();
            if(!result.next())
                return IdStatus.ID_NOT_PRESENT;

            if(result.getInt("automated_method_in_progress") ==  0 &&
                result.getInt("automated_method_error") == 0)
                return IdStatus.ID_ALREADY_PROCESSED;
        } catch (SQLException e) {
            logger.log(e.toString());
            return IdStatus.ERROR_QUERYING_DB;
        }

        return IdStatus.SUCCESS;
    }

    /**
     * Updates the database entry for the text with the given id. Assumes
     * there's a table named `texts` with the following fields:
     * 
     *  - id
     *  - processed (1 or 0)
     *  - processed_at (datetime)
     * 
     * @param id The id of the text to mark as processed.
     * @return True if the update was successful.
     * 
     * @throws SQLException
     */
    public boolean setTextTokenizedFlag(int id) throws SQLException {
        PreparedStatement statement = dbh.prepareStatement(
            "update texts set "+
            "tokenized = 1, tokenized_at = ? where id = ?");
        statement.setString(1, 
            new Timestamp(new Date().getTime()).toString()
        );
        statement.setInt(2, id);
        return statement.executeUpdate() == 1;
    }


    /**
     * Adds the annotation (in JSON format) to the annotations table of the
     * database.
     * 
     * @param textId The id of the text.
     * @param parentAnnotationId The id of the parent annotation.
     * @param creatorId The id of the user who created this annotation.
     * @param method The method used to generate this annotation (e.g., 
     *               "manual", "BookNLP", etc.).
     * @param annotation The annotation (JSON string).
     * @return True if the post was successful.
     * 
     * @throws SQLException
     */
    public boolean postAnnotation(int annotationId, String annotation) 
        throws SQLException {

        String curTime = new Timestamp(new Date().getTime()).toString();
        PreparedStatement statement = dbh.prepareStatement(
            "update annotations set "+
            "updated_at = ?, "+
            "automated_method_in_progress = 0, "+
            "automated_method_error = 0, "+
            "annotation = ? "+
            "where id = ?");
        statement.setString(1, curTime);
        statement.setString(2, annotation);
        statement.setInt(3, annotationId);

        return statement.executeUpdate() == 1;
    }

    /**
     * Updates the database entry for the text with the given id indicating
     * an error was encountered. Assumes there's a table named `annotations` with 
     * the following fields:
     * 
     *  - id
     *  - automated_method_error (1 or 0)
     * 
     * @param id The id of the annotation to mark as errored.
     * @return True if the update was successful.
     * 
     * @throws SQLException
     */
    public boolean setAnnotationErrorFlag(int id) throws SQLException {
        PreparedStatement statement = dbh.prepareStatement(
            "update annotations set automated_method_error = 1 where id = ?");
        statement.setInt(1, id);

        return statement.executeUpdate() == 1;
    }


    /**
     * Closes the database connection as long as one exists.
     * 
     * @throws SQLException
     */
    public void close() throws SQLException {
        if(dbh != null)
            dbh.close();
    }
}
