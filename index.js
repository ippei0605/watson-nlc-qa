/**
 * Watson Natural Language Classifier Q&A Model
 * @module index
 * @author Ippei SUZUKI
 */

'use strict';

// モジュールを読込む。
const
    Cloudant = require('cloudant'),
    Nlc = require('watson-developer-cloud/natural-language-classifier/v1');

// 設計文書テンプレート
const DESIGN_DOC = {
    "_id": "_design/answers",
    "views": {
        "list": {
            "map": "function (doc) {\n    if (doc._id !== 'app_settings') {\n        var row = {\n            \"_id\": doc._id,\n            \"_rev\": doc._rev,\n            \"message\": doc.message,\n            \"questions\": doc.questions\n        };\n        emit(doc._id, row);\n    }\n}"
        }
    }
};

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
        this.nlc = new Nlc(nlcCreds);

        this.setClassifierId(classifierId);

        /**
         * Cloudant NoSQL DB サービス
         * @type {Cloudant}
         */
        this.cloudant = new Cloudant(cloudantCreds.url);

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
            /**
             * Classifier ID
             * @type {string}
             */
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
     * 回答
     * @typedef {object} Answer
     * @property {string} class_name クラス名
     * @property {string} message メッセージ
     * @property {number} confidence 確度
     */

    /**
     * アプリケーションの設定値でコールバックする。
     * @callback appSettingsCallback
     * @param {object} value アプリケーションの設定値
     * @property {string} name 名前
     */

    /**
     * アプリケーションの設定値を取得する。
     * @param callback {appSettingsCallback} コールバック
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
     * クラス名により回答を取得する。
     * @param {string} text 質問
     * @param {answerCallback} callback コールバック
     */
    askClassName(text, callback) {
        getAnswer(this.db, text, 0, callback);
    }

    /**
     * 回答でコールバックする。
     * @callback answerCallback
     * @param value {Answer} 回答
     */

    /**
     * テキスト分類により回答を取得する。
     * @param text {string} 質問
     * @param callback {answerCallback} callback コールバック
     * @see {@link https://github.com/watson-developer-cloud/node-sdk#natural-language-classifier}
     */
    ask(text, callback) {
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
    }

    /**
     * Classifier の作成結果でコールバックする。
     * @callback createClassifierCallback
     * @param value {object} Classifier の作成結果 (エラー時は {})
     */

    /**
     * Natural Language Classifier の Classifier を作成する。
     * @param file {object} トレーニングファイル (CSV形式)
     * @param mode {boolean} true=Classifier を作成する, false=Classifierが一つ以上ある場合は作成しない
     * @param callback {createClassifierCallback} コールバック (任意)
     */
    createClassifier(file, mode, callback) {
        this.nlc.list({}, (err, response) => {
            if (err) {
                console.log('error:', err);
                execCallback(callback, {});
            } else {
                if (mode || response.classifiers.length <= 0) {
                    const params = {
                        "language": "ja",
                        "name": "classifier",
                        "training_data": file
                    };
                    this.nlc.create(params, (err, response) => {
                        if (err) {
                            console.log('error:', err);
                            execCallback(callback, {});
                        } else {
                            console.log('NLC の Classifier を作成しました。(学習中)', response);
                            execCallback(callback, response);
                        }
                    });
                } else {
                    console.log('Classifier は既に存在しているため作成しません。');
                    execCallback(callback, response);
                }
            }
        });
    }

    /**
     * Cloudant NoSQL DB の操作結果でコールバックする。
     * @callback cloudantCallback
     * @param value {object} Cloudant NoSQL DB の操作結果 (エラー時は {})
     */

    /**
     * データベースを作成する。
     * @param callback {cloudantCallback} コールバック (任意)
     * @see {@link https://github.com/cloudant-labs/cloudant-nano#nanodbgetname-callback}
     * @see {@link https://github.com/cloudant-labs/cloudant-nano#nanodbcreatename-callback}
     */
    createDatabase(callback) {
        // データベースの存在をチェックする。
        this.cloudant.db.get(this.dbName, (err, body) => {
            if (err && err.error === 'not_found') {
                this.cloudant.db.create(this.dbName, (err, body) => {
                    if (err) {
                        console.log(err);
                        execCallback(callback, {});
                    } else {
                        console.log('データベース[%s]を作成しました。', this.dbName);
                        this.db = this.cloudant.db.use(this.dbName);
                        if (callback && typeof(callback) === "function") {
                            execCallback(callback, body);
                        }
                    }
                });
            } else {
                console.log('データベース[%s]は既に存在しています。', this.dbName);
                execCallback(callback, body);
            }
        });
    }

    /**
     * 設計文書を登録する。
     * @param callback {cloudantCallback} コールバック (任意)
     * @see {@link https://github.com/cloudant-labs/cloudant-nano#dbinsertdoc-params-callback}
     */
    insertDesignDocument(mapFunction, callback) {
        if (mapFunction) {
            DESIGN_DOC.views.list.map = mapFunction;
        }
        this.db.insert(DESIGN_DOC, (err, body) => {
            if (err) {
                console.log(err);
                execCallback(callback, {});
            } else {
                console.log('設計文書[%s]を登録しました。', DESIGN_DOC._id);
                console.log('----------');
                console.log(JSON.stringify(DESIGN_DOC, undefined, 2));
                console.log('----------');
                execCallback(callback, body);
            }
        });
    }

    /**
     * データを登録する。
     * @param data {object} データ
     * @param callback {cloudantCallback} コールバック(任意)
     * @see {@link https://github.com/cloudant-labs/cloudant-nano#dbbulkdocs-params-callback}
     */
    insertDocuments(data, callback) {
        this.db.bulk(data, (err, body) => {
            if (err) {
                console.log(err);
                execCallback(callback, {});
            } else {
                console.log('文書を登録しました。');
                console.log('----------');
                console.log(JSON.stringify(data, undefined, 2));
                console.log('----------');
                execCallback(callback, body);
            }
        });
    }
}

module
    .exports = QaModel;

/**
 * 回答を取得する。
 * @param db {string} データベース
 * @param class_name {string} クラス名
 * @param confidence {number} 確度
 * @param callback {answerCallback} コールバック
 */
function

getAnswer(db, class_name, confidence, callback) {
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
 * @return {Answer} 回答
 */
function

gerErrorMessage(err) {
    console.log('error:', err);
    const code = err.code || err.statusCode;
    return {
        "class_name": "",
        "message": "エラーが発生しました。 " + err.error + " (code=" + code + ")",
        "confidence": 0
    };
}

/**
 * 引数でコールバックする。
 * @callback callback
 * @param value {object} 引数
 */

/**
 * コールバックをチェックして実行する。
 * @param callback {callback} コールバック
 * @param value {object} コールバックの引数
 */
function

execCallback(callback, value) {
    if (callback && typeof(callback) === "function") {
        callback(value);
    }
}

