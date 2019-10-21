<?php 
// File:    migrate-database.php
// Author:  Hank Feild
// Date:    10-Oct-2019
// Purpose: Performs EntiTies database migrations. Currently tested with 
//          sqlite and PostgreSQL.

$CONFIG_FILE = "conf.json";
$MIGRATION_FILE = ".entities-migration";
$PERMISSIONS = [
    "NONE"  => 0,
    "READ"  => 1,
    "WRITE" => 2,
    "OWNER" => 3
];

// Migration list. Each function should make changes assuming that all 
// previous functions have run. The index of the mostly recently run migration
// will be stored in the file .entities-migration. After adding a migration
// function, list it's name at the end of this array.
$migrations = [
    "makeUsersTextsAnnotationsTables",
    "renameTextUploadedAtColumn",
    "updateUsersTextsAnnotationsTables",
    "addPermissionsTables"
];


if(count($argv) == 1 || (count($argv) == 2 && $argv[1] == "down") ){
    die("Usage: migrate-database.php [up|down] [<num-migrations>*]\n". 
        "<run-migrations> is optional for up migrations and defaults to all.\n". 
        "It is required for down migration; use -1 for 'all'.\n");
}

$numMigrations = -1;

// Read in command line args.
$migrationDirection = $argv[1];
if($migrationDirection == "down"){
    $confirm = readline(
        "Are you sure you want to migrate down? You will lose any existing ". 
        "data in tables\nremoved during the down migration. Enter y to ". 
        "continue, or anything else to abort: ");
    if($confirm !== "y" && $confirm !== "Y"){
        die("Aborting.");
    }
}

// Read in the number of migrations to conduct.
if(count($argv) > 2){
    $numMigrations = intval($argv[2]);
}

// Read in the config file.
$configFD = fopen($CONFIG_FILE, "r") or 
    die("Error reading configuration file.");

// die(preg_replace("#(^[ \t]*//.*$)|(^\s*$)#m", "", 
//     fread($configFD,filesize($CONFIG_FILE))) ."\n\n");

// Strip out comments before parsing the config file.
$CONFIG = json_decode(
        preg_replace("#(^[ \t]*//.*$)|(^\s*$)#m", "\n", 
    fread($configFD,filesize($CONFIG_FILE))));
fclose($configFD);

print "DSN: ". $CONFIG->dsn ."\n";

$isPostgres = preg_match('/^pgsql/', $CONFIG->dsn);
$isSqlite = preg_match('/^sqlite/', $CONFIG->dsn);
if($isPostgres)
    print "Connecting to PostgreSQL server\n";
if($isSqlite)
    print "Connecting to sqlite3 server\n\n";


// Read the last migration.
$lastMigration = -1;
if(file_exists($MIGRATION_FILE)){
    $migrationFD = fopen($MIGRATION_FILE, "r");
    $lastMigration = intval(fread($migrationFD, filesize($MIGRATION_FILE)));
    print "Last migration: $lastMigration\n";
    fclose($migrationFD);
}

// Run migrations.
$dbh = connectToDB();
$dbh->beginTransaction();
try {

    // Un-migrate (down).
    if($migrationDirection == "down"){
        $limit = 0;
        if($numMigrations > 0){
            $limit = max([0, $lastMigration-$numMigrations+1]);
        }

        for(; $lastMigration >= $limit; $lastMigration--){ 
            print "Un-running migration $lastMigration: ${migrations[$lastMigration]}\n";
            $migrations[$lastMigration]($dbh, $migrationDirection);
            print "\n";
        }

    // Migrate (up).
    } else if($migrationDirection == "up") {
        $limit = count($migrations);
        if($numMigrations > 0){
            $limit = min([$limit, $lastMigration + $numMigrations + 1]);
        }

        for($lastMigration++; $lastMigration < $limit; $lastMigration++){
            print "Running migration $lastMigration: ${migrations[$lastMigration]}\n";
            $migrations[$lastMigration]($dbh, $migrationDirection);
            print "\n";
        }
        $lastMigration--;
    } else {
        die("Unsupported migration: \"$migrationDirection\"; please use ".
            "\"up\" or \"down\".\n");
    }
    $dbh->commit();

    // Write the migration achieved.
    $migrationFD = fopen($MIGRATION_FILE, "w");
    fwrite($migrationFD, "$lastMigration");
    fclose($migrationFD);

} catch(Exception $e){
    die("Error performing migration: $e");
    $dbh->rollback();
}



// Helpers

/**
 * @return The current timestamp in the format Y-m-d H:i:s.
 */
