package edu.endicott.cs.wei;

import java.io.File;
import java.io.FileWriter;
import java.io.BufferedWriter;
import java.io.PrintWriter;


import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

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


public class TokenizerServer {

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

    public static void main(String[] args) throws Exception {
        PrintWriter output = new PrintWriter(new BufferedWriter(new FileWriter(new File(args[1]))));
        String text = Util.readText(args[0]);
        text = Util.filterGutenberg(text);
        // output.print(text);
        ArrayList<Token> tokens = TokenizerServer.process(text);
        for(Token token : tokens){
            output.println(token);
        }
        output.close();
    }


}