// Author:  Henry Feild
// Files:   Group.java
// Date:    19-Sep-2019

package edu.endicott.cs.entities.annotations;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;

public class Group {
    public String id, name;

    public Group(String id, JSONObject json){
        this();
        this.id = id;
        name = (String) json.get("name");
    }

    public Group(String id, String name){
        this();
        this.id = id;
        this.name = name;
    }
    public Group(){
        this.id = null;
        this.name = null;
    }

    public JSONObject toJSONObject(){
        JSONObject json = new JSONObject();
        json.put("name", name);
        return json;
    }
}