'use strict';

// モジュールを読込む。
const
    fs = require('fs'),
    QaModel = require("../index");


const
    nlcCreds = JSON.parse(process.env.NLC_CREDS),
    cloudantCreds = JSON.parse(process.env.CLOUDANT_CREDS);

const qa = new QaModel(nlcCreds, '', cloudantCreds, 'answer');

qa.ask('こんにちは', (doc) => {
    console.log('doc:', doc);
});


/*
const trainingFile = fs.createReadStream(__dirname + '/classifier.csv');
const metadata = {
    "language": "ja",
    "name": "My Classifier"
};


qa.train(trainingFile, metadata, false, (body) => {
    console.log('####', body);
});
*/