function curDateTime() {
    // return new DateTime();
   return (new DateTime())->format("Y-m-d H:i:s");
}

/**
 * Connects to the database as specified in the config file (see $CONFIG_FILE
 * above).
 * 
 * @return A PDO object for the database.
 */
function connectToDB(){
    global $CONFIG;
    global $dbh;

    if($dbh === null){
        try {
            if($CONFIG->authentication){
                $dbh = new PDO($CONFIG->dsn, 
                    $CONFIG->username, $CONFIG->password);
            } else {
                $dbh = new PDO($CONFIG->dsn);
            }

            // Raise exceptions when errors are encountered.
            $dbh->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        } catch (PDOException $e) {
            die("Connection failed: ". $e->getMessage() . 
                "; dsn: ". $CONFIG->dsn);
        }
    }
    return $dbh;
}




////////////////////////////////////////////////////////////////////////////////
// Migration definitions.
//
// Add new migrations to the bottom of this section.
////////////////////////////////////////////////////////////////////////////////

function makeUsersTextsAnnotationsTables($dbh, $direction="up"){
    global $isPostgres;

    // Add tables.
    if($direction === "up"){
        // Create users table.
        print "Creating users table...\n";
        $dbh->exec("create table users(".
                ($isPostgres ? "id serial primary key," 
                             : "id integer primary key autoincrement,").
                "username varchar(50),".
                "password varchar(255),".
                "auth_token varchar(100),".
                ($isPostgres ? "created_at timestamp" 
                             : "created_at datetime").
            ")"
        );

        // Create texts metadata table.
        print "Creating texts metadata file...\n";
        $dbh->exec("create table texts(".
                ($isPostgres ? "id serial primary key," 
                             : "id integer primary key autoincrement,").
                "title varchar(256),".
                "md5sum char(32) unique,".
                ($isPostgres ? "uploaded_at timestamp," 
                             : "uploaded_at datetime,").
                "uploaded_by integer, ".
                "tokenization_in_progress boolean default '0', ".
                "tokenization_error boolean default '0', ".
                "foreign key(uploaded_by) references users(id)".
            ")"
        );

        // Create annotations table.
        print "Creating annotations table...\n";
        $dbh->exec("create table annotations(".
                ($isPostgres ? "id serial primary key," 
                             : "id integer primary key autoincrement,").
                "text_id integer,".
                "created_by integer,".
                "annotation text,".
                "parent_annotation_id integer,".
                "method text,".
                "method_metadata text,". // Versioning, parameters, etc.
                "label text,".
                ($isPostgres ? "created_at timestamp," 
                             : "created_at datetime,").
                ($isPostgres ? "updated_at timestamp," 
                             : "updated_at datetime,").
                "automated_method_in_progress boolean default '0',". 
                "automated_method_error boolean default '0',".
                "foreign key(created_by) references users(id),".
                "foreign key(text_id) references texts(id)".
            ")"
        );

    // Tear down.
    } else {
        // Delete annotations table.
        print "Removing annotations table...\n";
        $dbh->exec("drop table annotations");

        // Delete texts metadata table.
        print "Removing texts table...\n";
        $dbh->exec("drop table texts");

        // Delete users table.
        print "Removing users table...\n";
        $dbh->exec("drop table users");
    }
}

function renameTextUploadedAtColumn($dbh, $direction="up"){
    global $isSqlite, $isPostgres;

    // Add new columns.
    if($direction === "up"){
        print "Renaming 'uploaded_at' column to 'created_at' in texts ". 
              "table...\n";
        if($isSqlite){
            // Create texts metadata table.
            $dbh->exec("alter table texts rename to _texts");
            $dbh->exec("create table texts(".
                    "id integer primary key autoincrement,".
                    "title varchar(256),".
                    "md5sum char(16) unique,".
                    ($isPostgres ? "created_at timestamp," 
                                 : "created_at datetime,").
                    "uploaded_by integer, ".
                    "tokenization_in_progress boolean default '0', ".
                    "tokenization_error boolean default '0', ".
                    "foreign key(uploaded_by) references users(id)".
                ")"
            );
            $dbh->exec("insert into texts(id,title,md5sum,created_at,". 
                "uploaded_by,tokenization_in_progress,tokenization_error) ".
                "select id,title,md5sum,uploaded_at,uploaded_by,". 
                "tokenization_in_progress,tokenization_error from _texts");
            $dbh->exec("drop table _texts");

        } else {
            // Rename the column
            $dbh->exec(
                "alter table texts rename column uploaded_at to created_at");
        }
    // Remove columns.
    } else {
        print "Renaming 'created_at' column to 'uploaded_at' in texts ". 
              "table...\n";
        if($isSqlite){
            // Create texts metadata table.
            $dbh->exec("alter table texts rename to _texts");
            $dbh->exec("create table texts(".
                    "id integer primary key autoincrement,".
                    "title varchar(256),".
                    "md5sum char(16) unique,".
                    ($isPostgres ? "uploaded_at timestamp," 
                                 : "uploaded_at datetime,").
                    "uploaded_by integer, ".
                    "tokenization_in_progress boolean default '0', ".
                    "tokenization_error boolean default '0', ".
                    "foreign key(uploaded_by) references users(id)".
                ")"
            );
            $dbh->exec("insert into texts(id,title,md5sum,uploaded_at,". 
                "uploaded_by,tokenization_in_progress,tokenization_error) ".
                "select id,title,md5sum,created_at,uploaded_by,". 
                "tokenization_in_progress,tokenization_error from _texts");
            $dbh->exec("drop table _texts");

        } else {
            // Rename the column
            $dbh->exec(
                "alter table texts rename column created_at to uploaded_at");
        }

    }
}

