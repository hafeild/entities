// Author:  Henry Feild
// Files:   Entity.java
// Date:    19-Sep-2019

package edu.endicott.cs.entities.annotations;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;

public class Entity {
    public String id, name, groupId;

    public Entity(String id, JSONObject json){
        this();
        this.id = id;
        name = (String) json.get("name");
        groupId = (String) json.get("group_id");
    }

    public Entity(String id, String name, String groupId){
        this();
        this.id = id;
        this.name = name;
        this.groupId = groupId;
    }

    public Entity(){
        this.id = null;
        this.name = null;
        this.groupId = null;
    }

    /**
     * @return A JSON object with each Location field except the id.
     */
    public JSONObject toJSONObject(){
        JSONObject json = new JSONObject();
        json.put("name", name);
        json.put("group_id", groupId);
        return json;
    }
}