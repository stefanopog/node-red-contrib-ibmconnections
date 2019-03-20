/*
Copyright IBM All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

module.exports = function(RED) {
    var __isDebug = process.env.ICDebug || false;
    var __moduleName = 'IC_Profiles';
  
    console.log("*****************************************");
    console.log("* Debug mode is " + (__isDebug ? "enabled" : "disabled") + ' for module ' + __moduleName);
    console.log("*****************************************");
  
    const { __log, 
        __logJson, 
        __logError, 
        __logWarning, 
        __getOptionValue, 
        __getMandatoryInputFromSelect, 
        __getMandatoryInputString, 
        __getOptionalInputString, 
        __getNameValueArray,
        __getItemValuesFromMsg } = require('./common.js');

    function ICProfilesGet(config) {      
        RED.nodes.createNode(this,config);                
        //
        //  Global to access the custom HTTP Request object available from the
        //  ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		var node = this;

        var mailExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        const jsdom = require("jsdom");
        const { JSDOM } = jsdom;
        var xml2js = require("xml2js");
        var parser = new xml2js.Parser();
        var builder  = new xml2js.Builder({rootName: "content"});
        var async = require("async");
        var asyncTasks = [];
        var server = "";
        
        function _dummyCallback(err, item) {
            console.log('DUMMY CALLBACK ' + item);
        }

        function _beforeSend(theMsg) {
            console.log('_beforeSend: need to process ' + asyncTasks.length + ' async tasks...');
            //
            //  This is where the MAGIC of Async happens
            //
            if (asyncTasks.length > 0) {
                async.parallel(asyncTasks, function(err, results) {
                                                //
                                                // All tasks are done now
                                                //  We can return
                                                //
                                                node.send(theMsg);
                                                console.log("_beforeSend : ready to send final information....");
                                            }
                );                  
            } else {
                //
                //  Nothing asynchronous to do
                //  We can return immediatealy
                //
                node.send(theMsg);
            }
        }
        function _getUserDetail(record) {
            var person = {};
            var tmp = '';
            //
            //  This function retrieves the photo "sp_XX:div" from the VCARD
            //
            var kk = (function (a) { return a[Object.keys(a)[1]];})(record.content[0]);

            //console.log(JSON.stringify(kk, ' ', 2));

            const dom = new JSDOM(builder.buildObject(kk[0]));
            //console.log(dom.window.document.querySelector("div.title").textContent);
            //console.log(dom.window.document.querySelector("img.photo").src);
            
            tmp = record.id[0];
            if (config.vcard) person['vcard'] = builder.buildObject(record.content[0]);
            if (config.key || config.links) person['key'] = tmp.split(':entry')[1];
            if (config.uuid) person['userid'] = record.contributor[0]['snx:userid'][0];
            if (config.mail) person['mail'] = record.contributor[0]['email'][0];
            if (config.thename) person['name'] = record.contributor[0]['name'][0];
            if (config.title) {
                if (dom.window.document.querySelector("div.title").textContent) {
                    person['title'] = dom.window.document.querySelector("div.title").textContent;
                } else {
                    person['title'] = 'UNDEFINED';
                }
            }
            try {
                let tmp = dom.window.document.querySelector("img.photo").src;
                tmp = tmp.split('&')[0];
                if (config.photo) {
                    //person['photo'] = kk[0]['span'][0]['div'][0]['img'][0]['$'].src;
                    person['photo'] = tmp;
                }
                if (config.photoBytes) {
                    //
                    //  We will deal ASYNCHRONOUSLY with downloading each photo
                    //
                    asyncTasks.push(function(_dummyCallback) {
                                        _getPhotoBytes(person, tmp, _dummyCallback);
                                    }
                    );
                }
            } catch (err) {
                console.log('error trying to get Photo for user ' + person['name'] + '. Error is ' + err.message);
                console.log(record.content[0]);
                person['photo'] = '';
                node.warn('No photo for ' +  person['name']);
            }
            return person;                                     
        }

        //
        //  Old function
        //  used when the "userId" information was not saved in the ICLOgin
        //  Keep for history
        //
        function getForMe(theMsg, server) {
            var theURL = server + '/profiles';
            if (node.login.authType === "oauth") theURL += '/oauth';
            theURL += '/atom/profileService.do';
            node.login.request(
                {
                    url: theURL, 
                    method: "GET"
                },
                function(error, response, body) {
                    if (error) {
                        console.log("error getting information for MY profile !", error);
                        node.status({fill:"red",shape:"dot",text:"No Profile Info"});
                        node.error(error.toString(), theMsg);
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            console.log("GET OK (" + response.statusCode + ")");
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                    node.error("getForMe: Parser Error", theMsg);
                                    return;
                                }
                                if (result.service.workspace[0].collection[0]['snx:userid'][0]) {
                                    getForOther(theMsg, 
                                                server + '/profiles/atom/profile.do?userid=' + result.service.workspace[0].collection[0]['snx:userid'][0]);
                                } else {
                                    console.log('getForMe: Missing <ENTRY> element : ' + result);
                                    theMsg.payload = {};
                                    node.status({fill:"yellow",shape:"dot",text:"No Entry "});
                                    //
                                    //  We can directly send the result as we will not deal with additional callbacks because we are in
                                    //  a logical error situation
                                    //
                                    node.send(theMsg);
                               }
                            });
                        } else {
                            console.log("getForMe: GET PROFILE NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.statusMessage, theMsg);
                        }
                    }
                }
            ); // end http.post 
        }

        function getForOther(theMsg, theURL) {
            console.log('getForOther : with URL ' + theURL);
            node.login.request(
                {
                    url: theURL, 
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                },
                function(error, response, body) {
                    console.log('getForOther: executing on ' + theURL);
                    if (error) {
                        console.log("error getting information for profile : " + theURL + " - " + error);
                        node.status({fill:"red",shape:"dot",text:"No Profile Info"});
                        node.error(error.toString(), theMsg);
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            console.log("GET OK (" + response.statusCode + ")");
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                    node.error("getForOther: Parser Error", theMsg);
                                    return;
                                }
                                if (result.feed.entry) {
                                    theMsg.payload = _getUserDetail(result.feed.entry[0]);
                                    if (config.links) {
                                        //
                                        //  Fetch Linkroll
                                        //
                                        asyncTasks.push(function(_dummyCallback) {
                                                            _getProfileLinks(theMsg, _dummyCallback);
                                                        });
                                    } else {
                                        //
                                        //  Safely return node results as no other action 
                                        //  is required
                                        //
                                        node.status({});
                                    }
                                    //
                                    //  Before SEND, we need to verify if there are asynchronous things to be done ....
                                    //
                                    _beforeSend(theMsg);
                                } else {
                                    console.log('getForOther: Missing <ENTRY> element : ' + result);
                                    node.status({fill:"yellow",shape:"dot",text:"No Entry "});
                                    theMsg.payload = {};
                                    //
                                    //  We can directly send the result as we will not deal with additional callbacks because we are in
                                    //  a logical error situation
                                    //
                                    node.send(theMsg);
                               }
                            });
                        } else {
                            console.log("getForOther: GET PROFILE NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        }
                    }
                }
            );
        }

        function getByParams(theMsg, theURL) {
            console.log('getByParams : with URL ' + theURL);
            node.login.request(
                {
                    url: theURL, 
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                },
                function(error, response, body) {
                    if (error) {
                        console.log("error getting information by PARAMS : " + theURL + " - " + error);
                        node.status({fill:"red",shape:"dot",text:"No Profile Info"});
                        node.error('No Profile Info', theMsg);
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            console.log("GET OK (" + response.statusCode + ")");
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                    node.error("getByParams: Parser Error", theMsg);
                                    return;
                                }
                                if (result.feed.entry) {
                                    var myData = new Array();
                                    for (let i=0; i < result.feed.entry.length; i++) {
                                        myData.push(_getUserDetail(result.feed.entry[i]));
                                    }
                                    theMsg.payload = myData;
                                    node.status({});
                                    //
                                    //  Before SEND, we need to verify if there are asynchronous things to be done ....
                                    //
                                    _beforeSend(theMsg);
                                } else {
                                    console.log('getByParams: Missing <ENTRY> element : ' + result);
                                    theMsg.payload = {};
                                    node.status({fill:"yellow",shape:"dot",text:"No Entry "});
                                    //
                                    //  We can directly send the result as we will not deal with additional callbacks because we are in
                                    //  a logical error situation
                                    //
                                    node.send(theMsg);
                                }
                            });
                        } else {
                            console.log("getByParams: GET PROFILE NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        }
                    }
                }
            ); 
        }

        function _getProfileLinks(theMsg, callback) {
            var theURL = server + '/profiles';
            if (node.login.authType === "oauth") theURL += '/oauth';
            theURL += '/atom/profileExtension.do?key=' + theMsg.payload.key + '&extensionId=profileLinks';
            console.log('_getProfileLinks : with URL ' + theURL);
            node.login.request(
                {
                    url: theURL,
                    method: "GET"
                },
                function(error, response, body) {
                    if (error) {
                        console.log("error getting profileLinks for : " + theURL + " - " + error);
                        node.status({fill:"yellow",shape:"dot",text:"No Profile Info"});
                    } else {
                        if (response.statusCode == 200) {
                            console.log("_getProfileLinks GET OK (" + response.statusCode + ")");
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"yellow",shape:"dot",text:"Parser Error _getProfileLinks"});
                                } else {
                                    var links = [];
                                    for (let i=0; i < result.linkroll.link.length; i++) {
                                        var theLink = {};
                                        theLink.name = result.linkroll.link[i]["$"].name;
                                        theLink.url = result.linkroll.link[i]["$"].url;
                                        links.push(theLink);
                                    }
                                    theMsg.payload.linkroll = links;
                                    console.log(theMsg.payload.linkroll);
                                    //
                                    //  Return control to the flow
                                    //
                                    node.status({});
                                }
                            });
                        } else {
                            console.log("_getProfileLinks: GET PROFILELINKS NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"yellow",shape:"dot",text:" _getProfileLinks " + response.statusMessage});
                        }
                    }
                    callback(null, theURL);
                }
            ); 
        }
        
        function _getPhotoBytes(theMsg, theURL, callback) {
            console.log('_getPhotoBytes : with URL ' + theURL);
            node.login.request(
                {
                    url: theURL,
                    method: "GET"
                },
                function(error, response, body) {
                    if (error) {
                        console.log("error getting photoBytes : " + theURL + " - " + error);
                        node.status({fill:"yellow",shape:"dot",text:"No photoBytes Info"});
                    } else {
                        if (response.statusCode == 200) {
                            console.log("_getPhotoBytes: GET OK (" + response.statusCode + ")");
                            theMsg['photoBytes'] = body;
                            //
                            //  Return control to the flow
                            //
                            node.status({fill:"green",shape:"dot",text:" _getPhotoBytes OK"});
                        } else {
                            console.log("_getPhotoBytes: GET PHOTOBYTES NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"yellow",shape:"dot",text:" _getPhotoBytes " + response.statusMessage});
                        }
                    }
                    callback(null, theURL);
                }
            ); 
        }
       
        this.on(
            'input', 
            function(msg) {
                var serverConfig = RED.nodes.getNode(config.server);
                var myURL = "";
                //
                //  Server is a GLOBAL variable
                //
                server   =  serverConfig.getServer;
                node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                //
                //  Prepare for callbacks
                //
                asyncTasks = [];
                switch (config.target) {
                    case "byKeyword" :
                        if ((config.mykeywords === '') && 
                            ((msg.keywords === undefined) || (msg.keywords === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing Keywords Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Keywords"});
                            node.error('Missing Keywords', msg);
                         } else {
                            var theKeywords = '';
                            if (config.mykeywords !== '') {
                                theKeywords = config.mykeywords.trim();
                            } else {
                                theKeywords = msg.keywords.trim();
                            } 
                            myURL = server  + "/profiles";
                            if (node.login.authType === "oauth") myURL += '/oauth';
                            myURL += "/atom/search.do?sortBy=relevance&search=" + theKeywords + '&format=full&ps=1000';
                            //
                            // get Profile By Tags
                            //
                            getByParams(msg, myURL);
                        }
                        break;
                    case "byTag" :
                        if ((config.mytags === '') && 
                            ((msg.tags === undefined) || (msg.tags === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing Tags Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Tags"});
                            node.error('Missing Tags', msg);
                         } else {
                            var theTags = '';
                            if (config.mytags !== '') {
                                theTags = config.mytags.trim();
                            } else {
                                theTags = msg.tags.trim();
                            } 
                            myURL = server  + "/profiles";
                            if (node.login.authType === "oauth") myURL += '/oauth';
                            myURL += "/atom/search.do?profileTags=" + theTags + '&format=full&ps=1000';
                            //
                            // get Profile By Tags
                            //
                            node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                            getByParams(msg, myURL);
                        }
                        break;
                    case "syntaxSearch" : 
                        if ((config.freesyntax === '') && 
                            ((msg.freeSyntax === undefined) || (msg.freeSyntax === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing Free Syntax Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Syntax"});
                            node.error('Missing Syntax', msg);
                         } else {
                            var freeSyntax = '';
                            if (config.freesyntax !== '') {
                                freeSyntax = config.freesyntax;
                            } else {
                                freeSyntax = msg.freeSyntax;
                            } 
                            myURL = server  + '/profiles';
                            if (node.login.authType === "oauth") myURL += "/oauth";
                            myURL += '/atom/search.do?' + freeSyntax;
                            console.log(myURL);
                            //
                            // get Profile By Tags
                            //
                            node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                            getByParams(msg, myURL);
                        }
                        break;
                    case "myself" :
                        //
                        // get Profile Informations
                        //
                        node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                        myURL = server + "/profiles";
                        if (node.login.authType === "oauth") myURL += '/oauth';
                        myURL += "/atom/profile.do?userid=" + serverConfig.userId;
                        getForOther(msg, myURL);
                        break;
                    case "person" :
                        //
                        //	In case the message needs to be delivered to somebody else ....
                        //  Check if mail address is entered
                        //
                        if ((config.targetValue === '') && 
                            ((msg.target === undefined) || (msg.target === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing Target Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Target"});
                            node.error('Missing Target', msg);
                         } else {
                            var mailAddr = '';
                            if (config.targetValue !== '') {
                                mailAddr = config.targetValue;
                            } else {
                                mailAddr = msg.target;
                            }
                            myURL = server + "/profiles";
                            if (node.login.authType === "oauth") myURL += '/oauth';
                            if (mailExp.test(mailAddr)) {
                                //
                                //  Retrieve By Mail
                                //
                                if (serverConfig.serverType === "cloud") {
                                    myURL += "/atom/search.do?search=" + mailAddr.trim() + '&format=full';
                                } else {
                                    myURL += "/atom/profile.do?email=" + mailAddr.trim();
                                }
                            } else {
                                //
                                //  Retrieve by Uuid
                                //
                                myURL += "/atom/profile.do?userid=" + mailAddr.trim();
                            }
                            //
                            // get Profile Informations
                            //
                            node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                            getForOther(msg, myURL);
                        }
                        break;
                }
             }
        );
    }
    
    RED.nodes.registerType("ICProfilesGet",  ICProfilesGet);
    
};
