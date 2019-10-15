// Author:  Henry Feild
// Files:   EntiTiesDispatcher.java
// Date:    31-July-2019

package edu.endicott.cs.entities;

import java.net.ServerSocket;
import java.net.Socket;

import java.io.FileReader;
import java.io.BufferedReader;
import java.io.PrintWriter;
import java.io.FileNotFoundException;
import java.io.IOException;

import java.util.HashMap;

import org.apache.commons.cli.BasicParser;
import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.CommandLineParser;
import org.apache.commons.cli.Options;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;

/**
 * Services requests for various EntiTies processors, such as tokenization and
 * automatic annotation of texts.
 * 
 * @author Henry Feild
 */
public class EntiTiesDispatcher extends Thread {
    private static final int DEFAULT_PORT = 3636;

    private static EntiTiesLogger logger;

    private EntiTiesSocket socket;
    private int clientNumber;
    private HashMap<String, String> dbSettings;


    /**
     * Receives a new request.
     * 
     * @param socket The socket number.
     * @param clientNumber The id of the client making the request.
     */
    public EntiTiesDispatcher(Socket rawSocket, int clientNumber,
        HashMap<String, String> dbSettings) {

        this.socket = new EntiTiesSocket(rawSocket);
        this.clientNumber = clientNumber;
        this.dbSettings = dbSettings;
        logger.log("New connection");
    }

