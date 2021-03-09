$.fn.hasAttr = function (name) {
    return this.attr(name) !== undefined;
};

let TokenNavigator = function (annotation_data) {
    let annotation = annotation_data.annotation;
    let self = {
        annotation_data: annotation_data,
        groups: annotation.groups,
        entities: annotation.entities,
        locations: annotation.locations,
        ties: annotation.ties
    };

    function isWordyToken($token) {
        if ($token != null && $token.length > 0 && $token.hasAttr("data-token") && $token.html().trim() !== "" && !(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g.test($token.html().trim()))) {
            return true;
        }

        return false;
    }

    self.getTokenContext = function ($token, range) {
        let startDataToken = Math.max(1, $token.attr("data-token") - range / 2);
        let curToken = $token;

        // skip punctuative and spacing spans
        while (!(isWordyToken(curToken.prev((sibling) => sibling.hasAttr("data-token"))))) {
            curToken = curToken.prev((sibling) => sibling.hasAttr("data-token"));
        }
        curToken = curToken.prev((sibling) => sibling.hasAttr("data-token"));

        const tokenList = [];

        for (let i = 0; i < range;) {
            if (curToken == null) {
                break;
            }

            tokenList.push(curToken.clone());
            curToken = curToken.next((sibling) => sibling.hasAttr("data-token"));
            if (isWordyToken(curToken)) {
                // punctuation doesn't count as context
                // only increment if not punctuation
                i++;
            }
        }

        let str = "";
        tokenList.forEach((token) => {
            str += token.html();
        })

        console.log(str);
    };

    return self;
}