function updateUsersTextsAnnotationsTables($dbh, $direction="up"){
    global $isSqlite, $isPostgres;

    // Add new columns.
    if($direction === "up"){

        // Add is_public column to texts table.
        print "Adding is_public column to texts table...\n";
        $dbh->exec("alter table texts add is_public boolean default '0'");
        $dbh->exec("update texts set is_public = '0'");

        // Add updated_at column to texts table.
        print "Adding updated_at column to texts table...\n";
        $dbh->exec("alter table texts add updated_at ". 
            ($isPostgres ? "timestamp" : "datetime"));
        $dbh->exec("update texts set updated_at = created_at");

        // Add is_public column to texts table.
        print "Adding is_public column to annotations table...\n";
        $dbh->exec("alter table annotations add is_public boolean default NULL");
        $dbh->exec("update annotations set is_public = NULL");

        // Add updated_at column to users table.
        print "Adding updated_at column to users table...\n";
        $dbh->exec("alter table users add updated_at ". 
            ($isPostgres ? "timestamp" : "datetime"));
        $dbh->exec("update users set updated_at = created_at");


    // Remove columns.
    } else {
        // sqlite3 doesn't support 'alter table ... drop <column>', so we 
        // have to move the old tables, create new ones, then copy all the 
        // data over.
        if($isSqlite){

            // Create texts metadata table.
            print "Removing is_public and updated_at columns from texts table...\n";
            $dbh->exec("alter table texts rename to _texts");
            $dbh->exec("create table texts(".
                    "id integer primary key autoincrement,".
                    "title varchar(256),".
                    "md5sum char(16) unique,".
                    ($isPostgres ? "created_at timestamp," 
                                 : "created_at datetime,").
                    "uploaded_by integer, ".
                    "tokenization_in_progress boolean default '0', ".
                    "tokenization_error boolean default '0', ".
                    "foreign key(uploaded_by) references users(id)".
                ")"
            );
            $dbh->exec("insert into texts(id,title,md5sum,created_at,". 
                "uploaded_by,tokenization_in_progress,tokenization_error) ".
                "select id,title,md5sum,created_at,uploaded_by,". 
                "tokenization_in_progress,tokenization_error from _texts");
            $dbh->exec("drop table _texts");

            // Create annotations table.
            print "Removing is_public column from annotations table...\n";
            $dbh->exec("alter table annotations rename to _annotations");
            $dbh->exec("create table annotations(".
                    "id integer primary key autoincrement,".
                    "text_id integer,".
                    "created_by integer,".
                    "annotation text,".
                    "parent_annotation_id integer,".
                    "method text,".
                    "method_metadata text,". // Versioning, parameters, etc.
                    "label text,".
                ($isPostgres ? "created_at timestamp," 
                             : "created_at datetime,").
                ($isPostgres ? "updated_at timestamp," 
                             : "updated_at datetime,").
                    "automated_method_in_progress boolean default '0',". 
                    "automated_method_error boolean default '0',".
                    "foreign key(created_by) references users(id),".
                    "foreign key(text_id) references texts(id)".
                ")"
            );
            $dbh->exec("insert into annotations(id,text_id,created_by,". 
                "annotation,parent_annotation_id,method,method_metadata,". 
                "label,created_at,updated_at,automated_method_in_progress,". 
                "automated_method_error) ".
                "select id,text_id,created_by,annotation,parent_annotation_id,". 
                "method,method_metadata,label,created_at,updated_at,". 
                "automated_method_in_progress,automated_method_error ". 
                "from _annotations");
            $dbh->exec("drop table _annotations");

            // Create users table.
            print "Removing updated_at column from users table...\n";
            $dbh->exec("alter table users rename to _users");
            $dbh->exec("create table users(".
                    ($isPostgres ? "id serial primary key," 
                                : "id integer primary key autoincrement,").
                    "username varchar(50),".
                    "password varchar(255),".
                    "auth_token varchar(100),".
                    ($isPostgres ? "created_at timestamp" 
                                : "created_at datetime").
                ")"
            );
            $dbh->exec("insert into users(id,username,password,auth_token,". 
                "created_at) select id,username,password,auth_token,". 
                "created_at from _users");
            $dbh->exec("drop table _users");


        } else {
            // Remove is_public column from texts table.
            print "Removing is_public column from texts table...\n";
            $dbh->exec("alter table texts drop column is_public");
            // Remove updated_at column from texts table.
            print "Removing updated_at column from texts table...\n";
            $dbh->exec("alter table texts drop column updated_at");

            // Remove is_public column from the annotations table.
            print "Removing is_public column from annotations table...\n";
            $dbh->exec("alter table annotations drop column is_public");

            // Remove updated_at column from users table.
            print "Removing updated_at column from users table...\n";
            $dbh->exec("alter table users drop column updated_at");
        }
    }
}

