// Author:  Henry Feild
// Files:   BookNLPProcessor.java
// Date:    29-Aug-2019

package edu.endicott.cs.entities;    

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileWriter;
import java.io.FileReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Date;

import novels.annotators.CharacterAnnotator;
import novels.annotators.CharacterFeatureAnnotator;
import novels.annotators.CoreferenceAnnotator;
import novels.annotators.PhraseAnnotator;
import novels.annotators.QuotationAnnotator;
import novels.annotators.SupersenseAnnotator;
import novels.annotators.SyntaxAnnotator;
import novels.util.PrintUtil;
import novels.util.Util;
import novels.*;

import org.apache.commons.cli.BasicParser;
import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.CommandLineParser;
import org.apache.commons.cli.Options;
import org.apache.commons.cli.Option;
import org.apache.commons.cli.HelpFormatter;


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

import edu.endicott.cs.entities.annotations.Annotation;
import edu.endicott.cs.entities.annotations.Tie;
import edu.endicott.cs.entities.annotations.TieEntity;
import edu.endicott.cs.entities.annotations.Entity;
import edu.endicott.cs.entities.annotations.Group;
import edu.endicott.cs.entities.annotations.Location;

/**
 * A server interface to the BookNLP package. This is a substitute for 
 * the BookNLP command line interface. The code below is largely taken from
 * BookNLP.java (see https://github.com/dbamman/book-nlp). The socket code is
 * based largely off of the examples from here: 
 * http://cs.lmu.edu/~ray/notes/javanetexamples/
 *
 * @author Henry Feild
 */
public class BookNLPProcessor extends Processor {

    private static final String animacyFile = "files/stanford/animate.unigrams.txt";
    private static final String genderFile = "files/stanford/namegender.combine.txt";
    private static final String femaleFile = "files/stanford/female.unigrams.txt";
    private static final String maleFile = "files/stanford/male.unigrams.txt";
    private static final String corefWeights = "files/coref.weights";


    private static final int TOKEN_ID_COLUMN = 2;
    private static final int ORIGINAL_WORD_COLUMN = 7;
    private static final int POS_COLUMN = 10;
    private static final int CHARACTER_ID_COLUMN = 14;
    private static final int SUPERSENSE_COLUMN = 15;

    private static final String TOKENS_TSV_FILE_NAME = "tokens.tsv";
    private static final String TOKENS_JSON_FILE_NAME = "tokens.json";
    private static final String ANNOTATION_JSON_FILE_NAME = "annotation.json";
    private static final String IDS_HTML_FILE_NAME = "ids.html";
    private static final String IDS_JSON_FILE_NAME = "ids.json";

    private static final HashSet<String> NOUN_TYPES = new HashSet<String>();
    static {
        NOUN_TYPES.add("NNP");
        NOUN_TYPES.add("NNPS");
        NOUN_TYPES.add("NN");
    }

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

