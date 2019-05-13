/*
Copyright IBM All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

module.exports = function(RED) {
    "use strict";
    const ICX = require('./common.js');
    const __isDebug = ICX.__getDebugFlag();
    //const __delegation = ICX.__getLConnRunAs();
    const __moduleName = 'IC_Login2';
    const __X_LCONN_RUNAS = "X_CONN_RUNAS";
  
    console.log("*****************************************");
    console.log("* Debug mode is " + (__isDebug ? "enabled" : "disabled") + ' for module ' + __moduleName);
    console.log("*****************************************");

    const fs = require("fs");
    const request = require("request");
    const request2 = require("request");
    const rpn = require("request-promise-native");
    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;
    const xml2js = require("xml2js");
    const crypto = require("crypto");
    //const parser = new xml2js.Parser();
    //const builder  = new xml2js.Builder({rootName: "content"});

    //
    //  Managing storage for OAUTH credentials (on BlueMix)
    //
    function _ICLogin2_oauthCloudantDB() {
        var Cloudant = require("cloudant");
        var cloudant = Cloudant({vcapServices: JSON.parse(process.env.VCAP_SERVICES)});
        return cloudant.use("oauth_cred");
    }
    //
    //  Managing storage for OAUTH credentials (not on BlueMix)
    //
    function _ICLogin2_oauthFileName(nodeId) {
        return './' + nodeId + '_cred.json';
    }
    //
    //  Managing DELEGATION
    //
    function __getLConnRunAs(theContext, nodeId) {
        if (typeof theContext === "string") {
            let tmp = theContext.split(':');
            if (tmp.length === 2) {
                if (tmp[0] === nodeId) {
                    return tmp[1];
                } else {
                    return '';
                }
            } else {
                return '';
            }
        } else {
            return ''
        }
    }
    //
    //  Debugging functions
    //
    function _ICLogin2_dumpCallback(err, result, data) {
        ICX.__logJson(__moduleName, __isDebug, '_ICLogin2_dumpCallback: == ERR ==', err);
        ICX.__logJson(__moduleName, __isDebug, '_ICLogin2_dumpCallback: == RESULT ==', result);
        ICX.__logJson(__moduleName, __isDebug, '_ICLogin2_dumpCallback: == DATA ==', data);
    }
    //
    //  Debugging Function
    //
    function _ICLogin2_dumpCred(credentials, header) {
        if (__isDebug) {
            console.log('******** ' + header + ' ************** ');
            console.log('Client Id : ' + credentials.oauthId);
            console.log('Client Secret : ' + credentials.oauthSecret);
            console.log('Access Token : ' + credentials.accessToken);
            console.log('Refresh Token : ' + credentials.refreshToken);
            console.log('Token Type : ' + credentials.tokenType);
            console.log('Expires In : ' + credentials.expiresIn);
            const xyz = new Date(credentials.expireTime).toUTCString();
            console.log('Expire Time : ' + xyz);
            console.log('last refresh : ' + credentials.refreshTime);
            console.log('*********************************************');
        }
    }
    //
    //  Get the OAuth Authorization URL (as a function of the serverType)
    //
    function _ICLogin2_getAuthURL(serverType, server, clientId, callback) {
        var authURL = server;
        if (serverType === "cloud") {
            authURL += '/manage/oauth2/authorize?response_type=code&client_id=' + clientId;
            authURL += '&callback_uri=' + callback;
        } else {
            authURL += '/oauth2/endpoint/connectionsProvider/authorize?response_type=code&client_id=' + clientId;
            authURL += '&callback_uri=' + callback;
            authURL += '&scope=' + server + '/connections/oauth/apps';
            authURL += '&access_type=offline';
            authURL += '&approval_prompt=force';
        }
        return authURL;
    }
    //
    //  Get the OAuth Authorization URL (as a function of the serverType)
    //
    function _ICLogin2_getTokenURL(serverType, server) {
        var tokenURL = server;
        if (serverType === "cloud") {
            tokenURL += '/manage/oauth2/token';
        } else {
            tokenURL += '/oauth2/endpoint/connectionsProvider/token';
        }
        return tokenURL;
    }
    //
    //  Get results in JSON Array format
    //
    function _ICLogin2_getArrayCreds(serverType, data) {
        if (serverType === "cloud") {
            var aa = data.split("&");
            var creds = {};
            aa.forEach(function(value, index) {
                var bb = value.split("=");
                creds[bb[0]] = bb[1];
            });
            return creds;
        } else {
            //
            //  On Premises a JSON string is returned already
            //
            return JSON.parse(data);
        }
    }
    //
    //  Recursive Function to parse a Profiles feed
    //
    function __getUserDetail(inputArray, inputClass, inputObject) {
        for (let i=0; i < inputArray.length; i++) {
            //
            //  Parsing current level
            //
            let currentClass = '';
            if (inputArray[i].className) {
                //
                //  There is a new Attributes. 
                //
                currentClass = inputArray[i].className;
                //
                //  Is it a leaf or a node ?
                //                       
                if (inputArray[i].children && (inputArray[i].children.length > 0)) {
                    //
                    //  It is a node
                    //
                    if (inputObject[currentClass]) {
                        //
                        //  Another object with that name exists. 
                        //  So it is an array
                        //
                        if (Array.isArray(inputObject[currentClass])) {
                            //
                            //  Already an Array..
                            //
                        } else {
                            //
                            //  Not yet an Array. Create one
                            let tmp = inputObject[currentClass];
                            inputObject[currentClass] = [];
                            inputObject[currentClass].push(tmp);
                        }
                        let newObject = {};
                        inputObject[currentClass].push(newObject);
                        __getUserDetail(inputArray[i].children, inputClass + '.' + currentClass, newObject);
                    } else {
                        //
                        //  No existing object.
                        //  Create one
                        //
                        inputObject[currentClass] = {};
                        __getUserDetail(inputArray[i].children, inputClass + '.' + currentClass, inputObject[currentClass]);
                    }
                } else {
                    //
                    //  Leaf
                    //
                    inputObject[currentClass] = inputArray[i].innerHTML;
                }
            } else {
                //
                //  No className, so no new attribute
                //
                if (inputArray[i].children && (inputArray[i].children.length > 0)) {
                    //
                    //  It is a node
                    //
                    __getUserDetail(inputArray[i].children, inputClass, inputObject);
                } else {
                    //
                    //  Leaf
                    //  Nothing to do 
                    //
                    //console.log('=================================');
                    //console.log('===== Nothing to do =============');
                    //console.log(inputArray[i].innerHTML);
                    //console.log('=================================');
                }
            }
        }
    }
    //
    //  get full Connections server URL
    //
    function _ICLogin2_getServer(serverType, cloudServer, server){
        var endSlash  = new RegExp("/" + "+$");
        var fmtServer = "";
        //
        //	Retrieving Configuration from LOGIN node
        //
        if (serverType === "cloud") {
            if (cloudServer === "europe") {
                fmtServer = "https://apps.ce.collabserv.com";
            } else {
                fmtServer = "https://apps.na.collabserv.com";
            }
        } else {
            fmtServer   = server;
            //
            //	Remove trailing "slash" in case it is there
            //
            fmtServer   = fmtServer.replace(endSlash, "");
        }
        return fmtServer;
    }
    //
    //  Get the Connections context root
    //
    function _ICLogin2_getContext(server, serverType) {
        var context = '';
        //
        //  Deal with specific W3-Connections
        //
        if ((server.toLowerCase().indexOf("w3-connections") != -1) && (serverType !== "cloud")) {
            context = "/common";
        } else {
            context = "/connections";
        }
        return context;
    }
    //
    //  Redefine the process for Refreshing the OAuth 2.0 Token
    //
    ICLogin2.prototype.refreshToken = function(cb) {
        var credentials = this.credentials;
        var node = this;

        //
        //  Service function. It is a callback that needs to be
        //  invoked in two places
        //
        function _cb1(err, data) {
            if (err) {
                node.error('ICLogin/_cb1: Error Reading Credentials from storage');
                console.log('ICLogin/_cb1: Error Reading Credentials from storage');
                console.log(err);
                return;
            }
            //
            //  Refreshing the token
            //
            console.log('ICLogin/_cb1: Refreshing using refresh token : ' + data.refreshToken);
            var tokenURL =  _ICLogin2_getTokenURL(node.serverType, node.getServer);
            request.post({
                url: tokenURL,
                json: true,
                form: {
                    grant_type: 'refresh_token',
                    client_id: data.oauthId,
                    client_secret: data.oauthSecret,
                    refresh_token: data.refreshToken
                },
            }, function(err, result, data) {
                if (err) {
                    node.error(RED._("ic.error.token-request-error",{err:err}));
                    return;
                }
                if (data.error) {
                    console.log(data.error);
                    node.error(RED._("ic.error.refresh-token-error",{message:data.error}));
                    return;
                }
                var creds = _ICLogin2_getArrayCreds(node.serverType, data);
                //
                //  Build and Save the correct credentials
                //
                node.credentials.accessToken = creds.access_token;
                node.credentials.refreshToken = creds.refresh_token;
                node.credentials.expiresIn = creds.expires_in;
                node.credentials.expireTime =
                    parseInt(node.credentials.expiresIn) + (new Date().getTime());
                node.credentials.refreshTime = new Date().toUTCString();
                node.credentials.tokenType = creds.token_type;
                //
                //  Committing Credentials to Node-RED Credentials Store
                //
                RED.nodes.addCredentials(node.id, node.credentials);
                _ICLogin2_dumpCred(node.credentials, 'After Refresh');
                //
                //  Bbypass the issue of NodeRed with Deploy
                //
                var isBM = process.env.VCAP_SERVICES;
                console.log('ICLogin/_cb1 : isBM = ', isBM);
                if (!isBM) {
                    //
                    //  NOT on BlueMix
                    //
                    var outFile = _ICLogin2_oauthFileName(node.id);
                    console.log('ICLogin/_cb1 : Refreshing file record ' + outFile);
                    fs.writeFile(outFile,
                                 JSON.stringify(node.credentials, null, 2),
                                 function(err1, data1) {
                                   if (err1) {
                                        node.error('ICLogin/_cb1: Error Writing Credentials to storage');
                                        console.log('ICLogin/_cb1: Error Writing Credentials to storage');
                                        console.log(err);
                                    } else {
                                        if (typeof cb !== undefined) {
                                            cb();
                                        }
                                    }
                    });
                } else {
                    //
                    //  on Bluemix
                    //  Update the Cloudant record
                    //
                    var credDB = _ICLogin2_oauthCloudantDB();
                    var newRec = {
                            credentials : node.credentials,
                            _id : node.id,
                            _rev : data._rev};
                    credDB.insert(newRec, function(err1, body, header) {
                       if (err1) {
                            node.error('ICLogin/_cb1: Error Writing Credentials to storage');
                            console.log('ICLogin/_cb1: Error Writing Credentials to storage');
                            console.log(err1);
                            console.log(newRec);
                        } else {
                            if (typeof cb !== undefined) {
                                cb();
                            }
                        }
                    });
                }
            });
        }

        //
        //  Start Processing
        //
        console.log("ICLogin/refreshToken: refreshing token: " + credentials.refreshToken);
        if (!credentials.refreshToken) {
            // TODO: add a timeout to make sure we make a request
            // every so often (if no flows trigger one) to ensure the
            // refresh token does not expire
            node.error(RED._("ic.error.no-refresh-token"));
            return cb(RED._("ic.error.no-refresh-token"));
        }
        //
        //  read RefreshToekn from the temporary storage to bypass the issue of
        //  credentials being saved ONLY on deploy
        //
        _ICLogin2_dumpCred(credentials, 'During Refresh');
        var isBM = process.env.VCAP_SERVICES;
        console.log('ICLogin/refreshToken : isBM = ', isBM);
        if (!isBM) {
            //
            //  NOT on BlueMix
            //
            var outFile = _ICLogin2_oauthFileName(node.id);
            console.log('ICLogin/refreshToken: Reading Credentials from storage ' + outFile);
            var infos = fs.readFileSync(outFile);
            var infosJ = JSON.parse(infos.toString('utf8'));
            _cb1(null, infosJ);
        } else {
            //
            //  on BlueMix
            //
            var credDB = _ICLogin2_oauthCloudantDB();
            credDB.get(node.id, _cb1);
        }
    };
    //
    //  Redefine the way in which a Connections server is accessed
    //  In this way the Basci auth or OAuth auth are isolated
    //  as well as the possible need to refresh the OAuth token
    //
    ICLogin2.prototype.request = function(req, retries, cb) {
        var node = this;
        if (typeof retries === 'function') {
            cb = retries;
            retries = 1;
        }
        if (typeof req !== 'object') {
            req = { url: req };
        }
        //
        //  Setting HTTP Method
        //
        req.method = req.method || 'GET';
        //
        //  Setting Headers
        //
        if (req.headers) {
            req.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0";
        } else {
            req.headers = {"User-Agent" : "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0"};
        }
        //
        //  Delegation
        //        
        if (node.serverType === 'cloud') {
            if ((req.method === 'PUT') || (req.method === "POST")) {
                //
                //  Check if we need to apply DELEGATION from FLOW CONTEXT
                //
                let flowContext = node.context().flow;
                if (flowContext) {
                    let runAsCtx = flowContext.get(__X_LCONN_RUNAS);
                    if (runAsCtx) {
                        let delegationId = __getLConnRunAs(runAsCtx, node.id);
                        if (delegationId !== '') {
                            //
                            //  Adding Delegation
                            //
                            req.headers['X-LCONN-RUNAS'] = delegationId;
                            ICX.__log(__moduleName, __isDebug, 'Adding X_LCONN_RUNAS delegation to userId ' + delegationId);
                        }
                    }
                } else {
                    //
                    //  Check if we need to apply DELEGATION from FLOW CONTEXT
                    //
                    let globalContext = node.context().global;
                    let runAsCtx = globalContext.get(__X_LCONN_RUNAS);
                    if (runAsCtx) {
                        let delegationId = __getLConnRunAs(runAsCtx, node.id);
                        if (delegationId !== '') {
                            //
                            //  Adding Delegation
                            //
                            req.headers['X-LCONN-RUNAS'] = delegationId;
                            ICX.__log(__moduleName, __isDebug, 'Adding X_LCONN_RUNAS delegation to userId ' + delegationId);
                        }
                    }
                }
            }
        }
        //
        //  Dumping the Input Parameters
        //  We do BEFORE setting the Authorization in order to avoid writing Passwords or Secrets
        //
        ICX.__logJson(__moduleName, __isDebug, 'Request : Performing HTTP using the following parameters', req);
        //
        //  Check which authorization
        //
        if (node.authType === 'oauth') {
            //
            // always set access token to the latest ignoring any already present
            //
            req.auth = {bearer: node.credentials.accessToken};
        } else {
            req.auth = {user: node.credentials.username, password: node.credentials.password};
        }
        //
        //  Performing the request
        //
        return request(req, function(err, result, data) {
            if (err) {
                // handled in callback
                console.log('ICLogin/request : REQUEST WITH error ... Invoking callback');
                console.log(JSON.stringify(err, ' ', 2));
                return cb(err, result, data);
            }
            if (result.statusCode === 401 && retries > 0) {
                //
                //  SP+
                //
                console.log('***** Getting a 401 ******** ');
                //
                //  SP-
                //
                retries--;
                node.warn(RED._("ic.warn.refresh-401"));
                node.refreshToken(function (err) {
                    if (err) {
                        return cb(err, null, null);
                    }
                    console.log('ICLogin/request : after TokenRefresh - invoking the request');
                    return node.request(req, retries, cb);
                });
            } else if (result.statusCode >= 400) {
                console.log('ICLogin/request : REQUEST WITH status > 400... Invoking callback');
                return cb(result.statusCode + ": " + data.message, result, data);
            } else {
                console.log('ICLogin/request : REQUEST WITH status ' + result.statusCode + '... Invoking callback');
                return cb(err, result, data);
            }
        });
    };
    //
    //  Async/Await version of the request prototype
    //
    ICLogin2.prototype.rpn = function (req, retries) {
        var node = this;
        return new Promise(async function (resolve, reject) {
            if (typeof retries === 'undefined') {
                retries = 1;
            }
            if (typeof req !== 'object') {
                req = { url: req };
            }
            //
            //  Setting HTTP Method
            //
            req.method = req.method || 'GET';
            //
            //  Setting Headers
            //
            if (req.headers) {
                req.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0";
            } else {
                req.headers = {"User-Agent" : "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0"};
            }
            //
            //  Delegation
            //        
            if (node.serverType === 'cloud') {
                if ((req.method === 'PUT') || (req.method === "POST")) {
                    //
                    //  Check if we need to apply DELEGATION from FLOW CONTEXT
                    //
                    let flowContext = node.context().flow;
                    if (flowContext) {
                        let runAsCtx = flowContext.get(__X_LCONN_RUNAS);
                        if (runAsCtx) {
                            let delegationId = __getLConnRunAs(runAsCtx, node.id);
                            if (delegationId !== '') {
                                //
                                //  Adding Delegation
                                //
                                req.headers['X-LCONN-RUNAS'] = delegationId;
                                ICX.__log(__moduleName, __isDebug, 'Adding X_LCONN_RUNAS delegation to userId ' + delegationId);
                            }
                        }
                    } else {
                        //
                        //  Check if we need to apply DELEGATION from FLOW CONTEXT
                        //
                        let globalContext = node.context().global;
                        let runAsCtx = globalContext.get(__X_LCONN_RUNAS);
                        if (runAsCtx) {
                            let delegationId = __getLConnRunAs(runAsCtx, node.id);
                            if (delegationId !== '') {
                                //
                                //  Adding Delegation
                                //
                                req.headers['X-LCONN-RUNAS'] = delegationId;
                                ICX.__log(__moduleName, __isDebug, 'Adding X_LCONN_RUNAS delegation to userId ' + delegationId);
                            }
                        }
                    }
                }
            }
            //
            //  Dumping the Input Parameters
            //  We do BEFORE setting the Authorization in order to avoid writing Passwords or Secrets
            //
            ICX.__logJson(__moduleName, __isDebug, 'RPN : Performing HTTP using the following parameters', req);
            //
            //  Check which authorization
            //
            if (node.authType === 'oauth') {
                //
                // always set access token to the latest ignoring any already present
                //
                req.auth = {bearer: node.credentials.accessToken};
            } else {
                req.auth = {user: node.credentials.username, password: node.credentials.password};
            }
            //
            //  Performing the request
            //
            try {
                let response = await rpn(req);
                ICX.__logJson(__moduleName, __isDebug, 'RPN : Request was succesfull', response);
                resolve(response);
            } catch (err) {
                let errors = require('request-promise-native/errors');
                ICX.__logJson(__moduleName, __isDebug, 'RPN : Request WITH ERROR', err);
                //console.log(err instanceof errors.StatusCodeError);
                return reject(err);
            }
        });
    }
    ICLogin2.prototype.getUserLinkroll = async function(theName, theKey) {
        //
        //  Get the LINKS associated to the Profile
        //
        var __msgText = 'getUserLinkroll: error getting Linkroll for ' + theName;
        var __msgStatus = 'error getting Linkroll';
        ICX.__log(__moduleName, true, 'getUserLinkroll: getting Profile Links for ' + theName);
        try {
            let linksURL = this.getServer + "/profiles";
            if (this.authType === "oauth") linksURL += '/oauth';
            linksURL += '/atom/profileExtension.do?key=' + theKey + '&extensionId=profileLinks';
            let response2 = await this.rpn(
                {
                    url: linksURL,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            if (response2 !== '') {
                ICX.__logJson(__moduleName, __isDebug, "getUserLinkroll: Linkroll OK", response2);
                //
                //  Parse Linkrool
                //
                __msgText = 'Parser error in getUserInfos Linkroll!';
                __msgStatus = 'Linkroll Parser Error';
                ICX.__log(__moduleName, true, 'getUserLinkroll: Parsing XML Linkroll Feed for ' + theName);
                let result2 = await ICX.__getXmlAttribute(response2);
                if (result2.linkroll.link) {
                    let links = [];
                    for (let i=0; i < result2.linkroll.link.length; i++) {
                        let theLink = {};
                        theLink.name = result2.linkroll.link[i]["$"].name;
                        theLink.url = result2.linkroll.link[i]["$"].url;
                        links.push(theLink);
                    }
                    return links;
                } else {
                    ICX.__log(__moduleName, __isDebug, "getUserLinkroll: No Links found in Linkroll");
                    return null;
                }
            } else {
                ICX.__log(__moduleName, __isDebug, "getUserLinkroll: No Links found in Linkroll");
                return null;
            }
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "getUserLinkroll: " + __msgText, error);
            throw error;
        }
    }
    ICLogin2.prototype.getUserInfosFromMail = async function (mailAddress, adminOutput=false, withLinkroll=false, withPhoto=false, withAudio=false) {
        var __msgText = 'getUserInfosFromMail: error getting profile for ' + mailAddress;
        var __msgStatus = 'error getting profile';
        ICX.__log(__moduleName, true, 'getUserInfosFromMail: convert ' + mailAddress + ' to ID');
        //
        //  Build the URL
        //
        var myURL = this.getServer + "/profiles";
        if (this.authType === "oauth") myURL += '/oauth';
        if (this.serverType === "cloud") {
            if (adminOutput) {
 //               myURL += "/admin/atom/profileEntry.do?email=" + mailAddress;
                myURL += "/admin/atom/profileEntry.do?mcode=" + ICX.__emailToMCode(mailAddress);
            } else {
                myURL += "/atom/search.do?search=" + mailAddress + '&format=full&output=hcard&labels=true';
            }
        } else {
            if (adminOutput) {
//                myURL += "/admin/atom/profileEntry.do?email=" + mailAddress;
                myURL += "/admin/atom/profileEntry.do?mcode=" + ICX.__emailToMCode(mailAddress);
            } else {
                myURL += "/atom/profile.do?email=" + mailAddress + '&format=full&output=hcard&labels=true';
            }
        }
        try {
            //
            //  Get the Profile Entry
            //
            let userDetails = await this.getUserInfos(myURL, mailAddress, adminOutput, withLinkroll, withPhoto, withAudio);
            return userDetails;
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "getUserInfosFromMail : " + __msgText, error);
            throw error;
        }
    }
    ICLogin2.prototype.getUserInfosFromId = async function (userId, adminOutput=false, withLinkroll=false, withPhoto=false, withAudio=false) {
        var __msgText = 'getUserInfosFromId: error getting profile for ' + userId;
        var __msgStatus = 'error getting profile';
        //
        //  Build the URL
        //
        ICX.__log(__moduleName, true, 'getUserInfosFromId: convert ' + userId + ' to Mail');
        var myURL = this.getServer + "/profiles";
        if (this.authType === "oauth") myURL += '/oauth';
        if (adminOutput) {
            myURL += "/admin/atom/profileEntry.do?userid=" + userId;
        } else {
            myURL += "/atom/profile.do?userid=" + userId + '&format=full&output=hcard&labels=true';
        }
        try {
            //
            //  Get the Profile Entry
            //
            let userDetails = await this.getUserInfos(myURL, userId, adminOutput, withLinkroll, withPhoto, withAudio);
            return userDetails;
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "getUserInfosFromId : " + __msgText, error);
            throw error;
        }
    }
    ICLogin2.prototype.getUserInfosNormalAPI = async function(myURL, theUser, withLinkroll=false, withPhoto=false, withAudio=false) {
        var __msgText = 'getUserInfosNormalAPI: error getting profile for ' + theUser;
        var __msgStatus = 'error getting profile';
        try {
            //
            //  Get the Profile Entries. We get a Feed with 0, 1 or many entries
            //
            let response = await this.rpn(
                {
                    url: myURL,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "getUserInfosNormalAPI OK", response);
            //
            //  Parse using JSDOM
            //
            __msgText = 'getUserInfosNormalAPI: Parser error in for ' + theUser;
            __msgStatus = 'Parser Error';
            let theFeed = new JSDOM(response, {contentType: 'application/xml'});
            let entries = theFeed.window.document.querySelectorAll("entry");
            let theResult = [];
            //
            //  Parse through Array
            //
            for (let i=0; i < entries.length; i++) {
                let attributes = entries[i].querySelectorAll(".vcard > div");
                let userDetailObject = {};
                userDetailObject.allAttributes = {};
                __getUserDetail(attributes, '', userDetailObject.allAttributes);
                if (userDetailObject.allAttributes['photo'] !== undefined) {
                    userDetailObject.allAttributes['photo'] = theFeed.window.document.querySelector(".photo").src;
                }
                if (userDetailObject.allAttributes['fn url'] !== undefined ) {
                    userDetailObject.allAttributes['fn url'] = theFeed.window.document.querySelector(".fn.url").href;
                }
                if (userDetailObject.allAttributes['sound url'] !== undefined ) {
                    userDetailObject.allAttributes['sound url'] = theFeed.window.document.querySelector(".sound.url").href;
                }
                //
                //  Links (from ENTRY)
                //
                let links2 = entries[i].querySelectorAll("link");
                userDetailObject.links = {};
                for (let j=0; j < links2.length; j++) {
                    let tmp = {};
                    tmp.href = links2[j].getAttribute('href');
                    tmp.type = links2[j].getAttribute('type');
                    let rel = links2[j].getAttribute('rel').replace('http://www.ibm.com/xmlns/prod/sn/', '');
                    if (userDetailObject.links[rel]) {
                        if (Array.isArray(userDetailObject.links[rel])) {
                            //
                            //  Already an Array
                            //
                            userDetailObject.links[rel].push(tmp);
                        } else {
                            //
                            //  Not yet an array. Transform it
                            //  
                            let oldTmp = userDetailObject.links[rel];
                            userDetailObject.links[rel] = [];
                            userDetailObject.links[rel].push(oldTmp);
                            userDetailObject.links[rel].push(tmp);
                        }
                    } else {
                        userDetailObject.links[rel] = tmp;
                    }
                }
                //
                //  Backward Compatibility
                //
                userDetailObject.userid = userDetailObject.allAttributes.uid;
                userDetailObject.mail = userDetailObject.allAttributes.email;
                userDetailObject.title = userDetailObject.allAttributes.title;
                userDetailObject.photo = userDetailObject.allAttributes.photo;
                userDetailObject.pronounciation = userDetailObject.allAttributes['sound url'];
                userDetailObject.key = userDetailObject.allAttributes['x-profile-key'],
                userDetailObject.name = userDetailObject.allAttributes.n['given-name'] + ' ' + userDetailObject.allAttributes.n['family-name'];
                //
                //  Tags
                //
                if (userDetailObject.allAttributes.categories) {
                    userDetailObject.tags = userDetailObject.allAttributes.categories.split(',');
                    for (let j=0; j < userDetailObject.tags.length; j++) {
                        userDetailObject.tags[j] = userDetailObject.tags[j].trim();
                    }
                } else {
                    userDetailObject.tags = [];
                }
                ICX.__logJson(__moduleName, __isDebug, 'getUserInfosNormalAPI: JSDOM Parsed user object', userDetailObject);
                //
                //  Check for other details about the user
                //
                if (withLinkroll) {
                    userDetailObject.linkroll = await this.getUserLinkroll(userDetailObject.name, userDetailObject.key);
                }
                if (withPhoto) {
                    //
                    //  Get the Profile Photo
                    //
                    __msgText = 'getUserInfosNormalAPI: error getting Profile Photo for ' + userDetailObject.name;
                    __msgStatus = 'error getting Profile Photo';
                    ICX.__log(__moduleName, true, 'getUserInfosNormalAPI: getting Profile Photo for ' + userDetailObject.name);
                    userDetailObject.photoBytes = await this.rpn(
                        {
                            url: userDetailObject.photo,
                            method: "GET",
                            headers: {"Content-Type": "image/*"},
                            encoding: 'binary'
                        }                    
                    );
                }
                if (withAudio) {
                    //
                    //  Get the Profile Photo
                    //
                    __msgText = 'getUserInfosNormalAPI: error getting Profile Audio for ' + userDetailObject.name;
                    __msgStatus = 'error getting Profile Audio';
                    ICX.__log(__moduleName, true, 'getUserInfosNormalAPI: getting Profile Audio for ' + userDetailObject.name);
                    userDetailObject.pronounciation = await this.rpn(
                        {
                            url: userDetailObject.pronounciation,
                            method: "GET",
                            headers: {"Content-Type": "audio/*"},
                            encoding: 'binary'
                        }                    
                    );
                }
                theResult.push(userDetailObject);
            }
            if ((theUser === 'TAGS') || (theUser === 'KEYWORDS') || (theUser === 'SEARCH')) {
                ICX.__logJson(__moduleName, __isDebug, 'Person Details for ' + theUser, theResult);
                return theResult;
            } else {
                //
                //  Only one user expected
                //
                if (entries.length > 0) {
                    //
                    //  Complete the Links (from FEED)
                    //
                    let links1 = theFeed.window.document.querySelectorAll("feed > link");
                    for (let j=0; j < links1.length; j++) {
                        let tmp = {};
                        tmp.href = links1[j].getAttribute('href');
                        tmp.type = links1[j].getAttribute('type');
                        let rel = links1[j].getAttribute('rel').replace('http://www.ibm.com/xmlns/prod/sn/', '');
                        //if (rel === 'ext-attr') tmp.attribute = links1[j].getAttribute('snx:extensionId');
                        if (theResult[0].links[rel]) {
                            if (rel === 'ext-attr') {
                                //
                                //  Extended Attribute
                                //
                                theResult[0].links[rel][links1[j].getAttribute('snx:extensionId')] = tmp;
                            } else {
                                //
                                //  Not an extended attribute
                                //
                                if (Array.isArray(theResult[0].links[rel])) {
                                    //
                                    //  Already an Array
                                    //
                                    theResult[0].links[rel].push(tmp);
                                } else {
                                    //
                                    //  Not yet an array. Transform it
                                    //  
                                    let oldTmp = theResult[0].links[rel];
                                    theResult[0].links[rel] = [];
                                    theResult[0].links[rel].push(oldTmp);
                                    theResult[0].links[rel].push(tmp);
                                }
                            }
                        } else {
                            if (rel === 'ext-attr') {
                                theResult[0].links[rel] = {};
                                theResult[0].links[rel][links1[j].getAttribute('snx:extensionId')] = tmp;
                            } else {
                                theResult[0].links[rel] = tmp;
                            }
                        }
                    }
                    ICX.__logJson(__moduleName, __isDebug, 'Person Details for ' + theUser, theResult[0]);
                    return theResult[0];
                } else {
                    ICX.__log(__moduleName, __isDebug, 'NO information found for Person  ' + theUser);
                    return null;
                }
            }
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "getUserInfosNormalAPI: " + __msgText, error);
            throw error;
        }
    }
    ICLogin2.prototype.getUserInfosAdminAPI = async function(myURL, theUser, withLinkroll=false, withPhoto=false, withAudio=false) {
        var __msgText = 'getUserInfosAdminAPI: error getting profile for ' + theUser;
        var __msgStatus = 'error getting profile';
        try {
            //
            //  Get the Profile Entry. Here we GET 0 or 1 Entries, NOT A FEED !
            //
            let response = await this.rpn(
                {
                    url: myURL,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "getUserInfosAdminAPI OK", response);
            //
            //  Parse using JSDOM
            //
            __msgText = 'getUserInfosAdminlAPI: Parser error in for ' + theUser;
            __msgStatus = 'Parser Error';
            let theFeed = new JSDOM(response, {contentType: 'application/xml'});
            let entries = theFeed.window.document.querySelectorAll("entry");
            if (entries && (entries.length > 0)) {
                //
                //  We found the entry
                //
                let theEntry = entries[0];
                let userDetailObject = {};
                let attributes = theEntry.querySelectorAll("content > person")[0].firstChild.querySelectorAll("entry");
                userDetailObject.allAttributes = {};
                for (let j=0; j < attributes.length; j++) {
                    let key = attributes[j].querySelectorAll('key')[0].innerHTML;
                    let theData = attributes[j].querySelectorAll('value > data');
                    userDetailObject.allAttributes[key]= theData[0].innerHTML;
                }
                //
                //  Links
                //
                let links = theEntry.querySelectorAll("link");
                userDetailObject.links = {};
                for (let j=0; j < links.length; j++) {
                    let tmp = {};
                    tmp.href = links[j].getAttribute('href');
                    tmp.type = links[j].getAttribute('type');
                    let rel = links[j].getAttribute('rel').replace('http://www.ibm.com/xmlns/prod/sn/', '');
                    if (userDetailObject.links[rel]) {
                        if (Array.isArray(userDetailObject.links[rel])) {
                            //
                            //  Already an Array
                            //
                            userDetailObject.links[rel].push(tmp);
                        } else {
                            //
                            //  Not yet an array. Transform it
                            //  
                            let oldTmp = userDetailObject.links[rel];
                            userDetailObject.links[rel] = [];
                            userDetailObject.links[rel].push(oldTmp);
                            userDetailObject.links[rel].push(tmp);
                        }
                    } else {
                        userDetailObject.links[rel] = tmp;
                    }
                }
                //
                //  Tags
                //
                let tags = theFeed.window.document.querySelectorAll("entry > category");
                userDetailObject.tags = [];
                for (let j=0; j < tags.length; j++) {
                    if (tags[j].getAttribute('snx:type') && (tags[j].getAttribute('snx:type') === 'general')) {
                        //
                        //  It is a TAG
                        //
                        userDetailObject.tags.push(tags[j].getAttribute('term'));
                    }
                }
                //
                //  Backward Compatibility
                //
                userDetailObject.userid = userDetailObject.allAttributes['com.ibm.snx_profiles.base.guid'];
                userDetailObject.mail = userDetailObject.allAttributes['com.ibm.snx_profiles.base.email'];
                userDetailObject.title = userDetailObject.allAttributes['com.ibm.snx_profiles.base.jobResp'];
                userDetailObject.photo = userDetailObject.links.image.href;
                userDetailObject.pronounciation = userDetailObject.links.pronunciation.href;
                userDetailObject.key = userDetailObject.allAttributes['com.ibm.snx_profiles.base.key'],
                userDetailObject.name = userDetailObject.allAttributes['com.ibm.snx_profiles.base.displayName'];
                //
                //  Linkroll
                //
                if (withLinkroll) {
                    userDetailObject.linkroll = await this.getUserLinkroll(userDetailObject.name, userDetailObject.key);
                }
                //
                //  Photo
                //
                if (withPhoto) {
                    //
                    //  Get the Profile Photo
                    //
                    __msgText = 'getUserInfosNormalAPI: error getting Profile Photo for ' + userDetailObject.name;
                    __msgStatus = 'error getting Profile Photo';
                    ICX.__log(__moduleName, true, 'getUserInfosNormalAPI: getting Profile Photo for ' + userDetailObject.name);
                    userDetailObject.photoBytes = await this.rpn(
                        {
                            url: userDetailObject.photo,
                            method: "GET",
                            headers: {"Content-Type": "image/*"},
                            encoding: 'binary'
                        }                    
                    );
                }
                //
                //  Pronounciation
                //
                if (withAudio) {
                    //
                    //  Get the Profile Photo
                    //
                    __msgText = 'getUserInfosNormalAPI: error getting Profile Audio for ' + userDetailObject.name;
                    __msgStatus = 'error getting Profile Audio';
                    ICX.__log(__moduleName, true, 'getUserInfosNormalAPI: getting Profile Audio for ' + userDetailObject.name);
                    userDetailObject.pronounciation = await this.rpn(
                        {
                            url: userDetailObject.pronounciation,
                            method: "GET",
                            headers: {"Content-Type": "audio/*"},
                            encoding: 'binary'
                        }                    
                    );
                }
                ICX.__logJson(__moduleName, __isDebug, 'Person Details for ' + theUser, userDetailObject);
                return userDetailObject;
            } else {
                // 
                //  No result found
                //
                ICX.__log(__moduleName, __isDebug, 'NO information found for Person  ' + theUser);
                return null;
            }
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "getUserInfosNormalAPI: " + __msgText, error);
            throw error;
        }
    }
    ICLogin2.prototype.getUserInfos = async function(myURL, theUser, adminOutput=false, withLinkroll=false, withPhoto=false, withAudio=false) {
        var __msgText = 'getUserInfos: error getting profile for ' + theUser;
        var __msgStatus = 'error getting profile';
        try {
            let userDetails = null;
            if (adminOutput) {
                userDetails = await this.getUserInfosAdminAPI(myURL, theUser, withLinkroll, withPhoto, withAudio);
            } else {
                userDetails = await this.getUserInfosNormalAPI(myURL, theUser, withLinkroll, withPhoto, withAudio);
            }
            return userDetails;
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "getUserInfos: " + __msgText, error);
            throw error;
        }
    }
    async function whoAmI(credentials, theServer, authType) {
        var __msgText = 'whoAmI: error executing whoAmI';
        var __msgStatus = 'error executing whoAmI';
        var theAuth;
        var theURL = theServer;
        if (authType === 'basic') {
            theAuth = {user: credentials.username, password: credentials.password};
            theURL += '/profiles/atom/profileService.do';
        } else {
            theAuth = {bearer: credentials.accessToken};
            theURL += '/profiles/oauth/atom/profileService.do';
        }
        try {
            //
            //  Get the Profile Entry
            //
            let response = await rpn(
                {
                    url: theURL,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml", "User-Agent" : "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0"},
                    auth: theAuth
                },
            );
            ICX.__logJson(__moduleName, __isDebug, "whoAmI OK", response);
            //
            //  Parse using JSDOM
            //
            __msgText = 'whoAmI: Parser error';
            __msgStatus = 'Parser Error';
            let theService = new JSDOM(response, {contentType: 'application/xml'});
            let theCollection = theService.window.document.querySelectorAll("service > workspace > collection");
            let displayName = theCollection[0].querySelectorAll('atom\\:title')[0].innerHTML;
            let userId      = theCollection[0].querySelectorAll('snx\\:userid')[0].innerHTML;
            let _editableFields  = theCollection[0].querySelectorAll('snx\\:editableField');
            let editableFields = {};
            for (let k=0; k < _editableFields.length; k++) {
                editableFields[_editableFields[k].getAttribute('name')] = true;
            }
            return {displayName: displayName, userId : userId};
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "whoAmI : " + __msgText, error);
            throw error;
        }
    }
    //
    //  Implementing first leg of OAuth 2.0
    //
    RED.httpAdmin.get('/ic-credentials/oauth', function(req, res){
        if (!req.query.clientId || !req.query.clientSecret ||
            !req.query.id || !req.query.callback) {
            res.send(400);
            return;
        }
        var node_id = req.query.id;
        var callback = req.query.callback;
        var server = _ICLogin2_getServer(req.query.serverType, req.query.server, req.query.server);
        var csrfToken = crypto.randomBytes(18).toString('base64').replace(/\//g, '-').replace(/\+/g, '_');
        //
        //  Build authorization and token URLs
        //
        var authURL = _ICLogin2_getAuthURL(req.query.serverType, server, req.query.clientId, callback);
        var tokenURL = _ICLogin2_getTokenURL(req.query.serverType, server);
        //
        //  set cookies
        //
        res.cookie('csrf', csrfToken);
        res.cookie('node_id', node_id);
        //
        //  Build a temporary credentials object and save it
        //
        var credentials = {
            oauthId: req.query.clientId,
            oauthSecret: req.query.clientSecret,
            theServerType: req.query.serverType,
            csrfToken: csrfToken,
            callback: callback,
            tokenURI: tokenURL,
            server: server
        };
        RED.nodes.addCredentials(node_id, credentials);
        //
        //  redirecting...
        //
        ICX.__log(__moduleName, __isDebug, 'ICLogin/auth : redirecting to ' + authURL);
        res.redirect(authURL);
    });
    //
    //  Implementing second leg of OAuth 2.0 (callback)
    //
    RED.httpAdmin.get('/ic-credentials/auth/callback', function(req, res) {
        if (req.query.error) {
            return res.send('ERROR: '+ req.query.error + ': ' + req.query.error_description);
        }
        //
        //  retrieve cookies
        //
        var cookies = req.headers['cookie'];
        var cookiesArr = cookies.split(";");
        var node_id = '';
        var csrf = '';
        cookiesArr.forEach(function(cookie) {
            cookie = cookie.trim();
            var tmp = cookie.split('=');
            if (tmp[0] === "node_id") {
                node_id = tmp[1];
            }
            if (tmp[0] === "csrf") {
                csrf = tmp[1];
            }
        });
        ICX.__log(__moduleName, __isDebug, 'ICLogin/callback : node id = ' + node_id);
        //
        //  retrieve previously saved temporary credentials
        //
        var credentials = RED.nodes.getCredentials(node_id);
        if (!credentials || !credentials.oauthId || !credentials.oauthSecret) {
            return res.send(RED._("ic.error.no-credentials"));
        }
        if (csrf !== credentials.csrfToken) {
            return res.status(401).send(RED._("ic.error.token-mismatch"));
        }
        var theServer = credentials.server;
        ICX.__log(__moduleName, __isDebug, 'ICLogin/callback : credentials found for ' + node_id);
        //
        //  perform the TOKEN endpoint
        //
        request.post(
            {
                url: credentials.tokenURI,
                headers:{"Content-Type" : "application/x-www-form-urlencoded"},
                form: {
                        grant_type: 'authorization_code',
                        code: req.query.code,
                        client_id: credentials.oauthId,
                        client_secret: credentials.oauthSecret,
                        callback_uri: credentials.callback,
                    },
            },
            function(err, result, data) {
                if (err) {
                    ICX.__logJson(__moduleName, true, "request error:", err);
                    return res.send(RED._("ic.error.something-broke"));
                }
                if (data.error) {
                    ICX.__logJson(__moduleName, true, "oauth error:", data.error);
                    return res.send(RED._("ic.error.something-broke"));
                }
                var serverType = credentials.theServerType;
                var creds = _ICLogin2_getArrayCreds(serverType, data);
                //
                //  Build and Save the correct credentials
                //
                credentials.accessToken = creds.access_token;
                credentials.refreshToken = creds.refresh_token;
                credentials.expiresIn = creds.expires_in;
                credentials.expireTime = parseInt(credentials.expiresIn) + (new Date().getTime());
                credentials.refreshTime = new Date().toUTCString();
                credentials.tokenType = creds.token_type;
                delete credentials.csrfToken;
                delete credentials.callback;
                delete credentials.tokenURI;
                delete credentials.callback;
                delete credentials.server;
                RED.nodes.addCredentials(node_id, credentials);
                _ICLogin2_dumpCred(credentials, 'First Authorization');
                //
                //  Writing credentials in persistent store
                //
                var isBM = process.env.VCAP_SERVICES;
                ICX.__log(__moduleName, __isDebug, 'ICLogin/httpAdminGet : isBM = ', isBM);
                if (!isBM) {
                    //
                    //  NOT on BlueMix
                    //
                    var outFile = _ICLogin2_oauthFileName(node_id);
                    ICX.__log(__moduleName, __isDebug, 'ICLogin/callback : Refreshing file record ' + outFile);
                    fs.writeFileSync(outFile, JSON.stringify(credentials, null, 2));
                    //
                    //  We can now get the NAME of the user in order to update the
                    //  "displayName" in the UI
                    //
                    whoAmI(credentials, theServer, 'oauth').then(async userDetails => {
                        credentials.displayName = userDetails.displayName;
                        credentials.userId = userDetails.userId;
                        RED.nodes.addCredentials(node_id, credentials);
                        return res.send(RED._("ic.error.authorized"));
                    })
                    .catch(error => {
                        ICX.__logJson(__moduleName, true, "ERROR getting whoAmI", error);
                        return res.status(error.statusCode).send(ICX.__getInfoFromError(error, "ERROR INSIDE WHOAMI"));    
                    });       
                } else {
                    //
                    //  on BlueMix
                    //
                    var newRec = {credentials : credentials, _id : node_id};
                    //
                    //  Sine this is a new set of credentials, the "_rev" needs to be initiated
                    //  so we do not need to specify it here
                    //
                    ICX.__log(__moduleName, __isDebug, 'ICLogin/callback : Refreshing cloudant record ' + node_id);
                    var credDB = _ICLogin2_oauthCloudantDB();
                    credDB.insert(newRec, function(err, body, header) {
                        if (err) {
                            res.send(RED._('ICLogin/callback : Error Writing Credentials to storage : ' + err));
                        } else {
                            //
                            //  We can now get the NAME of the user in order to update the
                            //  "displayName" in the UI
                            //
                            whoAmI(credentials, theServer, 'oauth').then(async userDetails => {
                                credentials.displayName = userDetails.displayName;
                                credentials.userId = userDetails.userId;
                                RED.nodes.addCredentials(node_id, credentials);
                                return res.send(RED._("ic.error.authorized"));
                            })
                            .catch(error => {
                                ICX.__logJson(__moduleName, true, "ERROR getting whoAmI", error);
                                return res.status(error.statusCode).send(ICX.__getInfoFromError(error, "ERROR INSIDE WHOAMI"));    
                            });       
                        }
                    });
                }
            }
        );
    });
    //
    //  Implementing Basic Authentication
    //
    RED.httpAdmin.get('/ic-credentials/basic', function(req, res) {
        if (!req.query.username || !req.query.password || !req.query.id) {
            res.send(400);
            return;
        }
        var node_id = req.query.id;
        var server = _ICLogin2_getServer(req.query.serverType, req.query.server, req.query.server);
        var credentials = {
            username: req.query.username,
            password: req.query.password,
            theServerType: req.query.serverType,
            server: server
        };
        RED.nodes.addCredentials(node_id, credentials);
        
        whoAmI(credentials, server, 'basic').then(async userDetails => {
            credentials.displayName = userDetails.displayName;
            credentials.userId = userDetails.userId;
            RED.nodes.addCredentials(node_id, credentials);
            return res.send(RED._("ic.error.authorized"));
        })
        .catch(error => {
            ICX.__logJson(__moduleName, true, "ERROR getting whoAmI", error);
            return res.status(error.statusCode).send(ICX.__getInfoFromError(error, "ERROR INSIDE WHOAMI"));    
        });       
    });
    //
    //  Node-RED Configuration function
    //
    function ICLogin2(config) {
		RED.nodes.createNode(this, config);

		this.server      = config.server;
		this.serverType  = config.serverType;
		this.cloudServer = config.cloudServer;
        this.authType    = config.authType;
        this.displayName = config.displayName;
        this.userId      = this.credentials.userId;
		this.username    = this.credentials.username;
		this.password    = this.credentials.password;
		this.oauthId     = this.credentials.oauthId;
		this.oauthSecret = this.credentials.oauthSecret;

        this.getServer   = _ICLogin2_getServer(this.serverType, this.cloudServer, this.server);
        //this.getContext  = _ICLogin2_getContext(this.server, this.serverType);

        ICX.__log(__moduleName, __isDebug, "###############################################");
        ICX.__logJson(__moduleName, __isDebug, "Credentials for [" + this.id + "] " + (this.name ? this.name : ""), this.credentials);
        ICX.__log(__moduleName, __isDebug, "###############################################");

    }
    //
    //  Exporting modules
    //
    RED.nodes.registerType("ICLogin2", ICLogin2,{
                            credentials: {
									username: {type:"text"},
									password: {type:"password"},
                                    oauthId: {type: "text"},
                                    oauthSecret: {type: "password"},
                                    expireTime: {type:"password"},
                                    expiresIn: {type:"password"},
                                    refreshTime: {type:"password"},
                                    displayName: {type: "text"},
                                    theServerType: {type: "text"}
                        }});
};
/*

Initial JSDOM Algorithm
========================
function thePrint(classList, element) {
    if (classList !== '') {
        console.log('---> ' + classList + ' = ' + element.innerHTML);
    }
}
for (let i=0; i< attributes.length; i++) {
    let classList = '';
    if (attributes[i].className) classList = attributes[i].className;
    if (attributes[i].children && (attributes[i].children.length > 0)) {
        //
        //  potentially there are important children
        //
        if (classList !== '') classList += '.';
        for (let j=0; j < attributes[i].children.length; j++) {
            let firstLevel = attributes[i].children[j];
            let firstLevelClassList = classList;
            if (firstLevel.className) firstLevelClassList += firstLevel.className;
            if (firstLevel.children && (firstLevel.children.length > 0)) {
                if (firstLevel.className) firstLevelClassList += '.';
                for (let k=0; k < firstLevel.children.length; k++) {
                    let secondLevel = firstLevel.children[k];
                    let secondLevelClassList = firstLevelClassList;
                    if (secondLevel.className) secondLevelClassList += secondLevel.className;
                    thePrint(secondLevelClassList, secondLevel);
                }
            } else {
                //
                //  No Child
                //
                thePrint(firstLevelClassList, firstLevel);
            }
        }
    } else {
        //
        //  There is NO CHILD
        //
        thePrint(classList, attributes[i]);
    }
}
*/
