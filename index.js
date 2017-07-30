/**
 * Watson Natural Language Classifier Q&A Model
 * @module index
 * @author Ippei SUZUKI
 */

'use strict';

// モジュールを読込む。
const
    request = require('request'),
    Cloudant = require('cloudant');

// マップファンクション
const MAP_FUNCTION = `function (doc) {
    if (doc._id !== 'app_settings') {
        var row = {
            "_id": doc._id,
            "_rev": doc._rev,
            "message": doc.message,
            "questions": doc.questions,
            "option": doc.option
        };
        emit(doc._id, row);
    }
}`;

// 設計文書テンプレート
const DESIGN_DOC = {
    "_id": "_design/answers",
    "views": {
        "list": {
            "map": MAP_FUNCTION
        }
    }
};

// コールバックがあれば実行する。
const execCallback = (callback, value) => {
    if (callback && typeof(callback) === "function") {
        callback(value);
    }
};

// エラーの回答を返す。
const gerErrorMessage = (err) => {
    const code = err.code || err.statusCode;
    return {
        "class_name": "",
        "message": `エラーが発生しました。 ${err.error} (code=${code})`,
        "confidence": 0
    };
};

// 回答を取得する。
const getAnswer = (db, class_name, confidence, callback) => {
    db.get(class_name, (error, body) => {
        if (error) {
            callback(gerErrorMessage(error));
        } else {
            let answer = {
                "class_name": body._id,
                "message": body.message,
                "confidence": confidence
            };
            if (body.option) {
                answer.option = body.option;
            }
            callback(answer);
        }
    });
};

// NLC の Classifier 一覧を取得する。
const listClassifier = (nlcCreds, callback) => {
    const list = {
        "method": "GET",
        "url": `${nlcCreds.url}/v1/classifiers/`,
        "auth": {
            "username": nlcCreds.username,
            "password": nlcCreds.password,
        },
        "headers": {
            "Content-Type": "application/json"
        },
        "json": true,
    };
    request(list, (error, response, body) => {
        if (!error && 200 === response.statusCode) {
            callback(body.classifiers);
        } else {
            console.log('error:', body);
            callback([]);
        }
    });
};

// NLC の Classifier の情報を取得する。
const getClassifier = (nlcCreds, classifierId, callback) => {
    const get = {
        "method": "GET",
        "url": `${nlcCreds.url}/v1/classifiers/${classifierId}`,
        "auth": {
            "username": nlcCreds.username,
            "password": nlcCreds.password,
        },
        "headers": {
            "Content-Type": "application/json"
        },
        "json": true,
    };
    request(get, (error, response, body) => {
        if (!error && 200 === response.statusCode) {
            callback(body);
        } else {
            console.log('error:', error);
            callback({});
        }
    });
};

// NLC の Classifier を作成する。
const createClassifier = (nlcCreds, csvFile, metadata, callback) => {
    const create = {
        "method": "POST",
        "url": `${nlcCreds.url}/v1/classifiers`,
        "auth": {
            "username": nlcCreds.username,
            "password": nlcCreds.password,
        },
        "headers": {
            "Content-Type": "application/json"
        },
        "json": true,
        "formData": {
            "training_data": csvFile,
            "training_metadata": JSON.stringify(metadata)
        }
    };
    request(create, (error, response, body) => {
        if (!error && 200 === response.statusCode) {
            console.log('NLC の Classifier を作成しました。(学習中)', body);
        } else {
            console.log('error:', body);
        }
        callback(body);
    });
};

// NLC の classify を実行する。
const classify = (nlcCreds, classifierId, db, text, callback) => {
    if (classifierId) {
        const classify = {
            "method": "POST",
            "url": `${nlcCreds.url}/v1/classifiers/${classifierId}/classify`,
            "auth": {
                "username": nlcCreds.username,
                "password": nlcCreds.password,
            },
            "headers": {
                "Content-Type": "application/json"
            },
            "json": true,
            "body": {
                "text": text
            }
        };
        request(classify, (error, response, body) => {
            if (!error && 200 === response.statusCode) {
                const topClass = body.classes[0];
                getAnswer(db, topClass.class_name, topClass.confidence, callback);
            } else {
                console.log('error:', body);
                callback(gerErrorMessage(body));
            }
        });
    } else {
        callback({
            "class_name": "",
            "message": "Classifier が設定されてません。",
            "confidence": 0
        });
    }
};

// NLC の Classifier のステータス一覧を取得する。
const getStatusClassifiers = (nlcCreds, src, dst, callback) => {
    const num = dst.length;
    if (!src || num === src.length) {
        callback(dst);
    } else {
        getClassifier(nlcCreds, src[num].classifier_id, (classifier) => {
            dst.push(classifier);
            getStatusClassifiers(nlcCreds, src, dst, callback);
        });
    }
};

