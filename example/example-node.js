var path = require('path');

var zinnia = require('../lib/zinnia');

var modelFilename = process.argv[2] || path.join(__dirname, 'ja-hiragana.model');

zinnia.model.loadFromFile(modelFilename, function (err, model) {
    if (err) throw err;

    var recognizer = zinnia.recognizer.fromModel(model);

    var character = {
        width: 300,
        height: 300,
        strokes: [
            [
                51, 29,
                117, 41,
            ], [
                99, 65,
                219, 77,
            ], [
                27, 131,
                261, 131,
            ], [
                129, 17,
                57, 203,
            ], [
                111, 71,
                219, 173,
            ], [
                81, 161,
                93, 281,
            ], [
                99, 167,
                207, 167,
                189, 245,
            ], [
                99, 227,
                189, 227,
            ], [
                111, 257,
                189, 245,
            ]
        ]
    };

    var classified = recognizer.classify(character, 10);

    console.log(classified);
});
