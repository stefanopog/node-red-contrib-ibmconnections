/*
Copyright IBM All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

//
//  Utility to transfor an Array to an OBJECT
//  Used in previous versions
//
/*
const arrayToObject = (array, keyField) =>
array.reduce((obj, item) => {
  obj[item[keyField]] = item.value;
  return obj;
}, {});
*/
const xml2js = require("xml2js");
const crypto = require("crypto");
const __fs = require('fs')
const __isDebug = __getDebugFlag();
const __moduleName = 'IC_common';

//const betweenQuotes = /((?<![\\])['"])((?:.(?!(?<![\\])\1))*.?)\1/;
//const parExp = /(\w+)\s*=\s*(["'])((?:(?!\2).)*)\2[\s*,\s*]?/g; 
//const parExp = /(\w+)\s*=\s*(((["'])((?:(?!\4).)*)\4)|([-+]?[0-9]*\.?[0-9]+))[\s*,\s*]?/g; // Modified for numbers
const parExp = /([\w\.]+)\s*=\s*(((["'])((?:(?!\4).)*)\4)|(@dt)\('([\dTtZz\+-:]+)'\)|([-+]?[0-9]*\.?[0-9]+))[\s,]?/g; // Modified for Numbers and Dates
const dateISO = /@dt\('([\+-]?\d{4}(?!\d{2}\b))(?:(-?)(?:(0[1-9]|1[0-2])(?:\2([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))(?:[T\s](?:(?:([01]\d|2[0-3])(?:(:?)([0-5]\d))?|24\:?00)([\.,]\d+(?!:))?)?(?:\10([0-5]\d)([\.,]\d+)?)?([zZ]|([\+-](?:[01]\d|2[0-3])):?([0-5]\d)?)?)?)?'\)/;

//
//  Wrapper around ICDebug environment variable
//
function __getDebugFlag() {
    var dbg = process.env.ICDebug;
    if (typeof dbg === "string") {
        if (dbg.toLowerCase() === "false") {
            return false;
        } else {
            if (dbg.toLowerCase() === "true") {
                return true;
            } else {
                return false;
            }
        }
    } else {
        return dbg || false;
    }
}
//
//  Understand X-LCONN-RUNAS clause
//
function __getLConnRunAs() {
    var LConnRunAs = process.env.IC_LCONN_RUN_AS;
    var delegationMapping = {};
    if (typeof LConnRunAs === "string") {
        let tmp = LConnRunAs.split(':');
        if (tmp.length === 2) {
            delegationMapping.nodeId = tmp[0];
            delegationMapping.userId = tmp[1];
            return delegationMapping;
        }
    }
    return null;
}
//
//  Promise-based wrapper fro XML Parser
//
function __getXmlAttribute (xml, options) {    // __getXmlAttribute(entry, {explicitArray: false});
    return new Promise(function (resolve, reject) {
        const parser = new xml2js.Parser(options);
        parser.parseString(xml, function(err, result) {
        if (err) return reject(err);    // rejects the promise with `err` as the reason
        resolve(result);                // fulfills the promise with `result` as the value
      })
    })
}
//
//  Promise-based wrapper fro FS package 
//
function __readFile(path, opts = 'utf8') {
    return new Promise(function (resolve, reject) {
        __fs.readFile(path, opts, function(err, data) {
            if (err) return reject(err);
            resolve(data)
        })
    })
}
function __writeFile(path, dataopts = 'utf8') {
    return new Promise(function (resolve, reject) {
        __fs.writeFile(path, dataopts, function(err) {
            if (err) return reject(err);
            resolve()
        })
    })
}
//
//  function to use mcode from email
//
function __emailToMCode(email) {
    let mcode;
    if (email) {
      const hash = crypto.createHash('sha256');
      hash.update(email, 'utf-8');
      mcode = hash.digest('hex').substring(0, 32);
    }
    return mcode;
}

//
//  Get Connections Images (Profile, Community etc)
//
async function __getBase64ImageFromUrl(imageUrl) {
    const rp = require("request-promise-native");
    var _include_headers = function(body, response, resolveWithFullResponse) {
        return {'headers': response.headers, 'data': body};
      };
      
    var options = {
        method: 'GET',
        uri: imageUrl,
        transform: _include_headers,
        encoding: null    // https://stackoverflow.com/questions/31289826/download-an-image-using-node-request-and-fs-promisified-with-no-pipe-in-node-j
    };
    try {
        const res = await rp(options);

        var buf = Buffer.from(res.data);
        var base64 = 'data:' + res.headers['content-type'] + ';base64,' + buf.toString('base64')
        //console.log(JSON.stringify(res.headers, ' ', 2));
        //console.log(base64);
        return base64;
    } catch (error) {
        return Promise.reject(error);
    }
}
//
//  Common Logging function
//
function __log(moduleName, isDebug, logMsg) {
    if (isDebug) {
        console.log(moduleName + " => " + logMsg);
    }
}
//
//  Common logging function with JSON Objects
//
function __logJson(moduleName, isDebug, logMsg, jsonObj, isConfig=false) {
    if (isDebug) {
        if (isConfig) {
            console.log(moduleName + " => " + (logMsg ? logMsg : ""));
            console.log('hostName : ' + jsonObj.hostName);
            console.log(JSON.stringify(jsonObj.connection, " ", 2));
        } else {
            console.log(moduleName + " => " + (logMsg ? logMsg : ""));
            console.log(JSON.stringify(jsonObj, " ", 2));
        }
    }
}

function __logError(moduleName, theString, config, error, theMsg, theNode) {
    var errString = moduleName + ' : ' + theString;
    console.log(errString);
    theNode.status({fill: "red", shape: "dot", text: theString});
    if (config) console.log(JSON.stringify(config, ' ', 2));
    if (error) {
        console.log(moduleName + ' : Error Follows : ');
        console.log(JSON.stringify(error, ' ', 2));
        theMsg.ICX_fatal = JSON.parse(JSON.stringify(error));
        theNode.error(error, theMsg);
    } else {
        if (config) {
            theMsg.ICX_fatal = {
                message: errString,
                details: config};
        } else {
            theMsg.ICX_fatal = {
                message: errString
            };
            theNode.error(errString, theMsg);
        }
    }
}
function __logError2(moduleName, theString, config, error, theMsg, theNode) {
    var errString = moduleName + ' : ' + theString;
    console.log(errString);
    if (config) console.log(JSON.stringify(config, ' ', 2));
    if (error) {
        console.log(moduleName + ' : Error Follows : ');
        console.log(JSON.stringify(error, ' ', 2));
        theMsg.ICX_fatal = JSON.parse(JSON.stringify(error));
        theNode.error(error, theMsg);
    } else {
        if (config) {
            theMsg.ICX_fatal = {
                message: errString,
                details: config};
        } else {
            theMsg.ICX_fatal = {
                message: errString
            };
            theNode.error(errString, theMsg);
        }
    }
}

function __logWarning(moduleName, theString, theNode) {
    var warnString = moduleName + ' : ' + theString;
    __log(moduleName, __isDebug, warnString);
    theNode.status({fill: "yellow", shape: "dot", text: warnString});
    if (__isDebug) theNode.warn(warnString);
}

function __getInfoFromError(theError, theString) {
    const zzzz = /{{([^}}\n]*)}}\n/g;
    var yyyy = theError.message.match(zzzz);
    if (yyyy && (yyyy.length > 0)) {
        for (let k=0; k < yyyy.length; k++) {
            yyyy[k] = yyyy[k].replace('{{', '').replace('}}\n', '');
        }
        return yyyy.join(' | ');
    } else {
        return theString;
    }
}

function __getOptionValue(moduleName, theLimits, theOption, fromConfig, fromMsg, theNode) {
    //
    //  This function retrieves a NUMERIC value which can be provided
    //  - either by the Configuration Panel
    //  - or by an input msg. attribute
    //
    //  The value from the COnfiguration Panel takes precedence over the input msg. attribute
    //
    //  If no value is provided, an WARNING is generated
    //
    //  The value is returned in an object (named array) which can either be created by this function or taken as an input parameter
    //
    var value = 0;
    if ((fromConfig.trim() === '') && ((fromMsg === undefined) || (fromMsg.trim() === ''))) {
        __logWarning(moduleName, theOption + ' set to default', theNode);
    } else {
        if (fromConfig !== '') {
            value = fromConfig;
        } else {
            value = fromMsg;
        }
        if (Number(value) && Number.isInteger(Number(value)) && (value > 0)) {
            //
            //  This is an OK value
            //
            if (!theLimits) theLimits = {};
            theLimits[theOption] = value;
        } else {
            //
            //  Not numeric, or not integer or negative integer
            //
            __logWarning(moduleName, theOption + ' set to default', theNode);
        }
    }
    return theLimits;
}

function __getMandatoryInputStringFromSelect(moduleName, fromConfig, fromMsg, label, values, theMsg, theNode) {
    //
    //  This function gets the final value of an input which could be provided by :
    //  - either the Configuration Panel
    //  - or by an input msg. attribute
    //
    //  The Configuration Panel can provide the user the choice among the values stored in the "values" input paramter of this function
    //  with the addition of the "fromMsg" value.
    //  In case the Configuration Panel is set to be "fromMsg", then the value is taken from the input msg. attribute
    //
    //  In case the final value is not in the input "values" parameter array, a NULL value is returned
    //
    var theValue = null;
    if ((fromConfig.trim() === '') && (!fromMsg || (fromMsg.trim() === ''))) {
        __logError(moduleName, "Missing " + label + " string", null, null, theMsg, theNode);
    } else {
        if (fromConfig.trim() !== '') {
            if (fromConfig === 'fromMsg') {
                if (!fromMsg || (fromMsg.trim() === '')) {
                    __logError(moduleName, "Missing " + label + " string", null, null, theMsg, theNode);
                    return;
                } else {
                    theValue = fromMsg.trim();
                }
            } else {
                theValue = fromConfig.trim();
            }
        } else {
            theValue = fromMsg.trim();
        }
        if (!values.includes(theValue)) {
            __logError(moduleName, "Invalid " + label + " string : " + theValue, null, null, theMsg, theNode);
            theValue = null;
        }
    }
    return theValue;
}

function __getMandatoryInputString(moduleName, fromConfig, fromMsg, onlyFromMsg, label, theMsg, theNode) {
    //
    //  This function retrieves a value which can be provided
    //  - either by the Configuration Panel
    //  - or by an input msg. attribute
    //
    //  The value from the COnfiguration Panel takes precedence over the input msg. attribute
    //
    //  IF onlyFromMsg==="fromMsg", then any value from the ConfigurationPanel will NOT be taken in account (())
    //
    //  If no value is provided, an ERROR is generated and a NULL Value is returned
    //
    var theValue = null;
    if (onlyFromMsg === 'fromMsg') {
        if ((fromMsg === undefined) || ((typeof fromMsg) !== 'string') || (fromMsg.trim() === '')) {
            __logError(moduleName, "Missing " + label + " string", null, null, theMsg, theNode);
        } else {
            theValue = fromMsg.trim();
        }
    } else {
        if ((fromConfig.trim() === '') && ((fromMsg === undefined) || ((typeof fromMsg) !== 'string') || (fromMsg.trim() === ''))) {
            __logError(moduleName, "Missing " + label + " string", null, null, theMsg, theNode);
        } else {
            if (fromConfig.trim() !== '') {
                theValue = fromConfig.trim();
            } else {
                theValue = fromMsg.trim();
            }
        }
    }
    return theValue;
}

function __getMandatoryInputArray(moduleName, fromConfig, fromMsg, onlyFromMsg, label, theMsg, theNode) {
    //
    //  This function retrieves a value which can be provided
    //  - either by the Configuration Panel
    //  - or by an input msg. attribute
    //
    //  The value from the COnfiguration Panel takes precedence over the input msg. attribute
    //
    //  IF onlyFromMsg==="fromMsg", then any value from the ConfigurationPanel will NOT be taken in account (())
    //
    //  If no value is provided, an ERROR is generated and a NULL Value is returned
    //
    var theValue = null;
    if (onlyFromMsg === 'fromMsg') {
        if ((fromMsg === undefined) || (fromMsg === null) || !Array.isArray(fromMsg)) {
            __logError(moduleName, "Missing " + label + " Array", null, null, theMsg, theNode);
        } else {
            theValue = fromMsg;
        }
    } else {
        if ((fromConfig.trim() === '') && ((fromMsg === undefined) || (fromMsg === null) || !Array.isArray(fromMsg))) {
            __logError(moduleName, "Missing " + label + " String or Array", null, null, theMsg, theNode);
        } else {
            if (fromConfig.trim() !== '') {
                theValue = fromConfig.trim();
            } else {
                theValue = fromMsg;
            }
        }
    }
    return theValue;
}

function __getOptionalInputString(moduleName, fromConfig, fromMsg, label, theNode) {
    //
    //  This function retrieves a value which can be provided
    //  - either by the Configuration Panel
    //  - or by an input msg. attribute
    //
    //  The value from the COnfiguration Panel takes precedence over the input msg. attribute
    //
    //  If no value is provided, a WARNING is generated and an empty string is returned
    //
    var theValue = '';
    if ((fromConfig.trim() === '') && ((fromMsg === undefined) || ((typeof fromMsg) !== 'string') || (fromMsg.trim() === ''))) {
        __logWarning(moduleName, "Missing Optional " + label + " string", theNode);
    } else {
        if (fromConfig.trim() !== '') {
            theValue = fromConfig.trim();
        } else {
            theValue = fromMsg.trim();
        }
    }
    return theValue;
}
//
//  If the input is an Array of objects, where each object has a "name" and a "value" attributes, it transforms it 
//  in an object where each "name" becomes a first class attribute (with its associated value)
//
function __getItemValuesFromMsg(theInput) {
    if (theInput) {
        if (Array.isArray(theInput)) {
            //
            //  Old-Style Array
            //  We need to convert into an Object
            //
            let tmpObj = {};
            for (let i=0; i < theInput.length; i++) {
                if (theInput[i].name && theInput[i].value) {
                    tmpObj[theInput[i].name] = theInput[i].value;
                }
            }
             return tmpObj;
        } else {
            return theInput;
        }
    } else {
        return theInput;
    }
}
function __getNameValueObject(inputString) {
    //
    //  This function takes a comma-separated input string containing the following types of pairs:
    //      String pairs    :   name = "theString"    or   name = 'theString'
    //      Numerica pairs  :   name = 123  or name = 123.45   (no quotes nor double quotes)
    //      Date pairs      :   name = dt('ISO FORMATTED DATE STRING')    (using single quotes)
    //  Equal sign can be surrounded by 0 or more white spaces (before and after)
    //
    //  Thanks to :
    //      - https://stackoverflow.com/questions/17007616/regular-expression-to-match-key-value-pairs-where-value-is-in-quotes-or-apostrop
    //        for the RegEx matching string pairs
    //      - https://stackoverflow.com/questions/21686539/regular-expression-for-full-iso-8601-date-syntax
    //        for the RegEx matching an ISO Date
    //
    //  I use https://regexr.com/ to test my Regular expressions
    //
    var m;
    var outObject = {};
    while ((m = parExp.exec(inputString))) {
        let name = '';
        name = m[1];
        if (m[3] === undefined) {
            if (m[6] === undefined) {
                //
                //  It is a number. We need to convert it
                //
                outObject[name] = Number(m[2]);
            } else {
                //
                //  Potentially a Date ?
                //
                if (m[6] === '@dt') {
                    //
                    //  It is a Date
                    //
                    if (dateISO.test(m[2])) {
                        //
                        //  Valid Date
                        //
                        outObject[name] = {type: "datetime", data : m[7]};
                    } else {
                        console.log('__getNameValueArray : NOT A VALID ISO DATE : ' + m[2]);
                    }
                }
            }
        } else {
            //
            //  It is a string
            //
            outObject[name] = m[5];
        }
    }
    return outObject;
}
function __getNameValueArray(inputString) {
    //
    //  This function takes a comma-separated input string containing the following types of pairs:
    //      String pairs    :   name = "theString"    or   name = 'theString'
    //      Numerica pairs  :   name = 123  or name = 123.45   (no quotes nor double quotes)
    //      Date pairs      :   name = dt('ISO FORMATTED DATE STRING')    (using single quotes)
    //  Equal sign can be surrounded by 0 or more white spaces (before and after)
    //
    //  Thanks to :
    //      - https://stackoverflow.com/questions/17007616/regular-expression-to-match-key-value-pairs-where-value-is-in-quotes-or-apostrop
    //        for the RegEx matching string pairs
    //      - https://stackoverflow.com/questions/21686539/regular-expression-for-full-iso-8601-date-syntax
    //        for the RegEx matching an ISO Date
    //
    //  I use https://regexr.com/ to test my Regular expressions
    //
    var m;
    var outArray = [];
    while ((m = parExp.exec(inputString))) {
        let obj = {};
        obj.name = m[1];
        if (m[3] === undefined) {
            if (m[6] === undefined) {
                //
                //  It is a number. We need to convert it
                //
                obj.value = Number(m[2]);
            } else {
                //
                //  Potentially a Date ?
                //
                if (m[6] === '@dt') {
                    //
                    //  It is a Date
                    //
                    if (dateISO.test(m[2])) {
                        //
                        //  Valid Date
                        //
                        obj.value = {type: "datetime", data : m[7]};
                    } else {
                        console.log('__getNameValueArray : NOT A VALID ISO DATE : ' + m[2]);
                    }
                }
            }
        } else {
            //
            //  It is a string
            //
            obj.value = m[5];
        }
        outArray.push(obj);
    }
    return outArray;
}

module.exports = {__log, 
                  __logJson, 
                  __logError, 
                  __logError2, 
                  __logWarning, 
                  __getInfoFromError,
                  __getOptionValue, 
                  __getMandatoryInputStringFromSelect, 
                  __getMandatoryInputString, 
                  __getMandatoryInputArray,
                  __getOptionalInputString,
                  __getNameValueObject,
                  __getNameValueArray,
                  __getItemValuesFromMsg,
                  __getXmlAttribute,
                  __readFile,
                  __writeFile,
                  __emailToMCode,
                  __getDebugFlag,
                  __getLConnRunAs,
                  __getBase64ImageFromUrl};