// 使用可能な最新の Claccifier ID を取得する。(取得できない場合は空文字)
const getLatestClassifierId = (nlcCreds, callback) => {
    let latestClassifierId = '';
    listClassifier(nlcCreds, (classifiers) => {
        if (classifiers.length !== 0) {
            getStatusClassifiers(nlcCreds, classifiers, [], (statusClassifiers) => {
                if (statusClassifiers.length > 0) {
                    // ステータス一覧を作成日の新しい順にソートする。
                    statusClassifiers.sort((a, b) => {
                        if (a.created > b.created) {
                            return -1;
                        }
                        if (a.created < b.created) {
                            return 1;
                        }
                        return 0;
                    });
                    // 使用可能なClassifier を探す。
                    for (const target of statusClassifiers) {
                        if ('Available' === target.status && target.classifier_id) {
                            latestClassifierId = target.classifier_id;
                            break;
                        }
                    }
                    callback(latestClassifierId);
                } else {
                    callback(latestClassifierId);
                }
            });
        } else {
            callback(latestClassifierId);
        }
    });
};

class QaModel {
    /**
     * コンストラクター
     * @classdesc Q&A モデル
     * @param cloudantCreds {object} Cloudant NoSQL DB サービス資格情報
     * @param dbName {string} データベース名
     * @param nlcCreds {object} Watson Natural Language Classifier サービス資格情報
     * @param classifierId {string} Classifier ID (任意)
     */
    constructor(cloudantCreds, dbName, nlcCreds, classifierId) {
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

        /**
         * Watson Natural Language Classifier サービス資格情報
         * @type {Object}
         */
        this.nlcCreds = nlcCreds;

        if (classifierId) {
            /**
             * NLC の Classifier ID
             * @type {string}
             */
            this.classifierId = classifierId;
        } else {
            getLatestClassifierId(nlcCreds, (latestClassifierId) => {
                this.classifierId = latestClassifierId;
            });
        }
    }

    /**
     * 回答
     * @typedef {object} Answer
     * @property {string} class_name クラス名
     * @property {string} message メッセージ
     * @property {number} confidence 自信度
     */

    /**
     * アプリケーション設定
     * @typedef {object} AppSettings
     * @property {string} name 名前
     */

    /**
     * アプリケーション設定でコールバックする。
     * @callback appSettingsCallback
     * @param {AppSettings} value アプリケーション設定
     * @property {string} name 名前
     */

    /**
     * アプリケーション設定を取得する。
     * @param {appSettingsCallback} callback コールバック
     */
    getAppSettings(callback) {
        this.db.get('app_settings', (error, value) => {
            if (error) {
                console.log('error', error);
                callback({"name": "Q&A Chatbot"});
            } else {
                callback(value);
            }
        });
    }

    /**
     * 回答でコールバックする。
     * @callback answerCallback
     * @param value {Answer} 回答
     */

    /**
     * クラス分類により回答を取得する。
     * @param text {string} 質問
     * @param callback {answerCallback} コールバック
     */
    ask(text, callback) {
        if (this.classifierId) {
            classify(this.nlcCreds, this.classifierId, this.db, text, callback);
        } else {
            getLatestClassifierId(this.nlcCreds, (latestClassifierId) => {
                this.classifierId = latestClassifierId;
                classify(this.nlcCreds, this.classifierId, this.db, text, callback);
            });
        }
    }

    /**
     * クラス名により回答を取得する。
     * @param text {string} クラス名
     * @param callback {answerCallback} コールバック
     */
    askClassName(text, callback) {
        getAnswer(this.db, text, 0, callback);
    }

    /**
     * テキスト分類により回答を取得する。
     * @param text {string} 質問
     * @param callback {answerCallback} callback コールバック
     * @see {@link https://github.com/watson-developer-cloud/node-sdk#natural-language-classifier}
     */

    /**
     * Classifier の作成結果でコールバックする。
     * @callback createClassifierCallback
     * @param value {object} Classifier の作成結果 (エラー時は {})
     */

    /**
     * Natural Language Classifier の Classifier を作成する。
     * @param file {object} トレーニングファイル (CSV形式)
     * @param metadata {object} トレーニングのメタデータ
     * @param mode {boolean} true=Classifier を作成する, false=Classifierが一つ以上ある場合は作成しない
     * @param callback {createClassifierCallback} コールバック (任意)
     */
    train(file, metadata, mode, callback) {
        listClassifier(this.nlcCreds, (classifiers) => {
            if (mode || classifiers.length <= 0) {
                createClassifier(this.nlcCreds, file, metadata, (body) => {
                    execCallback(callback, body);
                });
            } else {
                console.log('Classifier は既に存在しているため作成しません。');
                execCallback(callback, classifiers);
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
        this.cloudant.db.get(this.dbName, (error, body) => {
            if (error && error.error === 'not_found') {
                this.cloudant.db.create(this.dbName, (error, body) => {
                    if (error) {
                        console.log(error);
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
     * 設計文書を登録する。マップファンクションが未設定の場合はデフォルトのマップファンクションで登録する。
     * @param mapFunction {string} マップファンクション (任意)
     * @param callback {cloudantCallback} コールバック (任意)
     * @see {@link https://github.com/cloudant-labs/cloudant-nano#dbinsertdoc-params-callback}
     */
    insertDesignDocument(mapFunction, callback) {
        if (mapFunction) {
            DESIGN_DOC.views.list.map = mapFunction;
        }
        this.db.insert(DESIGN_DOC, (error, body) => {
            if (error) {
                console.log(error);
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
        this.db.bulk(data, (error, body) => {
            if (error) {
                console.log(error);
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

module.exports = QaModel;
