// Author:  Henry Feild
// Files:   TokenProcessor.java
// Date:    31-July-2019

package edu.endicott.cs.entities;

import java.io.File;
import java.io.FileWriter;
import java.io.BufferedWriter;
import java.io.PrintWriter;
import java.io.FileNotFoundException;
import java.io.IOException;

import java.net.Socket;

import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

import java.sql.SQLException;

import novels.Token;
import novels.util.Util;
import edu.stanford.nlp.util.CoreMap;
import edu.stanford.nlp.ling.CoreLabel;
import edu.stanford.nlp.pipeline.Annotation;
import edu.stanford.nlp.pipeline.StanfordCoreNLP;
import edu.stanford.nlp.ling.CoreAnnotations.TextAnnotation;
import edu.stanford.nlp.ling.CoreAnnotations.TokensAnnotation;
import edu.stanford.nlp.ling.CoreAnnotations.LemmaAnnotation;
import edu.stanford.nlp.ling.CoreAnnotations.NamedEntityTagAnnotation;
import edu.stanford.nlp.ling.CoreAnnotations.PartOfSpeechAnnotation;
import edu.stanford.nlp.ling.CoreAnnotations.SentencesAnnotation;

/**
 * Tokenizes a text. Uses the same tokenization as BookNLP.
 * 
 * @author Henry Feild
 */
public class TokenProcessor extends Processor {
    private static final String TOKENS_HTML_FILE_NAME = "tokens.html";
    private static final String TOKENS_JSON_FILE_NAME = "tokens.json";

    /**
     * Handles an incoming request for tokenization. A request should consist
     * of the following tab-delimited columns:
     * 
     *  - text id
     *  - texts directory (where text records are stored)
     * 
     * The texts directory location is assumed to have the structure defined in
     * EntiTiesFileManager.
     * 
     * This process will look for the content of the book in 
     * <texts directory>/<text id>/original.txt. It will create the following
     * files in <directory>/<text id>/:
     * 
     *  - tokens.json -- token information (JSON format)
     * 
     * TODO describe the format of this file.
     * 
     * This process attempts to tokenize the text file, then reports the
     * success or failure. In the event of a success, "success\n" is printed
     * to the socket and the socket is closed, and the texts table entry for the
     * text in the database is updated such that `tokenization_in_progress` and
     * `tokenization_error` are both set to 1.
     * 
     * In the event of a caught error, `tokenization_in_progress` is set to 0
     * and `tokenization_error` is set to 1. The error is printed to the socket 
     * and the socket closed.
     */
    public void processRequest(EntiTiesSocket socket, String argsString, 
        EntiTiesLogger.RequestLogger logger, EntiTiesDatabase database) {

        String text;
        EntiTiesFileManager fileManager;
        String directoryPath;
        int textId = -1;
        File bookFile, tokensHTMLFile, tokensJSONFile;
        this.logger = logger;
        ArrayList<Token> tokens;

        try {
            // Reads the incoming arguments.
            String[] args = argsString.split("\t");

            logger.log("Message received:");
            logger.log(argsString);

            // Check that there are exactly three arguments.
            if(args.length != 2){
                error(socket.out, "Error: there should be 2 tab"+
                    "-delimited arguments (text id, text directory), not "+
                    (args.length));
                return;
            }

            // Parse the arguments.
            textId = Integer.parseInt(args[0]);
            directoryPath = args[1];

            // Check that the directory and book exist.
            fileManager = new EntiTiesFileManager(
                directoryPath, textId);
            bookFile = fileManager.getTextFile("original.txt");
            tokensHTMLFile = fileManager.getTextFile(TOKENS_HTML_FILE_NAME);
            tokensJSONFile = fileManager.getTextFile(TOKENS_JSON_FILE_NAME);

            if(!fileManager.getTextDirectory().exists() || !bookFile.exists()){
                String errorMessage = "Error: Directory doesn't exist: "+ 
                    fileManager.getTextDirectory().getPath() +".";
                if(!bookFile.exists()){
                    errorMessage = "Error: File doesn't exist: "+ 
                        bookFile.getPath() +".";
                }
                error(socket.out, errorMessage);
                return;
            }

            // Check that we can open the database.
            if(!database.openConnection()){
                error(socket.out, "Error: could not establish a database "+
                            "connection.");
                return;
            }

            // Check that there's an entry for the text in the database
            // and it's not already processed.
            switch(database.getTextStatus(textId)){
                case ID_NOT_PRESENT:
                    error(socket.out, 
                        "Error: no text with this id exists in "+
                        "the database.");
                    database.close();
                    return;
                case ERROR_QUERYING_DB:
                    error(socket.out, 
                        "Error: couldn't query the metadata table.");
                    database.close();
                    return;
                default:
                    break;
            }

            logger.log("Successfully parsed and validated arguments.");

            // Read in the text's contents and tokenize it.
            text = Util.readText(bookFile.getPath());
            tokens = TokenProcessor.process(text);

            // Output the entity info.
            logger.log("Converting tokens to HTML...");
            tokensToHTML(tokens, tokensHTMLFile);
            logger.log("Converting tokens to JSON...");
            tokensToJSON(tokens, tokensJSONFile);
            if(!database.setTextTokenizationSuccessfulFlags(textId))
                logger.log("Error: unable to update tokenization status "+
                    "in the database.");


            // Let the client know that the request was received and processed
            // successfully.
            socket.println("success");
            logger.log("Completed tokenization.");
            socket.close();

        } catch (SQLException e) {
            logger.log("Problems connecting to the database.");
            e.printStackTrace();
        } catch (Exception e) {
            logger.log("Caught Exception: "+ e);
            e.printStackTrace();
            if(textId != -1)
                try{
                    if(database.setTextTokenizationErrorFlag(textId))
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
            } finally {
                try{
                    database.close();
                } catch (SQLException e) {
                    logger.log("Couldn't close database connection.");
                }
            }
            logger.log("Connection closed");
        }
    }

