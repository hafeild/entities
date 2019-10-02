// Author:  Henry Feild
// Files:   Location.java
// Date:    19-Sep-2019

package edu.endicott.cs.entities.annotations;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;

public class Location {
    public String id, entityId;
    public long start, end;

    public Location(String id, JSONObject json){
        this();
        this.id = id;
        entityId = (String) json.get("entity_id");
        start = ((Number) json.get("start")).longValue();
        end = ((Number) json.get("end")).longValue();
    }

    public Location(String id, String entityId, long start, long end){
        this();
        this.id = id;
        this.entityId = entityId;
        this.start = start;
        this.end = end;
    }
    public Location(){
        this.id = null;
        this.entityId = null;
        this.start = 0;
        this.end = 0;
    }

    /**
     * @return A JSON object with each Location field except the id.
     */
    public JSONObject toJSONObject(){
        JSONObject json = new JSONObject();
        json.put("entity_id", entityId);
        json.put("start", start);
        json.put("end", end);
        return json;
    }
}