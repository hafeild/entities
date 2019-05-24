<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script> 
    <title><?= $title ?></title>
    <link rel="stylesheet" href="/style.css"/>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" integrity="sha384-BVYiiSIFeK1dGmJRAkycuHAHRg32OmUcww7on3RYdg4Va+PmSTsz/K68vbdEjh4u" crossorigin="anonymous">
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js" integrity="sha384-Tc5IQib027qvyjSMfHjOMaLkfuWVxZxUPnCJA7l2mCWNIpG9mGCD8wGNIcPD7Txa" crossorigin="anonymous"></script>
    <script src="/js/messages.js"></script>
    <script src="/js/character-list.js"></script>
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
            <a class="navbar-brand" href="#">Enteractions</a>
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
                        <li><a href="#" class="logout-button">Logout</a>
                            <form id="logout-form" action="account.php" method="post" style="display:none">
                                <input type="hidden" name="action" value="logout">
                            </form>
                        </li>
                    </ul>
                </li>
                <?php } ?>
            </ul>
            </div><!--/.nav-collapse -->
        </div>
    </nav>
      


    <div class="container">
        <?php require($view) ?>
    </div>

</body>
</html>
