/**
 * A server interface to the BookNLP package. This is a substitute for 
 * the BookNLP command line interface. The code below is largely taken from
 * BookNLP.java (see https://github.com/dbamman/book-nlp). The socket code is
 * based largely off of the examples from here: 
 * http://cs.lmu.edu/~ray/notes/javanetexamples/
 *
 * Date: 29-Aug-2018
 * @author Henry Feild
 */

package edu.endicott.cs.wei;    

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.ServerSocket;
import java.net.Socket;

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

public class BookNLPServer {

    private static final String animacyFile = "files/stanford/animate.unigrams.txt";
    private static final String genderFile = "files/stanford/namegender.combine.txt";
    private static final String femaleFile = "files/stanford/female.unigrams.txt";
    private static final String maleFile = "files/stanford/male.unigrams.txt";
    private static final String corefWeights = "files/coref.weights";

    private static final int DEFAULT_PORT = 3636;
    private static final String TEXT_METADATA_TABLE = "texts";

    private static final int TOKEN_ID_COLUMN = 2;
    private static final int ORIGINAL_WORD_COLUMN = 7;
    private static final int POS_COLUMN = 10;
    private static final int CHARACTER_ID_COLUMN = 14;
    private static final int SUPERSENSE_COLUMN = 15;

    public String weights = corefWeights;
    public long port;