    /** 
     * Tokenizes a give text. Each token is labeled with a token id, sentence
     * id, paragraph id, a starting/ending byte offset, the whitespace that 
     * occurs directly after, and the original token text itself.
     * 
     * 
     * This was adapted from the BookNLP SyntaxAnnotator.process() method.
     * See: https://github.com/dbamman/book-nlp/blob/master/src/novels/annotators/SyntaxAnnotator.java
     * 
     * @param doc The text to tokenize.
     * @return A list of BookNLP tokens.
     */
    public static ArrayList<Token> process(String doc) throws Exception {

        /*
         * First see if newlines separate paragraphs or if they show up in the
         * middle of lines.
         */
        String[] sents = doc.split("\n");
        float punctCount = 0;
        float nonPuntCount = 0;
        boolean newlineParagraphs = false;
        for (String sent : sents) {
            if (sent.length() > 0) {
                String last = sent.substring(sent.length() - 1);
                if (last.equals(".") || last.equals("\"") || last.equals(":")
                        || last.equals("?") || last.equals("!")) {
                    punctCount++;
                } else {
                    nonPuntCount++;
                }
            }
        }

        if (punctCount / (punctCount + nonPuntCount) > .5) {
            newlineParagraphs = true;
        }

        ArrayList<Token> allWords = new ArrayList<Token>();

        Annotation document = new Annotation(doc);

        System.err.println("Tagging and parsing...");
        Properties props = new Properties();
                props.put("annotators", "tokenize, ssplit");
                // props.put("annotators", "tokenize, ssplit, pos, lemma, ner");

        StanfordCoreNLP pipeline = new StanfordCoreNLP(props);
        pipeline.annotate(document);

        int s = 0;
        int t = 0;
        int p = 0;

        List<CoreMap> sentences = document.get(SentencesAnnotation.class);
        int totalSentences = sentences.size() - 1;

        ArrayList<ArrayList<Token>> sentenceannos = new ArrayList<ArrayList<Token>>();

        for (int cm_indx = 0; cm_indx < sentences.size(); cm_indx++) {
            CoreMap sentence = sentences.get(cm_indx);

            if (s % 100 == 0 || s == totalSentences) {
                double ratio = ((double) s) / totalSentences;
                System.err.print(String.format(
                        "\t%.3f (%s out of %s) processed\r", ratio, s,
                        totalSentences));
            }

            ArrayList<Token> annos = new ArrayList<Token>();

            for (CoreLabel token : sentence.get(TokensAnnotation.class)) {

                String word = token.get(TextAnnotation.class);
                // String pos = token.get(PartOfSpeechAnnotation.class);
                // String lemma = token.get(LemmaAnnotation.class);
                // String ne = token.get(NamedEntityTagAnnotation.class);
                int beginOffset = token.beginPosition();
                int endOffset = token.endPosition();
                String whitespaceAfter = token.after();
                String original = token.originalText();

                Token anno = new Token();
                anno.original = original;
                anno.word = word;
                // anno.pos = pos;
                // anno.lemma = lemma;
                // anno.ner = ne;
                anno.sentenceID = s;
                anno.tokenId = t;
                anno.beginOffset = beginOffset;
                anno.endOffset = endOffset;
                anno.quotation = "O";
                anno.setWhitespaceAfter(whitespaceAfter);
                anno.p = p;
                annos.add(anno);
                allWords.add(anno);
                t++;
                whitespaceAfter = anno.whitespaceAfter;

                if (token.after().matches("\\n{2,}")
                        || (token.after().matches("\\n") && newlineParagraphs)) {
                    p++;
                }
            }

            sentenceannos.add(annos);
        }

        return allWords;
    }

