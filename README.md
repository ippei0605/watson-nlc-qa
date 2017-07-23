# watson-nlc-qa
[![Build Status](https://travis-ci.org/ippei0605/watson-nlc-qa.svg?branch=master)](https://travis-ci.org/ippei0605/watson-nlc-qa)
[![NPM version](https://badge.fury.io/js/watson-nlc-qa.svg)](http://badge.fury.io/js/watson-nlc-qa)

## はじめに
Q&A Chatbot を作成するためのモデルです。
* このモデルを使用して作成した Q&A Chatbot はこちらです。
  - https://github.com/ippei0605/qa-chatbot

## システム要件
次のサービスを使用してください。
* IBM Bluemix
  - [Cloudant NoSQL DB](https://console.bluemix.net/catalog/services/cloudant-nosql-db?locale=ja)
  - [Watson Natural Language Classifier](https://console.bluemix.net/catalog/services/natural-language-classifier?locale=ja)

## インストール
```
$ npm install watson-nlc-qa
```

## API リファレンス
### QaModel(nlcCreds, classifierId, cloudantCreds, dbName)
Q&A モデルを生成します。
```javascript
const QaModel = require('watson-nlc-qa');

const qa = new QaModel(nlcCreds, '', cloudantCreds, 'answer');
```
* nlcCreds {object} Natural Language Classifier の接続情報

    ```json
    {
        "url": "{url}",
        "username": "{username}",
        "password": "{password}"
    }
    ```
* classifierId {string} Classifier ID、空文字の場合は最新の Classifier を選択します。
* cloudantCreds {object} Cloudant NoSQL DB の接続情報

    ```json
    {
        "username": "{username}",
        "password": "{password}",
        "host": "{host}",
        "port": 443,
        "url": "{url}"
    }
    ```
* dbName {string} データベース名

### qa.setClassifierId(classifierId)
メンバーに Classifier ID をセットします。
```javascript
setClassifierId('359f3fx202-nlc-203641');
```
* classifierId {string} Classifier ID

### qa.getAppSettings(callback)
アプリケーションの設定値を取得します。
```javascript
qa.getAppSettings((value) => {
    console.log(value);
});
```
* callback {function} コールバック

### qa.askClassName(text, callback)
クラス名により回答を取得します。
```javascript
qa.askClassName('general_hello', (value) => {
    console.log(value);
});
```
* callback {function} コールバック
* value {object} 回答

```json
{
    "class_name": "general_hello",
    "message": "こんにちは。私はワトソンです。",
    "confidence": 0
}
```

### ask(text, callback)
テキスト分類で回答を取得します。
```javascript
qa.ask('こんにちは', (value) => {
    console.log(value);
});
```
* callback {function} コールバック
* value {object} 回答 (上記)

### qa.createClassifier(file, mode, [callback])
Classifier を作成します。

```javascript
qa.createClassifier(fs.createReadStream(__dirname + '/' + TRAINING_FILENAME));
```
* file {object} ファイルストリーム
* mode {boolean} モード
  - true: Classifier を作成する
  - false: Classifierが一つ以上ある場合は作成しない
* callback {function} コールバック

### qa.createDatabase([callback])
データベースを作成します。
```javascript
qa.createDatabase((result)=>{
    console.log(result);
});
```
* callback {function} コールバック

### qa.insertDesignDocument(mapFunction, [callback])
データベースに設計文書を登録します。
```javascript
qa.insertDesignDocument('', (result) => {
    console.log(result);
});
```
* callback {function} コールバック

* デフォルトの設計文書
    ```json
    {
        "_id": "_design/answers",
        "views": {
            "list": {
                "map": "{デフォルトのマップファンクション}"
            }
        }
    }
    ```

* デフォルトのマップファンクション
    ```javascript
    function (doc) {
        if (doc._id !== 'app_settings') {
            var row = {
                "_id": doc._id,
                "_rev": doc._rev,
                "message": doc.message,
                "questions": doc.questions
            };
            emit(doc._id, row);
        }
    }
    ```

### qa.insertDocuments(data, [callback])
データを登録します。
```javascript
qa.insertDocuments(data, (result) => {
    console.log(result);
});
```
* data {object} データ

    ```json
    {
      "docs": [
        {
          "_id": "app_settings",
          "name": "Watson Diet Trainer"
        },
        {
          "_id": "general_hello",
          "message": "こんにちは。私はワトソンです。",
          "questions": [
            "こんばんは。",
            "はじめまして。",
            "はじめまして。こんにちは。 ",
            "こんにちは。",
            "よろしくお願いします。",
            "おはようございます。"
          ]
        }
      ]
    }
    ```

* callback {function} コールバック

## Tips
### データの初期登録
データベース作成、設計文書登録、データ登録は個別にも実行できますが、次のようにすることでデータベース作成後に設計文書登録とデータ登録を実行できます。

```javascript
// データベースを作成する。
qa.createDatabase(() => {
    // 設計文書を作成する。
    qa.insertDesignDocument();

    // データを登録する。
    const data = fs.readFileSync(__dirname + '/' + CONTENT_FILENAME).toString();
    qa.insertDocuments(JSON.parse(data));
});
```
