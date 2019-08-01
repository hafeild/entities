package edu.endicott.cs.entities;


import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.FileNotFoundException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.io.FileReader;

import java.net.ServerSocket;
import java.net.Socket;

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
 * Services requests for various EntiTies services, such as tokenization and
 * automatic annotation of texts.
 */
public class EntiTiesDispatcher extends Thread {
    private static final int DEFAULT_PORT = 3636;

    private static EntiTiesLogger logger;

    private Socket socket;
    private int clientNumber;
    private HashMap<String, String> dbSettings;


    /**
     * Receives a new request.
     * 
     * @param socket The socket number.
     * @param clientNumber The id of the client making the request.
     */
    public EntiTiesDispatcher(Socket socket, int clientNumber,
        HashMap<String, String> dbSettings) {

        this.socket = socket;
        this.clientNumber = clientNumber;
        this.dbSettings = dbSettings;
        logger.log("New connection");
    }

    /**
     * Handles incoming requests. Each request should be in the format:
     * 
     *      PROCESSOR\tARGUMENTS
     * 
     * where PROCESSOR is one of the following and ARGUMENTS are 0 or more
     * arguments to the processor in the format required by the processor.
     * 
     * Processors:
     *      - booknlp (see BookNLPProcessor for arguments)
     *      - token (see TokenProcessor for arguments)
     * 
     * Requests are sent to the specified processor's `processRequest` method
     * to handle interacting with the client, including parsing arguments.
     */
    public void run() {
        try {
            EntiTiesLogger.RequestLogger requestLogger;
            EntiTiesDatabase database;

            // To read characters from the stream.
            BufferedReader in = new BufferedReader(
                    new InputStreamReader(socket.getInputStream()));

            // To write characters to the stream.
            PrintWriter out= new PrintWriter(socket.getOutputStream(),true);

            // Reads the incoming request.
            String request = in.readLine();
            int firstDelimiterIndex = request.indexOf('\t');
            String processorName = request.substring(0, firstDelimiterIndex);
            String processorArgs = request.substring(firstDelimiterIndex+1);
            logger.log("EntiTiesDispatcher: Message received:\t"+ request);

            requestLogger =  logger.createRequestLogger(
                "client "+ clientNumber +"\t"+ processorName +"\t");
            database = new EntiTiesDatabase(dbSettings, requestLogger);

            // BookNLP processing.
            if(processorName.equals("booknlp")) {
                new BookNLPProcessor().processRequest(
                    socket, processorArgs, requestLogger, database);

            // Simple tokenization.
            } else if(processorName.equals("token")) {
                new TokenProcessor().processRequest(
                    socket, processorArgs, requestLogger, database);

            } else {
                error(out, "Error: Unrecognized processor '"+ processorName +
                    "'. Valid processors: booknlp, token.");
                return;
            }

        } catch (Exception e) {
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

        System.out.println("dsn: "+ dbSettings.get("dsn"));
        System.out.println("authentication: "+ 
            dbSettings.get("authentication"));
        
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