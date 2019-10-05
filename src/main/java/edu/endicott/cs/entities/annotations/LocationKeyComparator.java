// Author:  Henry Feild
// Files:   LocaitonKeyComparator.java
// Date:    19-Sep-2019

package edu.endicott.cs.entities.annotations;

import java.util.Comparator;

public class LocationKeyComparator implements Comparator<String> {
    public int compare(String key1, String key2){
        long startA = Long.parseLong(key1.split("_")[0]);
        long startB = Long.parseLong(key2.split("_")[0]);
        return Long.compare(startA, startB);
    }

    public boolean equals(String key1, String key2){
        return compare(key1, key2) == 0;
    }

}