function addPermissionsTables($dbh, $direction="up"){
    global $isPostgres, $PERMISSIONS;

    // Add tables.
    if($direction === "up"){
        // Create text_permissions table.
        print "Creating text_permissions table...\n";
        $dbh->exec("create table text_permissions(".
                ($isPostgres ? "id serial primary key," 
                             : "id integer primary key autoincrement,").
                "text_id integer,".
                "user_id integer,".
                "permission integer default 0,".
                ($isPostgres ? "created_at timestamp," 
                             : "created_at datetime,").
                "unique(text_id, user_id),".
                "foreign key(text_id) references texts(id),".
                "foreign key(user_id) references users(id)".
            ")"
        );

        // Give each user ownership of the texts they own.
        $statement = $dbh->prepare(
            "select id as text_id, uploaded_by as user_id from texts");
        $statement->execute();
        $texts = $statement->fetchAll(PDO::FETCH_ASSOC);
        $insertStatement = $dbh->prepare("insert into text_permissions(". 
            "text_id, user_id, permission, created_at) values (".
            ":text_id, :user_id, :permission, :created_at)");
        foreach($texts as $text){
            $insertStatement->execute([
                ":text_id" => $text["text_id"],
                ":user_id" => $text["user_id"],
                ":permission" => $PERMISSIONS["OWNER"],
                ":created_at" => curDateTime()
            ]);
        }

        // Create annotation_permissions table.
        print "Creating annotation_permissions table...\n";
        $dbh->exec("create table annotation_permissions(".
                ($isPostgres ? "id serial primary key," 
                             : "id integer primary key autoincrement,").
                "annotation_id integer,".
                "user_id integer,".
                "permission integer default 0,".
                ($isPostgres ? "created_at timestamp," 
                             : "created_at datetime,").
                "unique(annotation_id, user_id),".
                "foreign key(annotation_id) references annotations(id),".
                "foreign key(user_id) references users(id)".
            ")"
        );

        // Give each user ownership of the annotations they own.
        $statement = $dbh->prepare(
            "select id as annotation_id, created_by as user_id from annotations");
        $statement->execute();
        $annotations = $statement->fetchAll(PDO::FETCH_ASSOC);
        $insertStatement = $dbh->prepare("insert into annotation_permissions(". 
            "annotation_id, user_id, permission, created_at) values (".
            ":annotation_id, :user_id, :permission, :created_at)");
        foreach($annotations as $annotation){
            $insertStatement->execute([
                ":annotation_id" => $annotation["annotation_id"],
                ":user_id" => $annotation["user_id"],
                ":permission" => $PERMISSIONS["OWNER"],
                ":created_at" => curDateTime()
            ]);
        }

    // Tear down.
    } else {
        // Delete text_permissions table.
        print "Removing text_permissions table...\n";
        $dbh->exec("drop table text_permissions");

        // Delete annotation_permissions table.
        print "Removing annotation_permissions table...\n";
        $dbh->exec("drop table annotation_permissions");
    }
}