    public static void main(String[] args) throws Exception {
        HashMap<String, String> dbSettings;
        int port = DEFAULT_PORT;
        int clientNumber = 0;

        // Parse options.
        Options options = new Options();
        options.addOption("p", true, "the port to run on; defaults to "+
            DEFAULT_PORT);
        options.addOption("s", true, "the settings file");

        CommandLine cmd = null;
        try {
            CommandLineParser parser = new BasicParser();
            cmd = parser.parse(options, args);
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Display usage if requested.
        if(cmd.hasOption("h") || cmd.hasOption("help") || 
                !cmd.hasOption("s")){
            
            System.out.println(
                "Usage: java BookNLPServer -s <json file> "+
                    "[-p <port>] [-h]");
            System.out.println(
                "Use -p to override the port specified in the settings file "+ 
                "under the\n`text_processing_port` key. If not prsent in the "+
                "setting file, then\n"+DEFAULT_PORT +" will be used.");
            return;
        }

        // Get the settings file and parse them.
        dbSettings = readDBConfigFile(cmd.getOptionValue("s"));

        // Extract port.
        if(cmd.hasOption("port")){
            port = Integer.parseInt(cmd.getOptionValue("p"));
        } else if(dbSettings.containsKey("text_processing_port")){
            port = Integer.parseInt(dbSettings.get("text_processing_port"));
        }

        System.out.println("dsn: "+ dbSettings.get("dsn"));
        System.out.println("authentication: "+ 
            dbSettings.get("authentication"));
        
        // Start server.
        System.out.println("Listening on  localhost:"+ port +".");
        ServerSocket listener = new ServerSocket(port);
        try {
            while (true) {
                new BookProcessor(listener.accept(), clientNumber++,
                    dbSettings).start();
            }
        } finally {
            listener.close();
        }
    }

    /**
     * Reads the database information from the given JSON configuration file.
     * Lines starting with comments (with or without leading whitespace) and
     * blank lines are removed. The JSON should contain a top-level object
     * with these keys:
     * 
     *  - dsn
     *  - authentication (boolean)
     *  - username (only read if authentication is true)
     *  - password (only read if authentication is true)
     *  - text_processing_port
     * 
     * Key-value pairs are read into a HashMap. Everything is treated as a
     * String.
     * 
     * @param filename The JSON file to read.
     * @return A HashMap of key-value pairs for the fields mentioned above.
     */
    public static HashMap<String, String> readDBConfigFile(String filename) 
    throws IOException, FileNotFoundException, Exception {

        HashMap<String, String> settings = new HashMap<String, String>();
        JSONParser parser = new JSONParser();
        JSONObject settingsJSON;
        boolean authentication;

        String settingsRaw = "";
        BufferedReader settingsReader = new BufferedReader(new FileReader(filename));
        String line = null;

        // Skip comments and blank lines.
        while((line = settingsReader.readLine()) != null){
            if(!line.matches("^\\s*//.*$") && !line.matches("^\\s*$")){
                settingsRaw += line;
            }
        }
        settingsReader.close();

        settingsJSON = 
            (JSONObject) parser.parse(settingsRaw);

        settings.put("dsn", (String) settingsJSON.get("dsn"));
        settings.put("authentication", ""+ settingsJSON.get("authentication"));

        if(settings.get("authentication").equals("true")){
            settings.put("usernmae", (String) settingsJSON.get("username"));
            settings.put("password", (String) settingsJSON.get("password"));
        }
        
        if(settingsJSON.containsKey("text_processing_port"))
            settings.put("text_processing_port", ""+ 
                settingsJSON.get("text_processing_port"));

        return settings;
    }

    /**
     * A new instance of this is created each time a book processing request
     * comes in. It handles reading in the parameters of the request, 
     * processing the specified text, and updating the database.
     */
    private static class BookProcessor extends Thread {
        private enum IdStatus {SUCCESS, ID_NOT_PRESENT, ID_ALREADY_PROCESSED,
                               ERROR_QUERYING_DB};

        private Socket socket;
        private int clientNumber;
        private Connection dbh = null;
        private HashMap<String,String> dbSettings;

        /**
         * Receives a new request.
         * 
         * @param socket The socket number.
         * @param clientNumber The id of the client making the request.
         * @param dbInfo A HashMap of DB connection information. Namely, the
         *               following keys should be available, all strings:
         * 
         *                  dsn (either sqlite:.* or mysql:.*)
         *                  authentication ("true"/"false")
         *                  username (only if authentication is "true")
         *                  password (only if authentication is "true")
         */
        public BookProcessor(Socket socket, int clientNumber, 
        HashMap<String,String> dbSettings) {
            this.dbSettings = dbSettings;
            this.socket = socket;
            this.clientNumber = clientNumber;
            log("New connection");
        }

        /**
         * Handles a new request. A request should consist of a single line
         * (ended with a new line) with the following tab-delimited columns:
         * 
         *  - book id
         * 	- directory
         *  - book name
         * 
         * Upon successful receipt, the workd "success" is returned on a line.
         * If there's a problem with the parameters, a failure message is 
         * returned.
         * 
         * This process with look for the content of the book in 
         * <directory>/<book name>.txt. It will create three new files named:
         * 
         * 	<directory>/<book name>.tokens   -- token information
         *  <directory>/<book name>.ids.json -- the book text with markup (json)
         *  <directory>/<book name>.ids.html -- the book text with markup (html)
         * 
         * When finished, updates the metadata table in the database for the
         * entry with id = <book id> such that the processed field is 1.
         */
        public void run(){
            String directoryPath, name;
            int id = -1;
            File directory, bookFile;

            try {
                // To read characters from the stream.
                BufferedReader in = new BufferedReader(
                        new InputStreamReader(socket.getInputStream()));

                // To write characters to the stream.
                PrintWriter out= new PrintWriter(socket.getOutputStream(),true);

                // Reads the incoming parameters.
                String paramString = in.readLine();
                String[] params = paramString.split("\t");

                // Check that there are exactly three parameters.
                if(params.length != 3){
                   error(out, "Error: there should be 3 tab"+
                        "-delimited parameters (book id, directory, book "+
                        "name), not "+ 	(params.length));
                    return;
                }

                id = Integer.parseInt(params[0]);
                directoryPath = params[1];
                name = params[2];

                // Check that the directory and book exist.
                directory = new File(directoryPath);
                bookFile = new File(directory, name + ".txt");
                if(!directory.exists() || !bookFile.exists()){
                    String errorMessage = "Error: Directory doesn't exist: "+ 
                        directoryPath +".";
                    if(directory.exists()){
                        errorMessage = "Error: File doesn't exist: "+ 
                            bookFile.getPath() +".";
                    }
                    error(out, errorMessage);
                    return;
                }

                // Check that we can open the database.
                if(!openConnection()){
                    error(out, "Error: could not establish a database "+
                               "connection.");
                    return;
                }

                // Check that there's an entry for the text in the database
                // and it's not already processed.
                switch(getIdStatusInMetadataTable(id)){
                    case ID_ALREADY_PROCESSED:
                        error(out, "Error: this text has already been "+
                                   "processed.");
                        dbh.close();
                        return;
                    case ID_NOT_PRESENT:
                        error(out, "Error: no entry with this id exists in "+
                                   "the database.");
                        dbh.close();
                        return;
                    case ERROR_QUERYING_DB:
                        error(out, "Error: couldn't query the metadata table.");
                        dbh.close();
                        return;
                    default:
                        break;
                }

                // Let the client know that the request was received 
                // successfully.
                out.println("success");
                log("Successfully received parameters:\t"+ paramString);
                socket.close();

                // Process the book.
                process(directory, bookFile, name);
                
                // Output the entity info.
                processTokenFile(directory, name);

                // Update the database.
                if(!markBookAsProcessedInDB(id))
                    log("Error: unable to update metadata table.");

            } catch (SQLException e) {
                log("Problems connecting to the database.");
            } catch (Exception e) {
                log("Caught Exception: "+ e);
                if(id != -1)
                    try{
                        if(markBookAsErrorInDB(id))
                            log("Error writing error to database.");
                    } catch(SQLException sqlE){
                        log("Error writing error to database: "+ sqlE);
                    }
                else
                    log("Error: could not mark error in database; no id.");
            } finally {
                try {
                    if(!socket.isClosed())
                        socket.close();

                } catch (IOException e) {
                    log("Couldn't close a socket, what's going on?");
                } finally {
                    try{
                        if(dbh != null)
                            dbh.close();
                    } catch (SQLException e) {
                        log("Couldn't close database connection.");
                    }
                }
                log("Connection closed");
            }
        }

        /**
         * Establishes a connection to the database.
         * 
         * @return Whether a connection was successfully made.
         */
        public boolean openConnection(){
            String dsn = "jdbc:"+ dbSettings.get("dsn");
            if(dbSettings.get("authentication").equals("true")){
                dsn += "?user="+ dbSettings.get("username") +
                       "&password="+ dbSettings.get("password");
            }

            try {
                dbh = DriverManager.getConnection(dsn);
                return true;
            } catch (SQLException e) {
                log(e.getMessage());
                return false;
            }
        }

        /**
         * Checks that an entry with the given id is present and it's
         * processed column is 0 in the metadata table of the database.
         * 
         * @param id The id of the text to look up.
         * @return One of SUCCESS, ID_NOT_PRESENT, or ID_ALREADY_PROCESSED.
         */
        public IdStatus getIdStatusInMetadataTable(int id){
            try{
                PreparedStatement statement = dbh.prepareStatement(
                    "select processed from "+ TEXT_METADATA_TABLE +
                    " where id = ?");

                statement.setInt(1, id);

                ResultSet result = statement.executeQuery();
                if(!result.next())
                    return IdStatus.ID_NOT_PRESENT;

                if(result.getInt("processed") != 0)
                    return IdStatus.ID_ALREADY_PROCESSED;
            } catch (SQLException e) {
                return IdStatus.ERROR_QUERYING_DB;
            }

            return IdStatus.SUCCESS;
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
         * @param directory The directory where output files will be written.
         * @param bookFile The input text file to process.
         * @param basename The name of the file (without extensions).
         */
        public void process(File directory, File bookFile,  String basename) 
        throws Exception {

            // Options options = new Options();
            // options.addOption("f", false, "force processing of text file");
            // options.addOption("printHTML", false, "print HTML file for inspection");
            // options.addOption("w", true, "coreference weight file");
            // options.addOption("doc", true, "text document to process");
            // options.addOption("tok", true, "processed text document");
            // options.addOption("docId", true, "text document ID to process");
            // options.addOption("p", true, "output directory");
            // options.addOption("id", true, "book ID");
            // options.addOption("d", false, "dump pronoun and quotes for annotation");

            // CommandLine cmd = null;
            // try {
            //     CommandLineParser parser = new BasicParser();
            //     cmd = parser.parse(options, args);
            // } catch (Exception e) {
            //     e.printStackTrace();
            // }

            // String outputDirectory = null;
            // String prefix = "book.id";
            
            // if (!cmd.hasOption("p")) {
            //     System.err.println("Specify output directory with -p <directory>");
            //     System.exit(1);
            // } else {
            //     outputDirectory = cmd.getOptionValue("p");
            // }

            // if (cmd.hasOption("id")) {
            //     prefix = cmd.getOptionValue("id");
            // }

            // File directory = new File(outputDirectory);
            // directory.mkdirs();

            // String tokenFileString = null;
            // if (cmd.hasOption("tok")) {
            //     tokenFileString = cmd.getOptionValue("tok");
            //     File tokenDirectory = new File(tokenFileString).getParentFile();
            //     tokenDirectory.mkdirs();
            // } else {
            //     System.err.println("Specify token file with -tok <filename>");
            //     System.exit(1);
            // }

            // options.addOption("printHtml", false,
            //         "write HTML file with coreference links and speaker ID for inspection");

            BookNLP bookNLP = new BookNLP();

            // Generate or read tokens
            ArrayList<Token> tokens = null;
            File tokenFile = new File(directory, basename +".token");

            if (!tokenFile.exists()) {
                String text = Util.readText(bookFile.getPath());
                text = Util.filterGutenberg(text);
                SyntaxAnnotator syntaxAnnotator = new SyntaxAnnotator();
                tokens = syntaxAnnotator.process(text);
                
                log("Processing supersenses");
                
                SupersenseAnnotator supersenseAnnotator=new SupersenseAnnotator();
                supersenseAnnotator.process(tokens);
                
            } else {
                if (tokenFile.exists()) {
                    log(String.format("%s exists...",
                        tokenFile.getPath()));
                }
                tokens = SyntaxAnnotator.readDoc(tokenFile.getPath());
                log("Using preprocessed tokens");
            }

            Book book = new Book(tokens);

            // if (cmd.hasOption("w")) {
            //     bookNLP.weights = cmd.getOptionValue("w");
            //     System.out.println(String.format("Using coref weights: ",
            //             bookNLP.weights));
            // } else {
                bookNLP.weights = BookNLPServer.corefWeights;
                log("Using default coref weights");
            // }

            book.id = basename +".ids.json";
            bookNLP.process(book, directory, book.id);

            
            File htmlOutfile = new File(directory, basename +".ids.html");
            PrintUtil.printWithLinksAndCorefAndQuotes(htmlOutfile, book);

            // if (cmd.hasOption("d")) {
            //     System.out.println("Dumping for annotation");
            //     bookNLP.dumpForAnnotation(book, directory, prefix);
            // }

            // Print out tokens
            PrintUtil.printTokens(book, tokenFile.getPath());
        }

        /**
         * Creates two JSON representations of the text and entity information 
         * encoded in a book-nlp token file (<basename>.tokens). These are saved
         * to two files:
         * 
         *  - <basename>.entities.json
         *  - <basename>.tokens.json
         * 
         * @param directory The directory where output files will be written.
         * @param basename The name of the file (without extensions).
         * 
         * @throws IOException
         */
        public void processTokenFile(File directory, String basename) throws Exception {
            HashMap<String, HashMap<String,String>> characterIdLookup = 
                new HashMap<String, HashMap<String,String>>();

            JSONObject entities = new JSONObject();
            JSONObject locations = new JSONObject();
            JSONObject interactions = new JSONObject();
            JSONObject groups = new JSONObject();
            JSONObject entityInfo = new JSONObject();
            JSONArray tokens = new JSONArray();

            String curCharacterText = null;
            String curCharacterGroupId = null;
            String curCharacterPOS = null;
            int curCharacterStartOffset = -1;
            int curCharacterEndOffset = -1;

            File tokenFile = new File(directory, basename +".token");
            BufferedReader tokenFileBuffer = 
                new BufferedReader(new FileReader(tokenFile)); 
            String line = tokenFileBuffer.readLine();

            // Skip the header.
            line = tokenFileBuffer.readLine();

            // Go through each line of the file.
            while(line != null){

                // parse the line into columns.
                String[] cols = line.split("\\t");

                int characterId = 
                    new Integer(cols[CHARACTER_ID_COLUMN]).intValue();
                char supersenseStart = cols[SUPERSENSE_COLUMN].charAt(0);

                // See if we're in a entity (col 15 > -1, col 16)
                if(characterId > -1 && supersenseStart == 'I') {
                    curCharacterText += " "+ cols[ORIGINAL_WORD_COLUMN];
                    curCharacterEndOffset = 
                        new Integer(cols[TOKEN_ID_COLUMN]).intValue();
            
                } else {
                    // Were we in one before? -- emit it.
                    if(curCharacterText != null){
                        // Add new character if POS is NNP
                        if(curCharacterPOS == "NNP"){
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
                                JSONObject newGroup = new JSONObject();
                                newGroup.put("name", curCharacterText);
                                groups.put(curCharacterGroupId, newGroup);
                            }

                            String key = characterIdLookup.
                                get(curCharacterGroupId).get(curCharacterText);

                            // if entities[curCharacterGroupId] is present:
                            if(!entities.containsKey(key)){
                                JSONObject newEntity = new JSONObject();
                                newEntity.put("name", curCharacterText);
                                newEntity.put("group_id", curCharacterGroupId);
                                entities.put(key, newEntity);
                            }
                        }

                        // Add location.
                        String locationKey = curCharacterStartOffset +"_"+
                            curCharacterEndOffset;
                        JSONObject newLocation = new JSONObject();
                        newLocation.put("start", curCharacterStartOffset);
                        newLocation.put("end", curCharacterEndOffset);
                        newLocation.put("entity_id", characterIdLookup.
                            get(curCharacterGroupId).get(curCharacterText));
                        locations.put(locationKey, newLocation);
                        
                    }

                    // See if we're entering an entity (cols 16 > -1)
                    if(characterId > -1 && supersenseStart == 'B'){
                        curCharacterText = cols[ORIGINAL_WORD_COLUMN];
                        curCharacterGroupId = cols[CHARACTER_ID_COLUMN];
                        curCharacterStartOffset = 
                            new Integer(cols[TOKEN_ID_COLUMN]).intValue();
                        curCharacterEndOffset = 
                            new Integer(cols[TOKEN_ID_COLUMN]).intValue();
                        curCharacterPOS = cols[POS_COLUMN];

                    // Otherwise, mark that we're no longer processing an
                    // entity.
                    } else {
                        curCharacterText = null;
                    }
                }

                // Add the text to tokens.
                tokens.add(cols[ORIGINAL_WORD_COLUMN]);
            }

            // Assemble the entity info object.
            entityInfo.put("entities", entities);
            entityInfo.put("groups", groups);
            entityInfo.put("locations", locations);
            entityInfo.put("interactions", interactions);

            // Write out character info.
            entityInfo.writeJSONString(
                new FileWriter(new File(directory, basename+".entities.json")));

            // Write out token info.
            tokens.writeJSONString(
                new FileWriter(new File(directory, basename+".tokens.json")));
        }

        /**
         * Updates the database entry for the book with the given id. Assumes
         * there's a table named `texts` with the following fields:
         * 
         *  - id
         *  - processed (1 or 0)
         *  - processed_at (datetime)
         * 
         * @param id The id of the text to mark as processed.
         * @return True if the update was successful.
         */
        public boolean markBookAsProcessedInDB(int id) throws SQLException {
            PreparedStatement statement = dbh.prepareStatement(
                "update texts set "+
                "processed = 1, processed_at = DATETIME('now') where id = ?");
            statement.setInt(1, id);

            return statement.executeUpdate() == 1;
        }

        /**
         * Updates the database entry for the book with the given id indicating
         * an error was encountered. Assumes there's a table named `texts` with 
         * the following fields:
         * 
         *  - id
         *  - error (1 or 0)
         * 
         * @param id The id of the text to mark as errored.
         * @return True if the update was successful.
         */
        public boolean markBookAsErrorInDB(int id) throws SQLException {
            PreparedStatement statement = dbh.prepareStatement(
                "update texts set error = 1 where id = ?");
            statement.setInt(1, id);

            return statement.executeUpdate() == 1;
        }


        /**
         * Sends an error to the given socket stream, logs it, then closes the
         * socket.
         * 
         * @param out The stream to write to.
         * @param error The error message to print.
         */
        private void error(PrintWriter out, String error) throws IOException {
            out.println(error);
            log(error);
            socket.close();
        }

        /**
         * Logs a message with timestamp. Should be reimplemented to be
         * thread safe...
         * 
         * @param message The message to log.
         */
        private void log(String message) {
            System.out.println(new Date().toString() +"\tClient "+ 
                clientNumber +"\t"+ message);
        }

    }
}
