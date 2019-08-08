// Author:  Henry Feild
// Files:   EntiTiesFileManager.java
// Date:    07-Aug-2019

package edu.endicott.cs.entities;

import java.io.File;
import java.io.IOException;


/**
 * Handles generating paths to files to the text and annotation locations on
 * disk. This centralizes the logic for how those paths are constructed.
 *
 * @author Henry Feild
 */
public class EntiTiesFileManager {
    String storageRoot;
    int textId, annotationId;
    File textDirectory, annotationDirectory;

    /**
     * Initializes this object with the given storage root path and text id,
     * and uses a default value for the annotation id of -1. If you expect to
     * use the getAnnotation* methods, use the other constructor.
     * 
     * @param storageRoot The path to the root storage dirctory.
     * @param textId The id of the text.
     */
    public EntiTiesFileManager(String storageRoot, int textId){
        this(storageRoot, textId, -1);
    }

    /**
     * Initializes the storage root path and ids for later use. This enforces
     * the following directory structure:
     * 
     *  <storageRoot>/
     *  `---- <textId>/
     *        `---- <annotationId>/
     * 
     * @param storageRoot The path to the root storage dirctory.
     * @param textId The id of the text.
     * @param annotationId The id of the annotation.
     */
    public EntiTiesFileManager(String storageRoot, int textId,int annotationId){
        this.storageRoot = storageRoot;
        this.textId = textId;
        this.annotationId = annotationId;
        textDirectory = null;
        annotationDirectory = null;
    }

    /**
     * @return A File instance for the text directory.
     */    
    public File getTextDirectory() {
        if(textDirectory == null)
            textDirectory = new File(storageRoot, ""+textId);
        return textDirectory;
    }

    /**
     * @return A File instance for the annotation directory.
     */
    public File getAnnotationDirectory() {
        if(annotationDirectory == null)
            annotationDirectory = new File(textDirectory, ""+annotationId);
        return annotationDirectory;
    }

    /**
     * @param filename The name of a file relative to the text directory.
     * @return A File instance for the given filename in the annotation directory.
     */
    public File getTextFile(String filename) {
        return new File(getTextDirectory(), filename);
    }

    /**
     * @param filename The name of a file relative to the annotation directory.
     * @return A File instance for the given filename in the annotation directory.
     */
    public File getAnnotationFile(String filename) {
        return new File(getAnnotationDirectory(), filename);
    }
}