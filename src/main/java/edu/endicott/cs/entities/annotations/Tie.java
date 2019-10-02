// Author:  Henry Feild
// Files:   Tie.java
// Date:    19-Sep-2019

package edu.endicott.cs.entities.annotations;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;


public class Tie {
    public String id, label;
    public long start, end;
    public TieEntity sourceEntity, targetEntity;
    public boolean directed;
    public double weight;

    public Tie(String id, JSONObject json){
        this();
        this.id = id;
        this.label = (String) json.get("label");
        if(json.containsKey("start") && json.containsKey("end")){
            this.start = ((Number) json.get("start")).longValue();
            this.end = ((Number) json.get("end")).longValue();
        }
        if(json.containsKey("weight"))
            this.weight= ((Number) json.get("weight")).doubleValue();
        if(json.containsKey("directed"))
            this.directed = ((Boolean) json.get("directed")).booleanValue();
        
        sourceEntity= new TieEntity((JSONObject) json.get("source_entity"));
        targetEntity= new TieEntity((JSONObject) json.get("target_entity"));
    }

    public Tie(String id, String label, long start, long end, float weight, 
                boolean directed, TieEntity sourceEntity, 
                TieEntity targetEntity){
        this();
        this.id = id;
        this.label = label;
        this.start = start;
        this.end = end;
        this.weight = weight;
        this.directed = directed;
        this.sourceEntity = sourceEntity;
        this.targetEntity = targetEntity;
    }
    public Tie(){
        this.id = null;
        this.label = null;
        this.start = -1;
        this.end = -1;
        this.weight = -1.0;
        this.directed = false;
        this.sourceEntity = new TieEntity();
        this.targetEntity = new TieEntity();
    }

    /**
     * Creates a JSON string from this tie. Note that the following fields
     * are omitted:
     *  - id (always omitted)
     *  - start, end (if either is negative)
     *  - weight (if negative)
     *  - directed (if false)
     */
    public JSONObject toJSONObject(){
        JSONObject json = new JSONObject();
        json.put("label", label);
        if(start >= 0 && end >= 0) {
            json.put("start", start);
            json.put("end", end);
        }
        if(weight >= 0)
            json.put("weight", weight);
        if(directed)
            json.put("directed", directed);
        json.put("source_entity", sourceEntity.toJSONObject());
        json.put("target_entity", targetEntity.toJSONObject());
        return json;
    }
}
