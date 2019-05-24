
        <div id="texts" class="page">
            <?php $texts = $data["texts"]; ?>

            <?php if($user != null){ ?>
            <h2>Your texts</h2>
            <div id="user-text-list">
                <ul>
                <?php 
                $textsPrinted = 0;
                for($i = 0; $i < count($texts); $i++){
                    $text = $texts[$i];
                    if($text["uploaded_by"] == $user["id"]){ 
                        $textsPrinted++; ?>
                        <li><a href="#annotatinos" class="onpage" data-id="<?= $text["id"] ?>"
                            ><?= $text["title"] ?></a> (processed: 
                            <?= $text["processed"] ? "yes" : "no" ?>)
                        </li>
                    <?php }
                } 
                if($textsPrinted == 0){ ?>
                    <p>No texts found :( <a href="#upload">Upload one!</a></p>
                <?php } ?>
                </ul>
            </div>
            <?php } ?>

            <h2>All texts</h2>
            <div id="text-list">
                <ul>
                <?php 
                for($i = 0; $i < count($texts); $i++){
                    $text = $texts[$i]; ?>
                    <li><a href="/texts/<?= $text["id"] ?>/annotations" class="onpage" data-id="<?= $text["id"] ?>"
                        ><?= $text["title"] ?></a> (processed: 
                        <?= $text["processed"] ? "yes" : "no" ?>)
                    </li>
                <?php }
                if(count($texts) == 0){ ?>
                    <p>No texts found :( <a href="#upload">Upload one!</a></p>
                <?php } ?>
                </ul>
            </div>
            <button id="refresh-texts">Refresh</button>
        </div>


        <div id="upload" class="page">
            <h2>Upload text</h2>
            <form id="file-upload-form" enctype="multipart/form-data" method="post">
                Title: <input type="text" name="title"/><br/>
                Select a plain text file to upload <input type="file" name="file"/><br/>
                <input type="submit" value="Upload"/>
            </form>
        </div>

        <!-- <h2>Server response</h2>
        <div id="response"></div> -->