        try {
            // Reads the incoming arguments.
            String[] args = argsString.split("\t");

            logger.log("Message received:");
            logger.log(argsString);

            // Check that there are exactly three arguments.
            if(args.length != 4){
                error(socket.out, "Error: there should be 5 tab"+
                    "-delimited arguments (text id, directory, book "+
                    "name, annotation id), not "+ 
                    (args.length));
                return false;
            }

            // Parse the arguments.
            textId = Integer.parseInt(args[0]);
            directoryPath = args[1];
            name = args[2];
            annotationId = Integer.parseInt(args[3]);

            // Check that the directory and book exist.
            fileManager = new EntiTiesFileManager(
                directoryPath, textId, annotationId);
            bookFile = fileManager.getTextFile("original.txt");
            annotationDirectory = fileManager.getAnnotationDirectory();

            if(!fileManager.getTextDirectory().exists() || !bookFile.exists()){
                String errorMessage = "Error: Directory doesn't exist: "+ 
                    fileManager.getTextDirectory().getPath() +".";
                if(!bookFile.exists()){
                    errorMessage = "Error: File doesn't exist: "+ 
                        bookFile.getPath() +".";
                }
                error(socket.out, errorMessage);
                return false;
            }

            // Make the annotation directory if it doesn't already exist.
            if(!annotationDirectory.exists())
                annotationDirectory.mkdir();

            // Check that we can open the database.
            if(!database.openConnection()){
                error(socket.out, "Error: could not establish a database "+
                            "connection.");
                return false;
            }

            // Check that there's an entry for the annotation in the database
            // and it's not already processed.
            switch(database.getAnnotationStatus(annotationId)){
                case ID_ALREADY_PROCESSED:
                    error(socket.out, 
                        "Error: this annotation has already been processed.");
                    database.close();
                    return false;
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

            // Let the client know that the request was received 
            // successfully.
            socket.println("success");
            logger.log("Successfully parsed parameters.");
            socket.close();

            // Process the book.
            process(annotationDirectory, bookFile);
            
            // Output the entity info.
            logger.log("Processing token file to generate json files.");
            annotation = processTokensFile(annotationDirectory);
            if(!database.postAnnotation(annotationId, annotation))
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


    // /**
    //  * Annotate a book with characters, coreference and quotations
    //  * 
    //  * @param book
    //  */
    // public void process(Book book, File outputDirectory, String outputPrefix) {
    //     File charFile = new File(outputDirectory, outputPrefix + ".book");

    //     process(book);

    //     QuotationAnnotator quoteFinder = new QuotationAnnotator();
    //     quoteFinder.findQuotations(book);

    //     CharacterFeatureAnnotator featureAnno = new CharacterFeatureAnnotator();
    //     featureAnno.annotatePaths(book);
    //     PrintUtil.printBookJson(book, charFile);

    // }

    // public void process(Book book) {
    //     SyntaxAnnotator.setDependents(book);

    //     Dictionaries dicts = new Dictionaries();
    //     dicts.readAnimate(animacyFile, genderFile, maleFile, femaleFile);
    //     dicts.processHonorifics(book.tokens);

    //     CharacterAnnotator charFinder = new CharacterAnnotator();

    //     charFinder.findCharacters(book, dicts);
    //     charFinder.resolveCharacters(book, dicts);

    //     PhraseAnnotator phraseFinder = new PhraseAnnotator();
    //     phraseFinder.getPhrases(book, dicts);

    //     CoreferenceAnnotator coref = new CoreferenceAnnotator();
    //     coref.readWeights(weights);
    //     coref.resolvePronouns(book);
    //     charFinder.resolveRemainingGender(book);

    // }

    // public void dumpForAnnotation(Book book, File outputDirectory, String prefix) {
    //     File pronounCands = new File(outputDirectory, prefix + ".pronoun.cands");
    //     File quotes = new File(outputDirectory, prefix + ".quote.cands");

    //     CoreferenceAnnotator coref = new CoreferenceAnnotator();
    //     HashMap<Integer, HashSet<Integer>> cands = coref.getResolvable(book);
    //     PrintUtil.printPronounCandidates(pronounCands, book, cands);
    //     PrintUtil.printQuotes(quotes, book);

    // }

    /**
     * Processes the given text and generates several files. See the
     * run method for details.
     * 
     * @param outputDirectory The directory where output files will be written.
     * @param bookFile The input text file to process.
     */
    public void process(File outputDirectory, File bookFile) 
    throws Exception {

        BookNLP bookNLP = new BookNLP();

        // Generate or read tokens
        ArrayList<Token> tokens = null;
        File tokensFile = new File(outputDirectory, TOKENS_TSV_FILE_NAME);

        if (!tokensFile.exists()) {
            String text = Util.readText(bookFile.getPath());
            //text = Util.filterGutenberg(text);
            SyntaxAnnotator syntaxAnnotator = new SyntaxAnnotator();
            tokens = syntaxAnnotator.process(text);
            
            logger.log("Processing supersenses");
            
            SupersenseAnnotator supersenseAnnotator=new SupersenseAnnotator();
            supersenseAnnotator.process(tokens);
            
        } else {
            if (tokensFile.exists()) {
                logger.log(String.format("%s exists...",
                    tokensFile.getPath()));
            }
            tokens = SyntaxAnnotator.readDoc(tokensFile.getPath());
            logger.log("Using preprocessed tokens");
        }

        Book book = new Book(tokens);
        bookNLP.weights = BookNLPProcessor.corefWeights;
        logger.log("Using default coref weights");

        book.id = IDS_JSON_FILE_NAME;
        bookNLP.process(book, outputDirectory, book.id);

        
        File htmlOutfile = new File(outputDirectory, IDS_HTML_FILE_NAME);
        PrintUtil.printWithLinksAndCorefAndQuotes(htmlOutfile, book);

        // Print out tokens
        PrintUtil.printTokens(book, tokensFile.getPath());
    }

    /**
     * Creates two JSON representations of the text and entity information 
     * encoded in a book-nlp token file (<basename>.tokens). These are saved
     * to two files:
     * 
     *  - annotation.json
     *  - tokens.json
     * 
     * @param outputDirectory The directory where output files will be written.
     * @return The annotation as a JSON string.
     * @throws IOException
     */
    public String processTokensFile(File outputDirectory) throws Exception {
        HashMap<String, HashMap<String,String>> characterIdLookup = 
            new HashMap<String, HashMap<String,String>>();

        JSONArray tokens = new JSONArray();

        Annotation annotation = new Annotation();
        String jsonAnnotation;


        String curCharacterText = null;
        String curCharacterGroupId = null;
        String curCharacterPOS = null;
        int curCharacterStartOffset = -1;
        int curCharacterEndOffset = -1;

        int prevCharacterId = -1; 

        File tokensFile = new File(outputDirectory, TOKENS_TSV_FILE_NAME);
        BufferedReader tokensFileBuffer = 
            new BufferedReader(new FileReader(tokensFile)); 
        String line = tokensFileBuffer.readLine();

        // Skip the header.
        line = tokensFileBuffer.readLine();

        // Go through each line of the file.
        while(line != null){
            // log(line);
            // log("curCharacterText: "+ curCharacterText +"; "+
            //     "curCharacterGroupId: "+ curCharacterGroupId +"; "+
            //     "curCharacterPOS: "+ curCharacterPOS +"; "+
            //     "curCharacterStartOffset: "+ curCharacterStartOffset +"; "+
            //     "curCharacterEndOffset: "+ curCharacterEndOffset
            //     );
            // parse the line into columns.
            String[] cols = line.split("\\t");

            int characterId = 
                Integer.parseInt(cols[CHARACTER_ID_COLUMN]);
            char supersenseStart = cols[SUPERSENSE_COLUMN].charAt(0);

            // See if we're in a entity (col 15 > -1, col 16)
            // if(characterId > -1 && supersenseStart == 'I' && curCharacterText != null) {
            if(characterId > -1 && characterId == prevCharacterId) {
                // log("Found continuation of character.");
                curCharacterText += " "+ cols[ORIGINAL_WORD_COLUMN];
                curCharacterEndOffset = 
                    Integer.parseInt(cols[TOKEN_ID_COLUMN]);
        
            } else {
                // Were we in one before? -- emit it.
                if(curCharacterText != null){
                    // log("Ended character location (NNP or Pronoun), processing...");
                    String entityId = curCharacterGroupId;

                    // Add new character if POS is NNP
                    if(NOUN_TYPES.contains(curCharacterPOS)){
                        // log("Found character (curCharacterPos == NNP)");

                        // Get entity id.
                        if(characterIdLookup.containsKey(curCharacterGroupId)){
                            HashMap<String,String> tmp = 
                                characterIdLookup.get(curCharacterGroupId);

                            if(!tmp.containsKey(curCharacterText)){
                                tmp.put(curCharacterText, 
                                    curCharacterGroupId +"-"+ tmp.size());
                            }
                        } else {
                            characterIdLookup.put(curCharacterGroupId,
                                new HashMap<String, String>());
                            characterIdLookup.get(curCharacterGroupId).
                                put(curCharacterText, curCharacterGroupId);

                            // Make a new group entry.
                            annotation.addGroup(new Group(
                                curCharacterGroupId, curCharacterText));

                        }

                        entityId = characterIdLookup.
                            get(curCharacterGroupId).get(curCharacterText);

                        // if entities[curCharacterGroupId] is present:
                        if(!annotation.entityExists(entityId))
                            annotation.addEntity(new Entity(
                                entityId, curCharacterText, curCharacterGroupId
                            ));
                        
                    }

                    // Add location.
                    String locationKey = curCharacterStartOffset +"_"+
                        curCharacterEndOffset;
                    annotation.addLocation(new Location(locationKey, 
                        entityId, curCharacterStartOffset, 
                        curCharacterEndOffset));
                }

                // See if we're entering an entity (cols 16 > -1)
                // if(characterId > -1 && (supersenseStart == 'B' || supersenseStart == 'I') ){
                if(characterId > -1 && characterId != prevCharacterId ){
                    // log("Found beginning of new character...");
                    curCharacterText = cols[ORIGINAL_WORD_COLUMN];
                    curCharacterGroupId = cols[CHARACTER_ID_COLUMN];
                    curCharacterStartOffset = 
                        Integer.parseInt(cols[TOKEN_ID_COLUMN]);
                    curCharacterEndOffset = 
                        Integer.parseInt(cols[TOKEN_ID_COLUMN]);
                    curCharacterPOS = cols[POS_COLUMN];

                // Otherwise, mark that we're no longer processing an
                // entity.
                } else {
                    curCharacterText = null;
                }
            }

            // Add the text to tokens.
            tokens.add(cols[ORIGINAL_WORD_COLUMN]);

            // Next line.
            line = tokensFileBuffer.readLine();

            prevCharacterId = characterId;
        }
        tokensFileBuffer.close();

        // Write out character info.
        jsonAnnotation = annotation.toString();
        PrintWriter entityJSONFile = new PrintWriter(
            new File(outputDirectory, ANNOTATION_JSON_FILE_NAME));
        entityJSONFile.print(jsonAnnotation);
        entityJSONFile.close();

        // FileWriter entityJSONFile = new FileWriter(
        //     new File(outputDirectory, ANNOTATION_JSON_FILE_NAME));
        // entityJSONFile.
        // entityInfo.writeJSONString(entityJSONFile);
        // entityJSONFile.close();

        // Write out token info.
        FileWriter tokensJSONFile = new FileWriter(
            new File(outputDirectory, TOKENS_JSON_FILE_NAME));
        tokens.writeJSONString(tokensJSONFile);
        tokensJSONFile.close();

        return jsonAnnotation;
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