    /**
     * Handles incoming requests. Each request should be in the format:
     * 
     *      PROCESSOR\tARGUMENTS::::PROCESSOR\tARGUMENTS...\n
     * 
     * where PROCESSOR is one of the following and ARGUMENTS are 0 or more
     * arguments to the processor in the format required by the processor.
     * 
     * Processors:
     *      - booknlp (see BookNLPProcessor for arguments)
     *      - token (see TokenProcessor for arguments)
     *      - tie-window (see WindowTieProcessor for arguments)
     * 
     * Requests are sent to the specified processor's `processRequest` method
     * to handle interacting with the client, including parsing arguments.
     * 
     * Additional PROCESSOR\tARGUMENTS pairs will be processed in the order
     * listed, but only if the previous processor completed successfully. This
     * is helpful if you would like to chain processes together. For example,
     * you could run booknlp followed by tie-window.
     */
    public void run() {
        PrintWriter out = null;
        try {
            EntiTiesLogger.RequestLogger requestLogger;
            EntiTiesDatabase database;
            socket.initialize();

            // Reads the incoming request.
            boolean lastStageSucceeded = false;
            String request = socket.readLine();

            int firstDelimiterIndex, i;
            String processorName, processorArgs;
            String requestStages[] = request.split("::::");

            logger.log("EntiTiesDispatcher: Message received:\t"+ request);

            for(i = 0; i < requestStages.length; i++){
                firstDelimiterIndex = requestStages[i].indexOf('\t');
                processorName = requestStages[i].substring(
                    0, firstDelimiterIndex);
                processorArgs = requestStages[i].substring(
                    firstDelimiterIndex+1);

                logger.log("EntiTiesDispatcher: Processing stage "+ (i+1) +" of "+ 
                    requestStages.length +"\t"+ processorName +"\t"+ processorArgs);

                requestLogger =  logger.createRequestLogger(
                    "client "+ clientNumber +"\t"+ processorName +"\t"+ 
                    "stage "+ (i+1) +" of "+ requestStages.length +"\t");
                database = new EntiTiesDatabase(dbSettings, requestLogger);

                // BookNLP processing.
                if(processorName.equals("booknlp")) {
                    lastStageSucceeded = new BookNLPProcessor().processRequest(
                        socket, processorArgs, requestLogger, database);

                // Simple tokenization.
                } else if(processorName.equals("token")) {
                    lastStageSucceeded = new TokenProcessor().processRequest(
                        socket, processorArgs, requestLogger, database);

                // Window-base tie extraction.
                } else if(processorName.equals("tie-window")) {
                    lastStageSucceeded = new WindowTieProcessor().processRequest(
                        socket, processorArgs, requestLogger, database);

                } else {
                    error(socket.out, "EntiTiesDispatcher: Error: "+
                        "Unrecognized processor '"+ processorName +
                        "'. Valid processors: booknlp, token.");
                    lastStageSucceeded = false;
                }

                if(!lastStageSucceeded)
                    break;
            }

            if(!lastStageSucceeded)
                error(socket.out, 
                    "EntiTiesDispatcher: "+ i +" of "+ requestStages.length + 
                    " stages successfully completed.");
            

        } catch (Exception e) {
            if(!socket.socket.isOutputShutdown() && socket.out != null)
                socket.println("Exception caught.");
            logger.log("Caught Exception: "+ e);
            e.printStackTrace();
            
        } finally {
            try {
                if(!socket.isClosed())
                    socket.close();

            } catch (IOException e) {
                logger.log("Couldn't close a socket. Here's a stack trace: "+e);
                e.printStackTrace();
            } 
            logger.log("Connection closed");
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
    public static HashMap<String,String> readEntiTiesConfigFile(String filename) 
    throws IOException, FileNotFoundException, Exception {

        HashMap<String, String> settings = new HashMap<String, String>();
        JSONParser parser = new JSONParser();
        JSONObject settingsJSON;
        boolean authentication;

        String settingsRaw = "";
        BufferedReader settingsReader = 
            new BufferedReader(new FileReader(filename));
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
        if(settingsJSON.containsKey("java_dsn"))
            settings.put("java_dsn", (String) settingsJSON.get("java_dsn"));
        settings.put("authentication", ""+ settingsJSON.get("authentication"));

        if(settings.get("authentication").equals("true")){
            settings.put("username", (String) settingsJSON.get("username"));
            settings.put("password", (String) settingsJSON.get("password"));
        }
        
        if(settingsJSON.containsKey("text_processing_port"))
            settings.put("text_processing_port", ""+ 
                settingsJSON.get("text_processing_port"));

        return settings;
    }

    /**
     * Sends an error to the given socket stream, logs it, then closes the
     * socket.
     * 
     * @param out The stream to write to.
     * @param error The error message to print.
     */
    public void error(PrintWriter out, String error) throws IOException {
        out.println(error);
        logger.log(error);
    }

    /**
     * Fires up the server and listens for connections.
     */
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
                "Usage: java EntiTiesDispatcher -s <json file> "+
                    "[-p <port>] [-h]");
            System.out.println(
                "Use -p to override the port specified in the settings file "+ 
                "under the\n`text_processing_port` key. If not prsent in the "+
                "setting file, then\n"+DEFAULT_PORT +" will be used.");
            return;
        }

        // Get the settings file and parse them.
        dbSettings = readEntiTiesConfigFile(cmd.getOptionValue("s"));

        // Extract port.
        if(cmd.hasOption("port")){
            port = Integer.parseInt(cmd.getOptionValue("p"));
        } else if(dbSettings.containsKey("text_processing_port")){
            port = Integer.parseInt(dbSettings.get("text_processing_port"));
        }

        if(dbSettings.containsKey("java_dsn")){
            System.out.println("dsn: jdbc:"+ dbSettings.get("java_dsn"));
        } else {
            System.out.println("dsn: jdbc:"+ dbSettings.get("dsn"));
        }
        System.out.println("authentication: "+dbSettings.get("authentication"));
        
        logger = new EntiTiesLogger();

        // Start server.
        System.out.println("Listening on  localhost:"+ port +".");
        ServerSocket listener = new ServerSocket(port);
        try {
            while (true) {
                new EntiTiesDispatcher(
                    listener.accept(), clientNumber++, dbSettings).start();
            }
        } finally {
            listener.close();
        }
    }

}