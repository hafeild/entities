// this should have been a JQuery function to begin with
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
        if ($token != null && $token.length > 0
            && $token.hasAttr("data-token")
            && $token.html().trim() !== ""
            && !(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g.test($token.html().trim()))) {
            return true;
        }

        return false;
    }

    self.getTokenContext = function ($token, range) {
        let startDataToken = Math.max(2, $token.attr("data-token") - range / 2);
        let curToken = $token;

        console.log($token);

        // step backward until start of range is found
        while (curToken.length > 0 && curToken.attr("data-token") != startDataToken) {
            curToken = curToken.prevAll(`[data-token]:first`);
        }

        // skip punctuation and empty spans
        do {
            curToken = curToken.prevAll(`[data-token]:first`);
        } while (!(isWordyToken(curToken.prevAll(`[data-token]:first`))))

        const tokenList = [];

        for (let i = 0; i < range;) {
            if (curToken == null) {
                break;
            }

            tokenList.push(curToken.clone());
            // step forward
            curToken = curToken.next();
            if (isWordyToken(curToken)) {
                // punctuation doesn't count as context
                // only increment if not punctuation
                i++;
            }
        }

        return tokenList;
    };

    self.predictTieTokens = function(tokenList, $startToken) {
        let predictedTokenFirst = undefined;
        let predictedTokenSecond = undefined;

        let startDataToken = parseInt($startToken.attr("data-token"));

        tokenList.forEach(($token) => {
            if ($token.hasClass("entity")) {

                if (parseInt($token.attr("data-token")) < startDataToken) {
                    predictedTokenFirst = $token;
                }
                if (parseInt($token.attr("data-token")) > startDataToken && predictedTokenSecond == undefined) {
                    predictedTokenSecond = $token;
                }
            }
        })

        return {
            predictedTokenFirst: predictedTokenFirst,
            predictedTokenSecond: predictedTokenSecond,
        };
    }

    return self;
}