// Author:  Henry Feild
// Files:   EntiTiesSocket.java
// Date:    07-Aug-2019

package edu.endicott.cs.entities;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.FileNotFoundException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.io.FileReader;
import java.io.IOException;

import java.net.Socket;

/**
 * A wrapper for java.net.Socket. Holds the socket as well as an input and
 * output stream. Each can be publicly accessed on an instance of this class,
 * though a few commonly used methods have been exposed for convienience and
 * readability.
 *
 * @author Henry Feild
 */
public class EntiTiesSocket {
    public PrintWriter out;
    public BufferedReader in;
    public Socket socket;

    /**
     * Sets the socket and initilizes the input and output streams to null.
     */
    public EntiTiesSocket(Socket socket) {
        this.socket = socket;
        in = null;
        out = null;
    }

    /**
     * Opens the input and output streams on this socket.
     * @throws IOException
     */
    public void initialize() throws IOException {
        // To read characters from the stream.
        in = new BufferedReader(
            new InputStreamReader(socket.getInputStream()));

        // To write characters to the stream.
        out = new PrintWriter(socket.getOutputStream(),true);
    }

    /**
     * @return The next line of text from the input stream.
     * @throws IOException
     */
    public String readLine() throws IOException {
        return in.readLine();
    }

    /**
     * Prints a message to the socket output stream followed by a newline.
     * @param message The text to print to the stream.
     */
    public void println(String message) {
        out.println(message);
    }

    /**
     * Closes the socket.
     * 
     * @throws IOException
     */
    public void close() throws IOException {
        socket.close();
    }

    /**
     * @return Whether the socket is closed or not.
     * @throws IOException
     */
    public boolean isClosed() {
        return socket.isClosed();
    }
}