# watson-nlc-qa
[![Build Status](https://travis-ci.org/ippei0605/watson-nlc-qa.svg?branch=master)](https://travis-ci.org/ippei0605/watson-nlc-qa)
[![NPM version](https://badge.fury.io/js/watson-nlc-qa.svg)](http://badge.fury.io/js/watson-nlc-qa)

## はじめに

## インストール
```
$ npm install watson-nlc-qa
```

```javascript

const qa = new QaModel(nlcCreds, '', cloudantCreds, 'answer');
```

nlcCreds
```json
{
    "url": "{url}",
    "username": "{username}",
    "password": "{password}"
}
```

cloudantCreds

```json
{
    "username": "{username}",
    "password": "{password}",
    "host", "{host}",
    "port", 443,
    "url": "{url}"
}
```


##
