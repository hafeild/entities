<?php
global $user;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script> 
    <title><?= $title ?></title>
    <link rel="stylesheet" href="/css/style.css"/>
    <link rel="stylesheet" href="/css/colors.css"/>
    <link rel="stylesheet" href="/css/restyle.css"/>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" integrity="sha384-BVYiiSIFeK1dGmJRAkycuHAHRg32OmUcww7on3RYdg4Va+PmSTsz/K68vbdEjh4u" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretty-checkbox@3.0/dist/pretty-checkbox.min.css" crossorigin="anonymous">
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js" integrity="sha384-Tc5IQib027qvyjSMfHjOMaLkfuWVxZxUPnCJA7l2mCWNIpG9mGCD8wGNIcPD7Txa" crossorigin="anonymous"></script>
    <script src="/js/messages.js"></script>
</head>
<body class="main-app" data-logged-in="<?= $user == null ? "yes" : "no"?>">
    
    <div id="floating-error-container">
      <div id="floating-error-template" class="container alert alert-danger alert-dismissible floating-error" role="alert">
        <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>
        <span class="floating-error-content"></span>
      </div>
    </div>

    <!-- Fixed navbar -->
    <nav class="navbar navbar-default navbar-fixed-top">
        <div class="<?= $view == "views/annotation.php" ? "" : "container" ?>">
            <div class="navbar-header">
            <button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar" aria-expanded="false" aria-controls="navbar">
                <span class="sr-only">Toggle navigation</span>
                <span class="icon-bar"></span>
                <span class="icon-bar"></span>
                <span class="icon-bar"></span>
            </button>
            <a class="navbar-brand" href="/">EntiTies</a>
            </div>
            <div id="navbar" class="navbar-collapse collapse">
            <ul class="nav navbar-nav">
            </ul>
            <ul class="nav navbar-nav navbar-right">

                <?php if($user == null){ ?>
                <li><a href="/login.html">Login</a></li>
                <li><a href="/signup.html">Signup</a></li>

                <?php } else { ?>
                <!-- <li><p class="navbar-text"></p></li> -->
                <li class="dropdown">
                    <a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false"><?= $user["username"] ?> <span class="caret"></span></a>
                    <ul class="dropdown-menu">
                        <li>
                            <form name="logoutform" action="/account.php" method="post">
                                <input type="hidden" name="action" value="logout">
                            </form>
                            <a href="#" onclick="forms.logoutform.submit();">Logout</a>
                        </li>
                    </ul>
                </li>
                <?php } ?>
            </ul>
            </div><!--/.nav-collapse -->
        </div>
    </nav>
      


    <div id="content" class="container <?= $contentClasses ?>">



        <div id="errors" class="alert alert-danger errors" role="alert" 
            <?= count($errors) > 0 ? "" : 'style="display: none"' ?>>
            <?php foreach($errors as $error) { ?>
                <p><?= $error ?></p>
            <?php } ?>
        </div>

        <div id="messages" class="alert alert-success messages" role="alert" 
            <?= count($messages) > 0 ? "" : 'style="display: none"' ?>>
            <?php foreach($messages as $message) { ?>
                <p><?= $message ?></p>
            <?php } ?>
        </div>

        <?php require($view) ?>

    </div>

    <nav class="context-menu">
      <ul class="context-menu__items">
        <li class="context-menu__item">
          <a href="#" class="context-menu__link">
          </a>
        </li>
      </ul>
    </nav>
    <nav class="context-menu-hover">
        <ul class="context-menu__items">
          <li class="context-menu__item">
            <a href="#" class="context-menu__link">
            </a>
          </li>
        </ul>
    </nav>


    <!-- Add Mention Modal -->
      <div class="modal fade" id="addMentionModal" role="dialog">
        <div class="modal-dialog">
        
          <!-- Add Mention Modal content-->
          <div class="modal-content">
            <div class="modal-header">
              <button type="button" class="close" id="addMentionModalClose" data-dismiss="modal">&times;</button>
              <h4 class="modal-title">Add Mention</h4>
            </div>
            <div class="modal-body">
               <div class="recentlySeenWrapper">
                <h2>Most recently mentioned entities</h2>
                <ul class="modalSelector recentlySeenList"></ul>
                <hr/>
              </div>
              <h2>All entities</h2>
              <ul class="modalSelector" id="addMentionEntitySelectorChecklist">
              </ul>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-primary" id="confirmAddMention" data-dismiss="modal">Confirm</button>
            </div>
          </div>
          
        </div>
      </div>


    <!-- Reassign Mention Modal -->
      <div class="modal fade" id="reassignMentionModal" role="dialog">
        <div class="modal-dialog">
        
          <!-- Reassign Mention Modal content-->
          <div class="modal-content">
            <div class="modal-header">
              <button type="button" class="close" id="reassignMentionModalClose" data-dismiss="modal">&times;</button>
              <h4 class="modal-title">Reassign Mention</h4>
            </div>
            <div class="modal-body">
              <div class="recentlySeenWrapper">
                <h2>Most recently mentioned entities</h2>
                <ul class="modalSelector recentlySeenList"></ul>
                <hr/>
              </div>

              <h2>All entities</h2>
              <ul class="modalSelector" id='reassignMentionEntitySelectorChecklist'>
              </ul>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-primary" id="confirmReassignMention" data-dismiss="modal">Confirm</button>
            </div>
          </div>
          
        </div>
      </div>


    <!-- Group Name Change Modal -->
      <div class="modal fade" id="changeGroupNameModal" role="dialog">
        <div class="modal-dialog">
        
          <!-- Group Name Change Modal content-->
          <div class="modal-content">
            <div class="modal-header">
              <button type="button" class="close" id="changeGroupNameModalClose" data-dismiss="modal">&times;</button>
              <h4 class="modal-title">Change Group Name</h4>
            </div>
            <div class="modal-body">
              <input name="newGroupNameBox" class="form-control" placeholder="Enter a new group name" type="text" maxlength="512" id="newGroupNameBox"/>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-primary" id="confirmGroupNameChange" data-dismiss="modal">Confirm</button>
            </div>
          </div>
          
        </div>
      </div>

    <!-- Group Selector Modal -->
      <div class="modal fade" id="groupSelectorModal" role="dialog">
        <div class="modal-dialog">
        
          <!-- Group Selector Modal content-->
          <div class="modal-content">
            <div class="modal-header">
              <button type="button" class="close" id="groupSelectorModalClose" data-dismiss="modal">&times;</button>
              <h4 class="modal-title">Move Entity to Group</h4>
            </div>
            <div class="modal-body" id="groupSelectorModal-body">
              <ul class="modalSelector" id='groupSelectorChecklist'>
              </ul>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-primary" id="confirmGroupSelect" data-dismiss="modal">Confirm</button>
            </div>
          </div>
          
        </div>
      </div>  

    <!-- Tie Selector Modal -->
      <div class="modal fade" id="addTieModal" role="dialog">
        <div class="modal-dialog">
        
          <!-- Tie Modal content-->
          <div class="modal-content">
            <div class="modal-header">
              <button type="button" class="close" id="tieSelectorModalClose" data-dismiss="modal">&times;</button>
              <h4 class="modal-title">Create a tie between two entities</h4>
            </div>
            <div class="modal-body" id="addTieModal-body">
              <div class="row" id="tieModalTextArea">
              </div>
              <div class="row">
              </div>
              <div class="row" id="tieModalObjectSelectors">
                <div class="col-sm-6">
                  <div class="dropdown">
                    <button class="btn btn-primary dropdown-toggle" id="tieObjectOneDropdown" type="button" data-toggle="dropdown">Object One
                    <span class="caret"></span></button>
                    <ul class="dropdown-menu tieObjectSelector" id="tieObjectOneSelector">
                      
                    </ul>
                  </div>
                </div>
                <div class="col-sm-6">
                  <div class="dropdown">
                    <button class="btn btn-primary dropdown-toggle" id="tieObjectTwoDropdown" type="button" data-toggle="dropdown">Object Two
                    <span class="caret"></span></button>
                    <ul class="dropdown-menu tieObjectSelector" id="tieObjectTwoSelector">
                      
                    </ul>
                  </div>
                </div>
              </div>
              <hr />
              <div class="row" style="margin-top: 20px">
                <div class="col-sm-1"></div>
                <div class="col-sm-4">
                  <div style="float: left">
                    <input name="tieWeightBox" class="form-control" value="1" type="number" id="tieWeightBox"/>
                    <label style="width: 100%; text-align: center;" for="tieWeightBox">Weight</label>
                  </div>
                </div>
                <div class="col-sm-4">
                  <div style="float: left">
                    <input name="tieNameBox" class="form-control" placeholder="" type="text" maxlength="100" id="tieNameBox"/>
                    <label style="width: 100%; text-align: center;" for="tieWeightBox">Label</label>
                  </div>
                </div>
                <div class="col-sm-3" style="margin-top: 10px;">
                  <div class="form-check">
                    <div class="pretty p-switch p-fill">
                      <input name="tieDirectedToggle" class="form-check-input" type="checkbox" id="tieDirectedToggle" />
                      <div class="state p-primary">
                        <label style="width: 100%; text-align: center;" class="form-check-label" for="tieDirectedToggle">
                            Directed 
                        </label>
                      </div>
                    </div>
                  </div>
                </div>        
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-primary" id="confirmAddTie" data-dismiss="modal">Confirm</button>
            </div>
          </div>
          
        </div>
      </div>  

      <!-- Tie Selector Modal -->
      <div class="modal fade" id="editTieModal" role="dialog">
        <div class="modal-dialog">
        
          <!-- Tie Modal content-->
          <div class="modal-content">
            <div class="modal-header">
              <button type="button" class="close" id="tieSelectorModalClose" data-dismiss="modal">&times;</button>
              <h4 class="modal-title">Edit Tie</h4>
            </div>
            <div class="modal-body" id="editTieModal-body">
              <div class="row" style="margin-top: 20px">
                <div class="col-sm-1"></div>
                <div class="col-sm-4">
                  <div style="float: left">
                    <input name="tieWeightBox" class="form-control" value="1" type="number" id="edit-tieWeightBox"/>
                    <label style="width: 100%; text-align: center;" for="tieWeightBox">Weight</label>
                  </div>
                </div>
                <div class="col-sm-4">
                  <div style="float: left">
                    <input name="tieNameBox" class="form-control" placeholder="" type="text" maxlength="100" id="edit-tieNameBox"/>
                    <label style="width: 100%; text-align: center;" for="tieWeightBox">Label</label>
                  </div>
                </div>
                <div class="col-sm-3" style="margin-top: 10px;">
                  <div class="form-check">
                    <div class="pretty p-switch p-fill">
                      <input name="tieDirectedToggle" class="form-check-input" type="checkbox" id="edit-tieDirectedToggle" />
                      <div class="state p-primary">
                        <label style="width: 100%; text-align: center;" class="form-check-label" for="tieDirectedToggle">
                            Directed 
                        </label>
                      </div>
                    </div>
                  </div>
                </div>        
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-primary" id="confirmEditTie" data-dismiss="modal">Confirm</button>
            </div>
          </div>
          
        </div>
      </div> 

      <!-- hidden buttons that allows for the bootstrap modal to open -->
      <button class="hidden-modal-button" id="addMentionModalOpener" data-toggle="modal" data-target="#addMentionModal">
      <button class="hidden-modal-button" id="reassignMentionModalOpener" data-toggle="modal" data-target="#reassignMentionModal">
      <button class="hidden-modal-button" id="changeGroupnameModalOpener" data-toggle="modal" data-target="#changeGroupNameModal">
      <button class="hidden-modal-button" id="groupSelectorModalOpener" data-toggle="modal" data-target="#groupSelectorModal">
      <button class="hidden-modal-button" id="addTieModalOpener" data-toggle="modal" data-target="#addTieModal">
      <button class="hidden-modal-button" id="editTieModalOpener" data-toggle="modal" data-target="#editTieModal">  


</body>
</html>
