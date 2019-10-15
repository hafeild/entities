<?php
// File:    permissions.php
// Author:  Hank Feild
// Date:    15-Oct-2019
// Purpose: Defines several helper functions related to permission checking. 

// Permissions settings.
$PERMISSIONS = [
    "NONE"  => 0,
    "READ"  => 1,
    "WRITE" => 2,
    "OWNER" => 3
];

/**
 * Determines if the user has the requested permission level for the requested
 * text.
 * 
 * @param textId The id of the text.
 * @param permissionLevel The requested permission level.
 * @param userId The user to check; if omitted, defaults to currently logged in user,
 *          if any.
 * @return True if the user has the requested permission on the given text.
 */
function hasTextPermission($textId, $permissionLevel, $userId=null){
    global $user, $PERMISSIONS;

    // error_log("In hasTextPermission");
    if($userId == null && $user != null){
        $userId = $user["id"];
        // error_log("userId set to null; using user['id']: ${user["id"]}");
    }

    $text = getTextMetadata($textId);

    // Check if the resource is public.
    if($userId == null && $permissionLevel == $PERMISSIONS["READ"]){
        return $text["is_public"] == "1";

    } else if($userId != null) {
        // Check if the user has the requested permissions.
        $permission = getTextPermission($userId, $textId);
        return intval($permission["permission"]) >= $permissionLevel || 
                ($permissionLevel == $PERMISSIONS["READ"] && 
                 $text["is_public"] == "1");
    }

    return false;
}

/**
 * Alias for hasTextPermission($textId, $PERMISSIONS["READ"], $userId).
 */
function canViewText($textId, $userId=null){
    global $PERMISSIONS;
    return hasTextPermission($textId, $PERMISSIONS["READ"], $userId);
}

/**
 * Alias for hasTextPermission($textId, $PERMISSIONS["WRITE"], $userId).
 */
function canModifyText($textId, $userId=null){
    global $PERMISSIONS;
    return hasTextPermission($textId, $PERMISSIONS["WRITE"], $userId);
}

/**
 * Alias for hasTextPermission($textId, $PERMISSIONS["OWNER"], $userId).
 */
function ownsText($textId, $userId=null){
    global $PERMISSIONS;
    return hasTextPermission($textId, $PERMISSIONS["OWNER"], $userId);
}


/**
 * Determines if the user has the requested permission level for the requested
 * annotation.
 * 
 * @param annotationId The id of the annotation.
 * @param permissionLevel The requested permission level.
 * @param userId The id of the user to check; if omitted, defaults to currently
 *               logged in user, if any.
 * @return True if the user has the requested permission on the given 
 *         annotation.
 */
function hasAnnotationPermission($annotationId, $permissionLevel, $userId=null){
    global $user, $PERMISSIONS;
    if($userId == null && $user != null){
        $userId = $user["id"];
    }

    // Check if the resource is public.
    if($permissionLevel == $PERMISSIONS["READ"]){
        $annotation = lookupAnnotation($annotationId);
        return $annotation["is_public"] == "1";

    } else if($userId != null) {
        // Check if the user has the requested permissions.
        $permission = getAnnotationPermission($userId, $annotationId);
        return intval($permission["permission"]) >= $permissionLevel;
    }

    return false;
}

/**
 * Alias for hasAnnotationPermission($textId, $PERMISSIONS["READ"], $userId).
 */
function canViewAnnotation($textId, $userId=null){
    global $PERMISSIONS;
    return hasAnnotationPermission($textId, $PERMISSIONS["READ"], $userId);
}

/**
 * Alias for hasAnnotationPermission($textId, $PERMISSIONS["WRITE"], $userId).
 */
function canModifyAnnotation($textId, $userId=null){
    global $PERMISSIONS;
    return hasAnnotationPermission($textId, $PERMISSIONS["WRITE"], $userId);
}

/**
 * Alias for hasAnnotationPermission($textId, $PERMISSIONS["OWNER"], $userId).
 */
function ownsAnnotation($textId, $userId=null){
    global $PERMISSIONS;
    return hasAnnotationPermission($textId, $PERMISSIONS["OWNER"], $userId);
}
