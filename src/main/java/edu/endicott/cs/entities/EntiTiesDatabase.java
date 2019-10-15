package edu.endicott.cs.entities;

import java.util.HashMap;
import java.util.Date;

import org.json.simple.parser.ParseException;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;

import edu.endicott.cs.entities.annotations.Annotation;

public class EntiTiesDatabase {
    public static enum IdStatus {SUCCESS, ID_NOT_PRESENT, ID_ALREADY_PROCESSED,
        ERROR_QUERYING_DB};

    HashMap<String, String> settings;
    private EntiTiesLogger.RequestLogger logger;
    private Connection dbh;
    private boolean isPostgres;

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
        if(settings.containsKey("java_dsn")){
            dsn = "jdbc:"+ settings.get("java_dsn");
        }
        logger.log("Using DSN "+ dsn);

        isPostgres = dsn.startsWith("jdbc:postgresql");

        try {
            if(settings.get("authentication").equals("true")){

                dbh = DriverManager.getConnection(dsn, 
                    settings.get("username"), settings.get("password"));
            } else {
                dbh = DriverManager.getConnection(dsn);
            }
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

            if(result.getBoolean("automated_method_in_progress") ==  false &&
                result.getBoolean("automated_method_error") == false)
                return IdStatus.ID_ALREADY_PROCESSED;
        } catch (SQLException e) {
            logger.log(e.toString());
            return IdStatus.ERROR_QUERYING_DB;
        }

        return IdStatus.SUCCESS;
    }

    /**
     * Checks that the annotation entry with the given id is present and
     * it's `processed` column is 0 in the annotation table of the database.
     * 
     * @param annotationId The id of the annotation to look up.
     * @return One of SUCCESS or ID_NOT_PRESENT.
     */
    public IdStatus getTextStatus(int textId) {
        try{
            PreparedStatement statement = dbh.prepareStatement(
                "select id from texts where id = ?");
            statement.setInt(1, textId);

            ResultSet result = statement.executeQuery();
            if(!result.next())
                return IdStatus.ID_NOT_PRESENT;

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
     *  - tokenization_in_progress (1 or 0)
     *  - tokenization_error (1 or 0)
     * 
     * The two flags are set to 0, meaning processing is completed and no errors
     * were encountered.
     * 
     * @param id The id of the text to mark as processed without errors.
     * @return True if the update was successful.
     * 
     * @throws SQLException
     */
    public boolean setTextTokenizationSuccessfulFlags(int id) throws SQLException {
        PreparedStatement statement = dbh.prepareStatement(
            "update texts set "+
            "tokenization_in_progress = FALSE, tokenization_error = FALSE "+
            "where id = ?");
        statement.setInt(1, id);
        return statement.executeUpdate() == 1;
    }

    /**
     * Updates the database entry for the text with the given id. Assumes
     * there's a table named `texts` with the following fields:
     * 
     *  - id
     *  - tokenization_in_progress (1 or 0)
     *  - tokenization_error (1 or 0)
     * 
     * The two flags are set to 1 and 0, meaning processing is completed, but 
     * errors were encountered.
     * 
     * @param id The id of the text to mark as processed, but in an error state.
     * @return True if the update was successful.
     * 
     * @throws SQLException
     */
    public boolean setTextTokenizationErrorFlag(int id) throws SQLException {
        PreparedStatement statement = dbh.prepareStatement(
            "update texts set "+
            "tokenization_in_progress = FALSE, tokenization_error = TRUE "+
            "where id = ?");
        statement.setInt(1, id);
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

        Timestamp curTime = new Timestamp(new Date().getTime());
        PreparedStatement statement = dbh.prepareStatement(
            "update annotations set "+
            "updated_at = ?, "+
            "automated_method_in_progress = FALSE, "+
            "automated_method_error = FALSE, "+
            "annotation = ? "+
            "where id = ?");

        // if(isPostgres)
        //     statement.setString(1, curTime.toString());
        // else 
            statement.setTimestamp(1, curTime);
        statement.setString(2, annotation);
        statement.setInt(3, annotationId);

        return statement.executeUpdate() == 1;
    }

    /**
     * Reads an annotation from the database and wraps it as an Annotation.
     * 
     * @param annotationId The id of the annotation to fetch.
     * @return The Annotation with the specified id.
     * @throws SQLException
     */
    public Annotation getAnnotation(int annotationId) throws SQLException, 
            ParseException {
        try{
            PreparedStatement statement = dbh.prepareStatement(
                "select annotation from annotations where id = ?");
            statement.setInt(1, annotationId);

            ResultSet result = statement.executeQuery();
            if(!result.next()){
                logger.log("No annotation with id "+ annotationId +" found.");
                return null;
            }

            return new Annotation(result.getString(1));

        } catch (SQLException e) {
            logger.log(e.toString());
            return null;
        }
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
