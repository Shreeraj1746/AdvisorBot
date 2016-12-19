var wit = require('node-wit');

module.exports = function(config) {

    if (!config || !config.token) {
        throw new Error('No wit.ai API token specified');
    }

    if (!config.minimum_confidence) {
        config.minimum_confidence = 0.5;
    }

    var middleware = {};

    middleware.receive = function(bot, message, next) {
        if (message.text) {
            wit.captureTextIntent(config.token, message.text, function(err, res) {
                if (err) {
                    next(err);
                } else {
                    // sort in descending order of confidence so the most likely match is first.
                    console.log(JSON.stringify(res));
                    message.named_entities = res
                    // message.intents = res.outcomes.sort(function(a,b) {
                    //     return b.confidence - a.confidence;
                    // });
                    //console.log('message.named_entities: ', message.named_entities);
                    next();
                }
            });
        }
    };

    middleware.hears = function(tests, message) {

        // //console.log(message);
        // //console.log(message.intents[0].entities);
        // obj = message.intents[0].entities
        // var count = Object.keys(obj).length;
        // //console.log(count)

        // if (count != 0) {
        //     //console.log('entered if');
        //     for (var i = 0; i < message.intents[0].entities.intent.length; i++) {
        //         //console.log('i ', i);
        //         for (var t = 0; t < tests.length; t++) {
        //             console.log('t: ', t);
        //             console.log('tests[t]:', tests[t]);
        //             if (message.intents[0].entities.intent[0].value == tests[t] &&
        //                 message.intents[0].entities.intent[0].confidence >= config.minimum_confidence) {
        //                 return true;
        //             }
        //         }
        //     }
        // }

        //console.log(message);
        //console.log(message.named_entities);
        for (var key in message.named_entities){
            for (var t=0; t < tests.length; t++){
                if(message.named_entities[key] == tests[t]){
                    return true;
                }
            }
        }

        return false;
};

    return middleware;
};
