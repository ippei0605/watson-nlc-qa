/**
 * @file テストケース
 * - テスト実行のための前提条件
 *   - 実行する環境において、次の環境変数を設定すること。 (Travis CI には設定済)
 *     - NLC_CREDS: Natural Language Classifier のサービス資格情報
 *     - ERROR_NLC_CREDS: Natural Language Classifier のサービス資格情報 (パスワード変更してエラーとなるように設定)
 *     - CLOUDANT_CREDS: Cloudant NoSQL DB のサービス資格情報
 *   - Travis CI の場合は、Project の More options の settings で設定する。(JSONは値を'で括る。)
 * - Natural Language Classifier # create は ¥300/call なのでテストしない。
 * - ローカル環境で codecov を実行する場合は、環境変数 CODECOV_TOKEN を設定すること。(Travis CI には設定済)
 */

'use strict';

// モジュールを読込む。
const
    chai = require('chai'),
    Cloudant = require('cloudant'),
    fs = require('fs'),
    QaModel = require("../index");

const assert = chai.assert;

// コンテンツデータ
const CONTENT_FILENAME = 'answer.json';

// トレーニングデータ
const
    TRAINING_CSV = fs.createReadStream(__dirname + '/classifier.csv'),
    TRAINING_METADATA = {
        "language": "ja",
        "name": "My Classifier"
    };

// マップファンクション
const MAP_FUNCTION = `function (doc) {
    if (doc._id !== 'app_settings') {
        var row = {
            "_id": doc._id,
            "_rev": doc._rev,
            "message": doc.message,
            "questions": doc.questions
        };
        emit(doc._id, row);
    }
}`;

// Bluemix サービス接続情報
const
    nlcCreds = JSON.parse(process.env.NLC_CREDS),
    errorNlcCreds = JSON.parse(process.env.ERROR_NLC_CREDS),
    cloudantCreds = JSON.parse(process.env.CLOUDANT_CREDS);

describe('QaModel', () => {

    const
        qa = new QaModel(cloudantCreds, 'answer', nlcCreds),
        qaNlcError = new QaModel(cloudantCreds, 'answer', errorNlcCreds),
        qaNoClassifierId = new QaModel(cloudantCreds, 'answer', nlcCreds, 'no-classifier'),
        qaNoDb = new QaModel(cloudantCreds, 'temp', nlcCreds),
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

        it('list Classifier エラー時 (NLC パスワードエラー)', (done) => {
            qaNlcError.ask('こんにちは', (doc) => {
                console.log('doc:', doc);
                assert.equal('', doc.class_name);
                assert(doc.message);
                assert.equal(0, doc.confidence);
                done();
            });
        });

        it('Watson NLC に尋ねる。存在しない Classifier を指定', (done) => {
            qaNoClassifierId.ask('こんにちは', (doc) => {
                console.log('####doc:', doc);
                assert.equal('', doc.class_name);
                assert(doc.message);
                assert.equal(0, doc.confidence);
                done();
            });
        });
    });

    describe('train', () => {
        it('mode=false, cLassifier が存在するため作成しない', (done) => {
            qa.train(TRAINING_CSV, TRAINING_METADATA, false, (response) => {
                console.log('response:', response);
                done();
            });
        });
    });

    describe('DBなしの状態', () => {
        it('insertDesignDocument', (done) => {
            qaNoDb.insertDesignDocument('', () => {
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
        it('insertDesignDocument, mapFunction', (done) => {
            qaNoDb.insertDesignDocument(MAP_FUNCTION, () => {
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