    /**
     * Converts a list of tokens into an HTML file, where each token is wrapped
     * in a span with a class of the form token#, where # is the ID of the 
     * token. Whitespace is preserved rather than converted to HTML. Token text
     * is escaped to use HTML entities for <, >, and &.
     * 
     * @param tokens The list of tokens to convert to HTML.
     * @param outputFile The file to write the HTML to.
     * @throws IOException
     */
    public static void tokensToHTML(ArrayList<Token> tokens, File outputFile) 
    throws IOException {

        PrintWriter out = new PrintWriter(outputFile);
        for(Token token : tokens){
            out.print("<span class=\"token"+ token.tokenId +"\">"+
                token.original.replaceAll("&", "&amp;")
                              .replaceAll("<", "&lt;")
                              .replaceAll(">", "&gt;") +"</span>" +
                token.whitespaceAfter.replaceAll("N", "\n")
                                     .replaceAll("S", " ")
                                     .replaceAll("T", "\t"));
        }
        out.close();
    }

    /**
     * Converts a list of tokens into a JSON file. The JSON consists of a list
     * of tokens, where each token is a two-tuple, with the token text and the
     * whitespace that occurs after the token. The id of the token can be
     * inferred by the index of the token in the list.
     * 
     * @param tokens The list of tokens to convert to HTML.
     * @param outputFile The file to write the JSON to.
     * @throws IOException
     */
    public static void tokensToJSON(ArrayList<Token> tokens, File outputFile) 
    throws IOException {

        PrintWriter out = new PrintWriter(outputFile);
        out.print("[");
        for(Token token : tokens){
            out.print("[\""+
                token.original.replaceAll("\"", "\\\\\"") +"\",\""+
                token.whitespaceAfter.replaceAll("N", "\\\\n")
                                     .replaceAll("S", " ")
                                     .replaceAll("T", "\\\\t") +"\"],");
        }
        out.print("]");
        out.close();
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


    public static void main(String[] args) throws Exception {
        PrintWriter output = new PrintWriter(new BufferedWriter(new FileWriter(new File(args[1]))));
        String text = Util.readText(args[0]);
        text = Util.filterGutenberg(text);
        // output.print(text);
        ArrayList<Token> tokens = TokenProcessor.process(text);
        for(Token token : tokens){
            output.println(token);
        }
        output.close();
    }


}