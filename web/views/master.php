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
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" integrity="sha384-BVYiiSIFeK1dGmJRAkycuHAHRg32OmUcww7on3RYdg4Va+PmSTsz/K68vbdEjh4u" crossorigin="anonymous">
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js" integrity="sha384-Tc5IQib027qvyjSMfHjOMaLkfuWVxZxUPnCJA7l2mCWNIpG9mGCD8wGNIcPD7Txa" crossorigin="anonymous"></script>
    <script src="/js/messages.js"></script>
</head>
<body class="main-app" data-logged-in="<?= $user == null ? "yes" : "no"?>">
    


    <!-- Fixed navbar -->
    <nav class="navbar navbar-default navbar-fixed-top">
        <div class="container">
            <div class="navbar-header">
            <button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar" aria-expanded="false" aria-controls="navbar">
                <span class="sr-only">Toggle navigation</span>
                <span class="icon-bar"></span>
                <span class="icon-bar"></span>
                <span class="icon-bar"></span>
            </button>
            <a class="navbar-brand" href="/">Enteractions</a>
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
            <i></i> TEST
          </a>
        </li>
      </ul>
    </nav>

</body>
</html>
