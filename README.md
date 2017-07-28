# watson-nlc-qa

[![NPM](https://nodei.co/npm/watson-nlc-qa.png)](https://nodei.co/npm/watson-nlc-qa/)

[![Build Status](https://travis-ci.org/ippei0605/watson-nlc-qa.svg?branch=master)](https://travis-ci.org/ippei0605/watson-nlc-qa)
[![codecov](https://codecov.io/gh/ippei0605/watson-nlc-qa/branch/master/graph/badge.svg)](https://codecov.io/gh/ippei0605/watson-nlc-qa)

## はじめに
Q&A Chatbot を作成するためのモデルです。

### 使い方
```javascript
const QaModel = require('watson-nlc-qa');
const qa = new QaModel(cloudantCreds, 'answer', nlcCreds);
qa.ask('こんにちは', (answer) => {
    console.log('answer:', answer);
});
```

### システム要件
次のサービスを使用してください。
* IBM Bluemix
  - [Cloudant NoSQL DB](https://console.bluemix.net/catalog/services/cloudant-nosql-db?locale=ja)
  - [Watson Natural Language Classifier](https://console.bluemix.net/catalog/services/natural-language-classifier?locale=ja)

### インストール
```
$ npm install watson-nlc-qa
```

### 参考情報
* このモデルを使用した Q&A Chatbot をこちらに開発しました。
  - https://github.com/ippei0605/qa-chatbot

---

## APIs
* [QaModel(cloudantCreds, dbname, nlcCreds, [classifierid])](#qamodelcloudantcreds-dbname-nlccreds-classifierid)
* [ask(text, callback)](#asktext-callback)
* [askClassName(text, callback)](#askclassbametext-callback)
* [getAppSettings(callback)](#getappsettingscallback)
* [createDatabase([callback])](#createdatabasecallback)
* [insertDesignDocument([mapFunction], [callback])](#insertdesigndocumentmapfunction-callback)
* [insertDocuments(data, [callback])](#insertdocumentsdata-callback)
* [train(file, metadata, [mode], [callback])](#trainfile-metadata-mode-callback)
* [Tips](#tips)

---

## QaModel(cloudantCreds, dbname, nlcCreds, [classifierid])
Q&A モデルを生成します。
```javascript
const QaModel = require('watson-nlc-qa');
const qa = new QaModel(cloudantCreds, 'answer', nlcCreds);
```

|パラメータ     |必須  |型      |説明                                          |
| ------------ | --- | ------ | ------------------------------------------- |
|cloudantCreds |Yes  |object  |Cloudant NoSQL DB の接続情報                  |
|dbName        |Yes  |string  |データベース名                                |
|nlcCreds      |Yes  |object  |Natural Language Classifier のサービス資格情報 |
|classifierId  |No   |string  |Classifier ID。未設定または空文字の場合は使用可能な最新の Classifier を選択します。|

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
    
* nlcCreds {object} Natural Language Classifier のサービス資格情報

    ```json
    {
        "url": "{url}",
        "username": "{username}",
        "password": "{password}"
    }
    ```

[一覧に戻る](#apis)

---

## ask(text, callback)
テキスト分類で回答 answer を取得します。
```javascript
qa.ask('こんにちは', (answer) => {
    console.log(answer);
});
```

|パラメータ     |必須  |型       |説明                                                 |
| ------------ | --- | ------- | --------------------------------------------------- |
|text          |Yes  |string   |質問                                                 |
|callback      |Yes  |function |取得した回答 answer を引数にコールバックする。           |

* 回答 answer
```json
{
  "class_name": "{string} クラス名",
  "message": "{string} メッセージ",
  "confidence": "{number} 自信度"
}
```

[一覧に戻る](#apis)

---

## askClassName(text, callback)
クラス名により回答 answer を取得します。
```javascript
qa.askClassName('general_hello', (answer) => {
    console.log(answer);
});
```

|パラメータ     |必須  |型       |説明                                                 |
| ------------ | --- | ------- | --------------------------------------------------- |
|text          |Yes  |string   |クラス名                                              |
|callback      |Yes  |function |取得した回答 answer を引数にコールバックします。          |

[一覧に戻る](#apis)

---

## getAppSettings(callback)
アプリケーション設定 value を取得します。
```javascript
qa.getAppSettings((value) => {
    console.log(value);
});
```

|パラメータ     |必須  |型       |説明                                                          |
| ------------ | --- | ------- | ----------------------------------------------------------- |
|callback      |Yes  |function |取得したアプリケーション設定 value を引数にコールバックします。     |

* アプリケーション設定 value
```json
{
  "name": "名前"
}
```
> ID「app_settings」でデータベースに登録した文書をそのまま取得できます。

[一覧に戻る](#apis)

---

## createDatabase([callback])
データベースを作成します。
```javascript
qa.createDatabase((result)=>{
    console.log(result);
});
```

|パラメータ     |必須  |型       |説明                                                          |
| ------------ | --- | ------- | ----------------------------------------------------------- |
|callback      |No   |function |取得した結果 result を引数にコールバックします。                  |

[一覧に戻る](#apis)

---

## insertDesignDocument([mapFunction], [callback])
データベースに設計文書を登録します。
```javascript
qa.insertDesignDocument('', (result) => {
    console.log(result);
});
```

|パラメータ     |必須  |型       |説明                                                          |
| ------------ | --- | ------- | ----------------------------------------------------------- |
|mapFunction   |No   |string   |マップファンクション。未設定または空文字の場合はデフォルトのマップファンクションで設計文書を作成します。|
|callback      |No   |function |取得した結果 result を引数にコールバックします。                  |

* 設計文書

    ```json
    {
        "_id": "_design/answers",
        "views": {
            "list": {
                "map": "{マップファンクション}"
            }
        }
    }
    ```
    
* デフォルトのマップファンクション

    ```javascript
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
    ```

[一覧に戻る](#apis)

---

## insertDocuments(data, [callback])
データを登録します。
```javascript
qa.insertDocuments(data, (result) => {
    console.log(result);
});
```

|パラメータ     |必須  |型       |説明                                                          |
| ------------ | --- | ------- | ----------------------------------------------------------- |
|data          |Yes  |object   |データ                                                        |
|callback      |No   |function |取得した結果 result を引数にコールバックします。                  |


* データ

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

[一覧に戻る](#apis)

---

## train(file, metadata, [mode], [callback])
Classifier を作成します。

```javascript
const trainingFile = fs.createReadStream(__dirname + '/classifier.csv');
const metadata = {
    "language": "ja",
    "name": "My Classifier"
};

qa.train(trainingFile, metadata, false, (result) => {
    console.log('####', result);
});
```

|パラメータ     |必須  |型       |説明                                                          |
| ------------ | --- | ------- | ----------------------------------------------------------- |
|file          |Yes  |file     |トレーニング CSV ファイル                                       |
|metadata      |Yes  |object   |トレーニングメタデータ                                          |
|mode          |No   |boolean  |true: Classifier を作成します / false: Classifier が一つ以上ある場合は作成しません。|
|callback      |No   |function |取得した結果 result を引数にコールバックします。                  |

* トレーニング CSV ファイル

    ```
    "こんにちは。","general_hello"
    "間違っています。","general_sorry"
    "ありがとう。","general_thanks"
    "自己紹介して。","general_whoareyou"
    ```

* トレーニングメタデータ

    ```json
    {
        "language": "ja",
        "name": "{Classifier 名}"
    }
    ```

[一覧に戻る](#apis)

---

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

[一覧に戻る](#apis)

---