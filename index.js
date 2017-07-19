/**
 * Watson Natural Language Classifier Q&A Model
 * @module index
 * @author Ippei SUZUKI
 */

'use strict';

// モジュールを読込む。
const
    cloudant = require('cloudant'),
    watson = require('watson-developer-cloud');

class QaModel {
    /**
     * コンストラクター
     * @classdesc Q&A モデル
     * @param nlcCreds {object} Watson Natural Language Classifier 接続情報
     * @param classifierId {string} Classifier ID
     * @param cloudantCreds {object} Cloudant NoSQL DB 接続情報
     * @param dbName {string} データベース名
     */
    constructor(nlcCreds, classifierId, cloudantCreds, dbName) {
        /**
         * Watson Natural Language Classifier サービス
         * @type {NaturalLanguageClassifierV1}
         */
        this.nlc = new watson.NaturalLanguageClassifierV1(nlcCreds);

        /**
         * Classifier ID
         * @type {string}
         */
        this.classifierId;
        this.setClassifierId(classifierId);

        /**
         * Cloudant NoSQL DB サービス
         * @type {Cloudant}
         */
        this.cloudant = new cloudant(cloudantCreds.url);

        /**
         * データベース名
         * @type {string}
         */
        this.dbName = dbName;

        /**
         * データベース
         * @type {object}
         */
        this.db = this.cloudant.db.use(dbName);
    }

    /**
     * Classifier Id をセットする。
     * Classifier Id が未設定の場合は Natural Language Classifier サービス内の最新の Classifier Id をセットする。
     * @param classifierId {string} Classifier Id
     */
    setClassifierId(classifierId) {
        if (classifierId) {
            this.classifierId = classifierId;
        } else {
            this.nlc.list({}, (err, value) => {
                if (err) {
                    console.log('error:', err);
                } else {
                    const classifiers = value.classifiers;
                    if (classifiers.length > 0) {
                        classifiers.sort((a, b) => {
                            if (a.created > b.created) {
                                return -1;
                            }
                            if (a.created < b.created) {
                                return 1;
                            }
                            return 0;
                        });
                        this.classifierId = classifiers[0].classifier_id;
                    }
                }
            });
        }
    }

    /**
     * アプリケーションの設定値を取得して、コールバックを実行する。
     * @param {function} callback コールバック
     */
    getAppSettings(callback) {
        this.db.get('app_settings', (err, doc) => {
            if (err) {
                console.log('error', err);
                callback({"name": "Q&A Chatbot"});
            } else {
                callback(doc);
            }
        });
    }

    /**
     * クラス名によりメッセージを取得する。
     * @param {string} text 質問
     * @param callback {function} コールバック
     */
    askClassName(text, callback) {
        getAnswer(this.db, text, 0, callback);
    }

    /**
     * テキスト分類で回答を作成して、コールバックする。
     * @param {string} text 質問
     * @param callback {function} コールバック
     * @see {@link https://github.com/watson-developer-cloud/node-sdk#natural-language-classifier}
     */
    ask(text, callback) {
        if (this.classifierId) {
            this.nlc.classify({
                "text": text,
                "classifier_id": this.classifierId
            }, (err, response) => {
                if (err) {
                    callback(gerErrorMessage(err));
                } else {
                    let topClass = response.classes[0];
                    getAnswer(this.db, topClass.class_name, topClass.confidence, callback);
                }
            });
        } else {
            console.log('error: classifier_id=%s', this.classifierId);
            callback({
                "class_name": "",
                "message": "Classifier ID が設定されていません。",
                "confidence": 0
            });
        }
    }

    /**
     * NLC の Classifier を作成する。
     * @param file {ReadStream} トレーニングファイル (CSV形式)
     * @param forceMode {boolean} true=Classifier を作成する, false=Classifierが一つ以上ある場合は作成しない
     */
    createClassifier(file, forceMode) {
        this.nlc.list({}, (err, response) => {
            if (err) {
                console.log('error:', err);
            } else {
                if (forceMode || response.classifiers.length <= 0) {
                    const params = {
                        "language": "ja",
                        "name": "classifier",
                        "training_data": file
                    };
                    this.nlc.create(params, (err, response) => {
                        if (err) {
                            console.log('error:', err);
                        } else {
                            console.log('NLC の Classifier を作成しました。(学習中)', response);
                        }
                    });
                }
            }

        });
    }

    /**
     * データベースを作成する。
     * @param callback
     */
    createDatabase(callback) {
        // データベースの存在をチェックする。
        this.cloudant.db.get(this.dbName, (err, body) => {
            if (err && err.error === 'not_found') {
                this.cloudant.db.create(this.dbName, (err) => {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log('データベース[%s]を作成しました。', this.dbName);
                        this.db = this.cloudant.db.use(this.dbName);
                        this.insertDesignDocument();
                        callback();
                    }
                });
            }
        });
    }

    /**
     * 設計文書を登録する。
     */
    insertDesignDocument() {
        const doc = {
            "_id": "_design/answers",
            "views": {
                "list": {
                    "map": "function (doc) {\n    if (doc._id !== 'app_settings') {\n        var row = {\n            \"_id\": doc._id,\n            \"_rev\": doc._rev,\n            \"message\": doc.message,\n            \"questions\": doc.questions\n        };\n        emit(doc._id, row);\n    }\n}"
                }
            }
        };
        this.db.insert(doc, (err) => {
            if (err) {
                console.log(err);
            } else {
                console.log('設計文書[%s]を登録しました。', doc._id);
                console.log(JSON.stringify(doc, undefined, 2));
            }
        });
    }

    /**
     * データを登録する。
     * @param data {object} データ
     */
    insertDocuments(data) {
        this.db.bulk(data, (err) => {
            if (err) {
                console.log(err);
            } else {
                console.log('文書を登録しました。');
                console.log(JSON.stringify(data, undefined, 2));
            }
        });
    }
}

module.exports = QaModel;

/**
 * 回答を作成して、コールバックする。
 * @param db {string} データベース
 * @param class_name {string} クラス名
 * @param confidence {number} 確度
 * @param callback {function} コールバック
 */
function getAnswer(db, class_name, confidence, callback) {
    db.get(class_name, (err, body) => {
        if (err) {
            callback(gerErrorMessage(err));
        } else {
            callback({
                "class_name": body._id,
                "message": body.message,
                "confidence": confidence
            });
        }
    });
}

/**
 * エラーの回答を返す。
 * @param err {object} エラー
 * @returns {{class_name: string, message: string, confidence: number}}
 */
function gerErrorMessage(err) {
    console.log('error:', err);
    return {
        "class_name": "",
        "message": "エラーが発生しました。 " + err.error + " (code=" + err.code + ")",
        "confidence": 0
    };
}
