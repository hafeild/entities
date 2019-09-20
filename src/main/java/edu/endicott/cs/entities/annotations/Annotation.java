// Author:  Henry Feild
// Files:   Annotation.java
// Date:    19-Sep-2019

package edu.endicott.cs.entities.annotations;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;

import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.Iterator;


/**
 * Provides an interface for an EntiTies annotation, which is stored in a 
 * sparse JSON format.
 *
 * @author Henry Feild
 */
public class Annotation {
    public HashMap<String, Entity> entities;
    public TreeMap<String, Location> locations;
    public HashMap<String, Tie> ties;
    public HashMap<String, Group> groups;
    long lastEntityId, lastTieId, lastGroupId;
    boolean computeLastIdsFromData = false;

    public Annotation(String annotation) throws ParseException{
        this();
        load(annotation);
    }

    public Annotation(){
        entities = new HashMap<String, Entity>();
        groups = new HashMap<String, Group>();
        locations = new TreeMap<String, Location>(new LocationKeyComparator());
        ties = new HashMap<String, Tie>();
        lastEntityId = 0;
        lastGroupId = 0;
        lastTieId = 0;
    }

    // CRUD operations.
    public void addEntity(Entity entity){
        if(entity.id == null)
            entity.id = Long.toString(++lastEntityId);
        else
            lastEntityId = Math.max(lastEntityId, Long.parseLong(entity.id));
        entities.put(entity.id, entity);
    }

    public void addLocation(Location location){
        locations.put(location.id, location);
    }

    public void addGroup(Group group){
        if(group.id == null)
            group.id = Long.toString(++lastGroupId);
        else
            lastGroupId = Math.max(lastGroupId, Long.parseLong(group.id));
        groups.put(group.id, group);
        
    }

    public void addTie(Tie tie){
        if(tie.id == null)
            tie.id = Long.toString(++lastTieId);
        else
            lastTieId = Math.max(lastTieId, Long.parseLong(tie.id));
        ties.put(tie.id, tie);
    }


    public boolean entityExists(String id){
        return entities.containsKey(id);
    }

    public void truncateTies(){
        ties.clear();
        lastTieId = 0;
    }

    // Extracting from JSON.

    public void load(String annotation) throws ParseException{
        JSONParser parser = new JSONParser();
        JSONObject json = (JSONObject) parser.parse(annotation);

        computeLastIdsFromData = (!json.containsKey("last_entity_id") || 
           !json.containsKey("last_group_id") ||
           !json.containsKey("last_location_id"));
        
        jsonToEntities((JSONObject) json.get("entities"));
        jsonToGroups((JSONObject) json.get("groups"));
        jsonToLocations((JSONObject) json.get("locations"));
        jsonToTies((JSONObject) json.get("ties"));
    }

    public void jsonToEntities(JSONObject json){
        Iterator<String> keys = json.keySet().iterator();
        String id;
        while(keys.hasNext()){
            id = keys.next();
            entities.put(id, new Entity(id, (JSONObject) json.get(id)));
            if(computeLastIdsFromData)
                lastEntityId = Math.max(lastEntityId, Long.parseLong(id));
        }
    }

    public void jsonToGroups(JSONObject json){
        Iterator<String> keys = json.keySet().iterator();
        String id;
        while(keys.hasNext()){
            id = keys.next();
            groups.put(id, new Group(id, (JSONObject) json.get(id)));
            if(computeLastIdsFromData)
                lastGroupId = Math.max(lastGroupId, Long.parseLong(id));
        }
    }

    public void jsonToLocations(JSONObject json){
        Iterator<String> keys = json.keySet().iterator();
        String id;
        while(keys.hasNext()){
            id = keys.next();
            locations.put(id, new Location(id, (JSONObject) json.get(id)));
        }
    }
    public void jsonToTies(JSONObject json){
        Iterator<String> keys = json.keySet().iterator();
        String id;
        while(keys.hasNext()){
            id = keys.next();
            ties.put(id, new Tie(id, (JSONObject) json.get(id)));
            if(computeLastIdsFromData)
                lastTieId = Math.max(lastTieId, Long.parseLong(id));
        }
    }

    // Converting to JSON.

    public JSONObject entitiesToJSON(){
        JSONObject json = new JSONObject();
        for(String id : entities.keySet())
            json.put(id, entities.get(id));
        return json;
    }

    public JSONObject groupsToJSON(){
        JSONObject json = new JSONObject();
        for(String id : groups.keySet())
            json.put(id, groups.get(id));
        return json;
    }

    public JSONObject locationsToJSON(){
        JSONObject json = new JSONObject();
        for(String id : locations.keySet())
            json.put(id, locations.get(id));
        return json;
    }

    public JSONObject tiesToJSON(){
        JSONObject json = new JSONObject();
        for(String id : ties.keySet())
            json.put(id, ties.get(id));
        return json;
    }

    public String toString() {
        JSONObject json = new JSONObject();
        json.put("last_entity_id", lastEntityId);
        json.put("last_group_id", lastGroupId);
        json.put("last_tie_id", lastTieId);
        json.put("entities", entitiesToJSON());
        json.put("groups", groupsToJSON());
        json.put("locations", locationsToJSON());
        json.put("ties", tiesToJSON());
        return json.toString();
    }


}