'use strict';

// モジュールを読込む。
const
    chai = require('chai'),
    QaModel = require("../index");

const assert = chai.assert;


const nlcCreds = {
    "url": "https://gateway.watsonplatform.net/natural-language-classifier/api",
    "username": "45e073e3-0404-4aeb-ad1b-f1c584c326b2",
    "password": "F6kH0E8sbQCd"
};

const cloudantCreds = {
    "username": "6c36d289-4ceb-4fef-b396-8266af0ab4b8-bluemix",
    "password": "cf1cb274d196e18082dfef70cf4e1c567192896fb25ac4cd8c0b2f1dc5f7f410",
    "host": "6c36d289-4ceb-4fef-b396-8266af0ab4b8-bluemix.cloudant.com",
    "port": 443,
    "url": "https://6c36d289-4ceb-4fef-b396-8266af0ab4b8-bluemix:cf1cb274d196e18082dfef70cf4e1c567192896fb25ac4cd8c0b2f1dc5f7f410@6c36d289-4ceb-4fef-b396-8266af0ab4b8-bluemix.cloudant.com"
};

describe('QaModel', () => {

    const
        qa = new QaModel(nlcCreds, '', cloudantCreds, 'answer'),
        qaNoDb = new QaModel(nlcCreds, '', cloudantCreds, 'no-database');

    describe('getAppSettings', () => {
        it('DBから値が取得できた場合', (done) => {
            qa.getAppSettings((doc) => {
                assert.equal('Watson Diet Trainer', doc.name);
                done();
            });
        });
        it('DBから値が取得できなかった場合', (done) => {
            qaNoDb.getAppSettings((doc) => {
                assert.equal('Q&A Chatbot', doc.name);
                done();
            });
        });
    });

    describe('askClassName', () => {
        it('DBから値が取得できた場合', (done) => {
            qa.askClassName('general_hello', (doc) => {
                assert.deepEqual({
                    "class_name": "general_hello",
                    "message": "こんにちは。私はワトソンです。",
                    "confidence": 0
                }, doc);
                done();
            });
        });
        it('DBから値が取得できなかった場合', (done) => {
            qa.askClassName('general_hello_hello', (doc) => {
                assert.deepEqual({
                    "class_name": '',
                    "message": 'エラーが発生しました。 not_found (code=404)',
                    "confidence": 0
                }, doc);
                done();
            });
        });
    });
});