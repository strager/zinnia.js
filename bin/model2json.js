#!/usr/bin/env node

var zinnia = require('../lib/zinnia');

var modelFilename = process.argv[2];

if (!modelFilename) {
    var exe = process.argv.slice(0, 2).join(" ");
    console.error("Usage: " + exe + " modelfile.model > modelfile.model.json");
    process.exit(1);
}

zinnia.model.loadFromFile(modelFilename, function (err, model) {
    if (err) throw err;

    process.stdout.write(JSON.stringify(model));
    process.stdout.write("\n");
});
