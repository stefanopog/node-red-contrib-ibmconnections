/*
Copyright IBM All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

module.exports = function(RED) {
    "use strict";
    const ICX = require('./common.js');
    const __isDebug = ICX.__getDebugFlag();
    const __delegation = ICX.__getLConnRunAs();
    const __moduleName = 'IC_Login2';
  
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
    //const parser = new xml2js.Parser();
    const builder  = new xml2js.Builder({rootName: "content"});
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
    //
    //
    function _ICLogin2_parseServiceEntry(entry) {
        var svc = {};
        if (entry.title && entry.title[0]['_']) {
            svc.title = entry.title[0]['_'];
        } else if (entry.title && entry.title[0]) {
            svc.title = entry.title[0];
        }
        if (entry.link) {
            svc.href = entry.link[0]['$'].href;
        }
        return svc;
    }

    //
    //  Getting information about the logging in user
    //
    function _ICLogin2_whoAmI(node_id, credentials, theServer, res, authType, serverType) {
        var xml2js = require("xml2js");
        var parser = new xml2js.Parser();
        var theAuth;
        var theURL;
        if (authType === 'basic') {
            theAuth = {user: credentials.username, password: credentials.password};
            theURL = theServer + '/profiles/atom/profileService.do';
        } else {
            theAuth = {bearer: credentials.accessToken};
            if (serverType === "cloud") {
                theURL = theServer + '/profiles/oauth/atom/profileService.do';
            } else {
                theURL = theServer + '/profiles/oauth/atom/profileService.do';
            }
        }
        //
        //  Fetching "serviceconfig" document
        //
        request.get(
            {url: theServer + '/activities/serviceconfigs',
             method: 'GET',
             headers:{
                //"Content-Type" : "application/atom+xml; charset=UTF-8",
                "User-Agent" : "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0"
             },
             auth : theAuth
            },
            function(err1, response1, body1) {
                if (err1) {
                    console.log('fetching IC serviceconfig failed _whoAmI: ' + err1);
                    return res.send(RED._("ic.error.svcconfig-fetch-failed"));
                }
                if (response1.statusCode >= 400) {
                    console.log('fetching IC serviceconfig failed _whoAmI: ' +
                                response1.statusCode + ": " + response1.message);
                    console.log(JSON.stringify(response1, ' ', 2));
                    return res.send(RED._("ic.error.svcconfig-fetch-failedd"));
                }
                //
                //  Parse the Atom document
                //
                parser.parseString(body1, function (err2, result2) {
                    if (err2) {
                        console.log("Parser Error svcconfig _whoAmI : " + err2);
                        return res.send(RED._("ic.error.svcconfig-fetch-failed"));
                    }
                    var myData = new Array();
                    if (result2.feed.entry) {
                        var i=0;
                        for (i = 0; i < result2.feed.entry.length; i++) {
                            myData.push(_ICLogin2_parseServiceEntry(result2.feed.entry[i]));
                        }
                    } else {
                        console.log("Parser Error svcconfig _whoAmI : NO ENTRY found");
                        return res.send(RED._("ic.error.svcconfig-fetch-failed"));
                    }
                    console.log('This is the instance ServiceConfig document');
                    console.log(JSON.stringify(myData, ' ', 2));
                    //
                    //  Fetch user details
                    //
                    request2.get(
                        {url: theURL,
                         method: "GET",
                         headers:{
                            "Content-Type" : "application/atom+xml", //; charset=UTF-8",
                            "User-Agent" : "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0"
                         },
                         auth: theAuth
                        },
                        function(err, response, body) {
                            if (err) {
                                console.log('fetching IC profile failed _whoAmI: ' + err);
                                return res.send(RED._("ic.error.profile-fetch-failed"));
                            }
                            if (response.statusCode >= 400) {
                                console.log('fetching IC profile failed _whoAmI: ' +
                                            response.statusCode + ": " + response.message);
                                console.log(JSON.stringify(response, ' ', 2));
                                return res.send(RED._("ic.error.profile-fetch-failed"));
                            }
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log("Parser Error _whoAmI : " + err);
                                    return res.send(RED._("ic.error.profile-fetch-failed"));
                                }
                                if (result.service.workspace[0]['atom:title'][0]['_']) {
                                    //
                                    //  We set the "displayName" property of the credentials
                                    //
                                    credentials.displayName = result.service.workspace[0]['atom:title'][0]['_'];
                                    credentials.userId = result.service.workspace[0].collection[0]['snx:userid'][0];
                                    RED.nodes.addCredentials(node_id, credentials);
                                    return res.send(RED._("ic.error.authorized"));
                                } else {
                                    console.log("Missing atom:title element _whoAmI" + err);
                                    return res.send(RED._("ic.error.profile-fetch-failed"));
                                }
                            });
                        }
                    );
                });
            }
        );
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
/*
        console.log('*********************************************');
        console.log('*********************************************');
        console.log('*********************************************');
        console.log('*********************************************');
        console.log('*********************************************');
        var globalContext = this.context().global;
        console.log(JSON.stringify(globalContext.get('stefano'), ' ', 2));
        console.log('*********************************************');
        console.log('*********************************************');
        console.log('*********************************************');
        console.log('*********************************************');
        console.log('*********************************************');
*/
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
            if (__delegation && (node.id === __delegation.nodeId)) {
                if ((req.method === 'PUT') || (req.method === "POST")) {
                    //
                    //  Adding Delegation
                    //
                    req.headers['X-LCONN-RUNAS'] = __delegation.userId;
                    ICX.__log(__moduleName, __isDebug, 'Adding X_LCONN_RUNAS delegation to userId ' + __delegation.userId);
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
                if (__delegation && (node.id === __delegation.nodeId)) {
                    if ((req.method === 'PUT') || (req.method === "POST")) {
                        //
                        //  Adding Delegation
                        //
                        req.headers['X-LCONN-RUNAS'] = __delegation.userId;
                        ICX.__log(__moduleName, __isDebug, 'Adding X_LCONN_RUNAS delegation to userId ' + __delegation.userId);
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
    function __getUserDetail(record, idOnly) {
        var person = {};
        //
        //  This function retrieves the photo "sp_XX:div" from the VCARD
        //
        var tmp = record.id[0];
        person.key = tmp.split(':entry')[1];
        person.userid = record.contributor[0]['snx:userid'][0];
        person.mail = record.contributor[0]['email'][0];
        person.name = record.contributor[0]['name'][0];
        if (!idOnly) {
            let kk = (function (a) { return a[Object.keys(a)[1]];})(record.content[0]);
            const dom = new JSDOM(builder.buildObject(kk[0]));        
            person.vcard = builder.buildObject(record.content[0]);
            if (dom.window.document.querySelector("div.title").textContent) {
                person.title = dom.window.document.querySelector("div.title").textContent;
            } else {
                person.title = 'UNDEFINED';
            }
            try {
                let tmp = dom.window.document.querySelector("img.photo").src;
                tmp = tmp.split('&')[0];
                person.photo = tmp;
                //
                //  We will deal ASYNCHRONOUSLY with downloading each photo
                //
                /*
                asyncTasks.push(function(_dummyCallback) {
                                    _getPhotoBytes(person, tmp, _dummyCallback);
                                }
                );
                */
            } catch (err) {
                console.log('error trying to get Photo for user ' + person.name + '. Error is ' + err.message);
                console.log(record.content[0]);
                person.photo = '';
                node.warn('No photo for ' +  person.name);
            }
        }
        return person;                                     
    }

    ICLogin2.prototype.fromMailToId = async function (mailAddress, idOnly=false) {
        var __msgText = 'error getting profile for ' + mailAddress;
        var __msgStatus = 'error getting profile';
        try {
            //
            //  Get the Profile Entry
            //
            ICX.__log(__moduleName, true, 'fromMailToId: convert ' + mailAddress + ' to ID');
            let myURL = this.getServer + "/profiles";
            if (this.authType === "oauth") myURL += '/oauth';
            if (this.serverType === "cloud") {
                myURL += "/atom/search.do?search=" + mailAddress + '&format=full';
            } else {
                myURL += "/atom/profile.do?email=" + mailAddress;
            }
            let response = await this.rpn(
                {
                    url: myURL,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "fromMailToId OK", response);
            //
            //  Parse the Profile Entry
            //
            __msgText = 'Parser error in for ' + mailAddress;
            __msgStatus = 'Parser Error';
            ICX.__log(__moduleName, true, 'fromMailToId: Parsing XML Feed for ' + mailAddress);
            let result = await ICX.__getXmlAttribute(response);
            if (result.feed.entry) {
                let myData = __getUserDetail(result.feed.entry[0], idOnly);
                ICX.__log(__moduleName, true, 'fromMailToId: Succesfully Parsed entry for ' + mailAddress);
                if (!idOnly) {
                    //
                    //  Get the LINKS associated to the Profile
                    //
                    __msgText = 'fromMailToId : error getting Linkroll for ' + mailAddress;
                    __msgStatus = 'error getting Linkroll';
                    ICX.__log(__moduleName, true, 'fromMailToId: getting Profile Links for ' + mailAddress);
                    let linksURL = this.getServer + "/profiles";
                    if (this.authType === "oauth") theURL += '/oauth';
                    linksURL += '/atom/profileExtension.do?key=' + myData.key + '&extensionId=profileLinks';
                    let response2 = await this.rpn(
                        {
                            url: linksURL,
                            method: "GET",
                            headers: {"Content-Type": "application/atom+xml"}
                        }                    
                    );
                    if (response2 !== '') {
                        ICX.__logJson(__moduleName, __isDebug, "fromMailToId : Links OK", response2);
                        //
                        //  Parse Linkrool
                        //
                        __msgText = 'Parser error in fromMailToId Linkroll!';
                        __msgStatus = 'Linkroll Parser Error';
                        ICX.__log(__moduleName, true, 'fromMailToId: Parsing XML Linkroll Feed for ' + mailAddress);
                        let result2 = await ICX.__getXmlAttribute(response2);
                        let links = [];
                        for (let i=0; i < result2.linkroll.link.length; i++) {
                            let theLink = {};
                            theLink.name = result.linkroll.link[i]["$"].name;
                            theLink.url = result.linkroll.link[i]["$"].url;
                            links.push(theLink);
                        }
                        myData.linkroll = links;
                    } else {
                        ICX.__log(__moduleName, __isDebug, "fromMailToId : No Links found");
                    }
                }
                return myData;
            } else {
                ICX.__log(__moduleName, true, 'fromMailToId: No ENTRY found for ' + mailAddress);
                return null;
            }
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "fromMailToId : " + __msgText, error);
            throw error;
        }
    }

    ICLogin2.prototype.fromIdToMail = async function (userId, idOnly=false) {
        var __msgText = 'error getting profile for ' + userId;
        var __msgStatus = 'error getting profile';
        try {
            //
            //  Get the Profile Entry
            //
            ICX.__log(__moduleName, true, 'fromIdToMail: convert ' + userId + ' to Mail');
            let myURL = this.getServer + "/profiles";
            if (this.authType === "oauth") myURL += '/oauth';
            myURL += "/atom/profile.do?userid=" + userId;
            let response = await this.rpn(
                {
                    url: myURL,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "fromIdToMail OK", response);
            //
            //  Parse the Profile Entry
            //
            __msgText = 'Parser error in for ' + userId;
            __msgStatus = 'Parser Error';
            ICX.__log(__moduleName, true, 'fromIdToMail: Parsing XML Feed for ' + userId);
            let result = await ICX.__getXmlAttribute(response);
            if (result.feed.entry) {
                let myData = __getUserDetail(result.feed.entry[0], idOnly);
                ICX.__log(__moduleName, true, 'fromIdToMail: Succesfully Parsed entry for ' + userId);
                if (!idOnly) {
                    //
                    //  Get the LINKS associated to the Profile
                    //
                    __msgText = 'fromIdToMail : error getting Linkroll for ' + userId;
                    __msgStatus = 'error getting Linkroll';
                    ICX.__log(__moduleName, true, 'fromIdToMail: getting Profile Links for ' + userId);
                    let linksURL = this.getServer + "/profiles";
                    if (this.authType === "oauth") theURL += '/oauth';
                    linksURL += '/atom/profileExtension.do?key=' + myData.key + '&extensionId=profileLinks';
                    let response2 = await this.rpn(
                        {
                            url: linksURL,
                            method: "GET",
                            headers: {"Content-Type": "application/atom+xml"}
                        }                    
                    );
                    if (response2 !== '') {
                        ICX.__logJson(__moduleName, __isDebug, "fromIdToMail : Links OK", response2);
                        //
                        //  Parse Linkrool
                        //
                        __msgText = 'Parser error in fromIdToMail Linkroll!';
                        __msgStatus = 'Linkroll Parser Error';
                        ICX.__log(__moduleName, true, 'fromIdToMail: Parsing XML Linkroll Feed for ' + userId);
                        let result2 = await ICX.__getXmlAttribute(response2);
                        let links = [];
                        for (let i=0; i < result2.linkroll.link.length; i++) {
                            let theLink = {};
                            theLink.name = result.linkroll.link[i]["$"].name;
                            theLink.url = result.linkroll.link[i]["$"].url;
                            links.push(theLink);
                        }
                        myData.linkroll = links;
                    } else {
                        ICX.__log(__moduleName, __isDebug, "fromIdToMail : No Links found");
                    }
                }
                return myData;
            } else {
                ICX.__log(__moduleName, true, 'fromIdToMail: No ENTRY found for ' + userId);
                return null;
            }
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "fromIdToMail : " + __msgText, error);
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
        var crypto = require("crypto");
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
                    _ICLogin2_whoAmI(node_id, credentials, theServer, res, 'oauth', serverType);
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
                            _ICLogin2_whoAmI(node_id, credentials, theServer, res, 'oauth', serverType);
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
        _ICLogin2_whoAmI(node_id, credentials, server, res, 'basic', req.query.serverType);
    });
};
