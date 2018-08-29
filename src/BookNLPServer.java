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

package novels;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.ServerSocket;
import java.net.Socket;

import java.io.File;
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

import org.apache.commons.cli.BasicParser;
import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.CommandLineParser;
import org.apache.commons.cli.Options;

public class BookNLPServer {

    private static final String animacyFile = "files/stanford/animate.unigrams.txt";
    private static final String genderFile = "files/stanford/namegender.combine.txt";
    private static final String femaleFile = "files/stanford/female.unigrams.txt";
    private static final String maleFile = "files/stanford/male.unigrams.txt";
    private static final String corefWeights = "files/coref.weights";

    private static final long DEFAULT_PORT = 3636;

    public String weights = corefWeights;
    public long port;

    public static void main(String[] args) throws Exception {
        long port = DEFAULT_PORT;
        int clientNumber = 0;

        // Parse options.
        Options options = new Options();
        options.addOption("port", false, "the port to run on; defaults to "+
            DEFAULT_PORT);
        CommandLine cmd = null;
        try {
            CommandLineParser parser = new BasicParser();
            cmd = parser.parse(options, args);
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Display usage if requested.
        if(cmd.hasOption("h") || cmd.hasOption("help")){
            System.out.println(
                "Usage: java BookNLPServer [--port <port>] [--h|--help]");
            System.out.println(
                "Port defaults to "+ DEFAULT_PORT +" if not provided.");
            return;
        }

        // Extract port.
        if(cmd.hasOption("port")){
            port = Long.parseLong(cmd.getOptionValue("port"));
        }

        // Start server.
        System.out.println("Listening on  localhost:"+ port +".");
        ServerSocket listener = new ServerSocket(9898);
        try {
            while (true) {
                new BookProcessor(listener.accept(), clientNumber++).start();
            }
        } finally {
            listener.close();
        }


    }

    private static class BookProcessor extends Thread {
        private Socket socket;
        private int clientNumber;

        /**
         * Receives a new request.
         * 
         * @param socket The socket number.
         * @param clientNumber The id of the client making the request.
         */
        public BookProcessor(Socket socket, int clientNumber) {
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
            String directoryPath, id, name;
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

                id = params[0];
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

                // Let the client know that the request was received 
                // successfully.
                out.println("success");
                log("Successfully received parameters:\t"+ paramString);
                socket.close();

                process(directory, bookFile, name, id);
                

            } catch (IOException e) {
                log("Caught IOException: "+ e);
            } catch (Exception e) {
                log("Caught Exception: "+ e);
            } finally {
                try {
                    if(!socket.isClosed())
                        socket.close();
                } catch (IOException e) {
                    log("Couldn't close a socket, what's going on?");
                }
                log("Connection closed");
            }
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

        public void process(File directory, File bookFile, 
                String basename, String id) throws Exception {

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
                clientNumber +"\n"+ message);
        }

    }
}
