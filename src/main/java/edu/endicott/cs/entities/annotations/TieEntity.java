// Author:  Henry Feild
// Files:   TieEntity.java
// Date:    19-Sep-2019

package edu.endicott.cs.entities.annotations;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;

public class TieEntity {
    public String locationId, entityId;
    public TieEntity(JSONObject json){
        this();
        if(json.containsKey("location_id"))
            locationId = (String) json.get("location_id");
        else if(json.containsKey("entity_id"))
            entityId = (String) json.get("entity_id");
    }
    public TieEntity(String locationId, String entityId){
        this.locationId = locationId;
        this.entityId = entityId;
    }
    public TieEntity(){
        this.locationId = null;
        this.entityId = null;
    }

    /**
     * Creates a JSON object with the location id (if set), OR entity id 
     * (if set), OR nothing if neither are set.
     */
    public JSONObject toJSONObject(){
        JSONObject json = new JSONObject();
        if(locationId != null){
            json.put("location_id", locationId);
        } else if(entityId != null){
            json.put("entity_id", entityId);
        } 
        return json;
    }
}