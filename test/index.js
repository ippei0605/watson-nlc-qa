/**
 * @file テストケース
 * - テスト自動化に伴い、Bluemix サービス接続情報を定義している。Travis CIのテスト後に接続情報を更新してこの値を使用できなくすること。
 * - Natural Language Classifier # create は ¥300/call なので呼ばない。
 */

'use strict';

// モジュールを読込む。
const
    chai = require('chai'),
    Cloudant = require('cloudant'),
    fs = require('fs'),
    watson = require('watson-developer-cloud'),
    QaModel = require("../index");

const assert = chai.assert;

// コンテンツデータ
const CONTENT_FILENAME = 'answer.json';

// トレーニングデータ
const TRAINING_FILENAME = 'classifier.csv';

// Bluemix サービス接続情報 (テスト後は接続情報を更新してこの値を使用できなくすること)
const
    nlcCreds = {
        "url": "https://gateway.watsonplatform.net/natural-language-classifier/api",
        "username": "45e073e3-0404-4aeb-ad1b-f1c584c326b2",
        "password": "F6kH0E8sbQCd"
    },
    cloudantCreds = {
        "username": "6c36d289-4ceb-4fef-b396-8266af0ab4b8-bluemix",
        "password": "cf1cb274d196e18082dfef70cf4e1c567192896fb25ac4cd8c0b2f1dc5f7f410",
        "host": "6c36d289-4ceb-4fef-b396-8266af0ab4b8-bluemix.cloudant.com",
        "port": 443,
        "url": "https://6c36d289-4ceb-4fef-b396-8266af0ab4b8-bluemix:cf1cb274d196e18082dfef70cf4e1c567192896fb25ac4cd8c0b2f1dc5f7f410@6c36d289-4ceb-4fef-b396-8266af0ab4b8-bluemix.cloudant.com"
    };


const trainingFile = fs.createReadStream(__dirname + '/' + TRAINING_FILENAME);

describe('QaModel', () => {

    const
        qa = new QaModel(nlcCreds, '', cloudantCreds, 'answer'),
        qaNoClassifierId = new QaModel(nlcCreds, 'no-classifier', cloudantCreds, 'answer'),
        qaNoDb = new QaModel(nlcCreds, '', cloudantCreds, 'temp'),
        data = JSON.parse(fs.readFileSync(__dirname + '/' + CONTENT_FILENAME).toString());

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

    describe('ask', () => {
        it('Watson NLC に尋ねる。', (done) => {
            qa.ask('こんにちは', (doc) => {
                console.log('doc:', doc);

                assert(doc.class_name);
                assert(doc.message);
                assert(doc.confidence);
                done();
            });
        });

        it('Watson NLC に尋ねる。存在しない Classifier を指定', (done) => {
            qaNoClassifierId.ask('こんにちは', (doc) => {
                console.log('doc:', doc);
                assert.equal('', doc.class_name);
                assert(doc.message);
                assert.equal(0, doc.confidence);
                done();
            });
        });
    });

    describe('createClassifier', () => {
        it('mode=false, cLassifier が存在するため作成しない', (done) => {
            qa.createClassifier(trainingFile, false, (response) => {
                console.log('response:', response);
                done();
            });
        });
    });

    describe('DBなしの状態', () => {
        it('insertDesignDocument', (done) => {
            qaNoDb.insertDesignDocument(() => {
                done();
            });
        });

        it('insertDocuments', (done) => {
            qaNoDb.insertDocuments(data, () => {
                done();
            });
        });

        it('createDatabas 作成できる', (done) => {
            qaNoDb.createDatabase(() => {
                done();
            });
        });

        it('createDatabase 存在しているので作成できない', (done) => {
            qaNoDb.createDatabase(() => {
                done();
            });
        });
    });

    describe('DBありの状態', () => {
        it('insertDesignDocument', (done) => {
            qaNoDb.insertDesignDocument(() => {
                done();
            });
        });

        it('insertDocuments', (done) => {
            qaNoDb.insertDocuments(data, () => {
                // DBを削除する。
                const cloudant = new Cloudant(cloudantCreds.url);
                cloudant.db.destroy('temp', (err) => {
                    if (err) {
                        console.log('error', err);
                    } else {
                        console.log('データベース「temp」を削除しました。');
                    }
                    done();
                });
            });
        });
    });
});
