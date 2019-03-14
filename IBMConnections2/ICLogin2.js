module.exports = function(RED) {
    "use strict";
    var debug = true;
    var fs = require("fs");
    var request = require("request");
    var request2 = require("request");
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
        console.log('ICLogin2............');
		RED.nodes.createNode(this, config);
        console.log('ICLogin2............ created');

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
        if (debug) {
            if (err) {
                console.log('======= ERR ==========');
                console.log(JSON.stringify(err, null, 2));
            }
            if (result) {
                console.log('======= result 2 ==========');
                console.log(result.statusCode);
                console.log(result.statusMessage);
                console.log(JSON.stringify(result.headers, null, 2));
            }
            if (data) {
                console.log('======= data 2 ==========');
                console.log(JSON.stringify(data, null, 2));
            }
        }
    }
    //
    //  Debugging Function
    //
    function _ICLogin2_dumpCred(credentials, header) {
        if (debug) {
            console.log('******** ' + header + ' ************** ');
            console.log('Client Id : ' + credentials.oauthId);
            console.log('Client Secret : ' + credentials.oauthSecret);
            console.log('Access Token : ' + credentials.accessToken);
            console.log('Refresh Token : ' + credentials.refreshToken);
            console.log('Token Type : ' + credentials.tokenType);
            console.log('Expires In : ' + credentials.expiresIn);
            var xyz = new Date(credentials.expireTime).toUTCString();
            console.log('Expire Time : ' + xyz);
            console.log('last refresh : ' + credentials.refreshTime);
            console.log('*********************************************');
        }
    }
    //
    //  Get the OAuth Authorization URL (as a function of the serverType)
    //
    function _ICLogin2_getAuthURL(serverType, server, clientId, callback) {
        var authURL = '';
        if (serverType === "cloud") {
            authURL  = server + '/manage/oauth2/authorize';
            authURL += '?response_type=code&client_id=' + clientId;
            authURL += '&callback_uri=' + callback;
        } else {
            authURL  = server + '/oauth2/endpoint/connectionsProvider/authorize';
            authURL += '?response_type=code&client_id=' + clientId;
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
        var tokenURL = '';
        if (serverType === "cloud") {
            tokenURL = server + '/manage/oauth2/token';
        } else {
            tokenURL = server + '/oauth2/endpoint/connectionsProvider/token';
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
        var endSlash = new RegExp("/" + "+$");
        var fmtServer   = "";
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
        if ((server.toLowerCase().indexOf("w3-connections") != -1) &&
            (serverType !== "cloud")) {
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
        req.method = req.method || 'GET';
        //
        //  Check which authorization
        //
        var theAuth = {};
        if (node.authType === 'oauth') {
            //
            // always set access token to the latest ignoring any already present
            //
            theAuth = {bearer: node.credentials.accessToken};
        } else {
            theAuth = {user: node.credentials.username, password: node.credentials.password};
        }
        req.auth = theAuth;
        if (req.headers) {
            req.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0";
        } else {
            req.headers = {
                     "User-Agent" : "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0"};
        }
        //
        //  Performing the request
        //
        console.log(JSON.stringify(req, ' ', 2));
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
        console.log('ICLogin/auth : redirecting to ' + authURL);
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
        console.log('ICLogin/callback : node id = ' + node_id);
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
        console.log('ICLogin/callback : credentials found for ' + node_id);
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
                    console.log("request error:" + err);
                    return res.send(RED._("ic.error.something-broke"));
                }
                if (data.error) {
                    console.log("oauth error: " + data.error);
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
                credentials.expireTime =
                    parseInt(credentials.expiresIn) + (new Date().getTime());
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
                console.log('ICLogin/httpAdminGet : isBM = ', isBM);
                if (!isBM) {
                    //
                    //  NOT on BlueMix
                    //
                    var outFile = _ICLogin2_oauthFileName(node_id);
                    console.log('ICLogin/callback : Refreshing file record ' + outFile);
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
                    console.log('ICLogin/callback : Refreshing cloudant record ' + node_id);
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
