/*
Copyright IBM All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

module.exports = function(RED) {
    var __isDebug = process.env.ICDebug || false;
    var __moduleName = 'IC_EmbeddedExperience';
  
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

    function ICASPut(config) {      
         RED.nodes.createNode(this,config);        
         //
         //  Global to access the custom HTTP Request object available from the
         //  ICLogin node
         //
         this.login = RED.nodes.getNode(config.server);
         var node = this;
 
         var mailExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
         var xml2js = require("xml2js");
         var parser = new xml2js.Parser();
         var server = "";
         var context = "";
 
         function _postASFromMail(serverType, theMsg, targetId, myData, commentId, cb) {
             var theURL = server + "/profiles";
             if (node.login.authType === "oauth") theURL += '/oauth';
             if (serverType == "cloud") {
                 theURL += "/atom/search.do?search=" + targetId;
             } else {
                 theURL += "/atom/profile.do?email=" + targetId;
             }
             
             node.login.request(
                 {
                     url: theURL, 
                     method : "GET",
                     headers:{"Content-Type" : "application/atom+xml"}
                 },
                 function(error, response, body) {
                     console.log('ASPut: executing on ' + theURL);
                     if (error) {
                         console.log("error getting information for profile !" + targetId);
                         node.status({fill:"red",shape:"dot",text:"Err1"});
                         node.error(error.toString(), theMsg);
                     } else {
                         if (response.statusCode >= 200 && response.statusCode < 300) {  
                             console.log("ASPut : GET OK (" + response.statusCode + ")");
                             console.log(body);
                             //
                             //	Have the node to emit the URL of the newly created event
                             //
                             parser.parseString(body, function (err, result) {
                                 if (err) {
                                     node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                     node.error("Parser Error getting the AS", theMsg);
                                     console.log("ASPut : Parser Error getting profile");
                                     console.log(err);
                                     return;
                                 }
                                 if (result.feed.entry && result.feed.entry[0]) {
                                     node.status({fill:"green",shape:"dot",text:"mail translated"});
                                     //
                                     //  Now we have the person UUid
                                     //
                                     var newTarget = "urn:lsid:lconn.ibm.com:profiles.person:" + result.feed.entry[0].contributor[0]['snx:userid'][0];
                                     //
                                     //  go and fetch the AS
                                     //
                                     cb(theMsg, newTarget, myData, commentId);
                                 } else {
                                     node.status({fill:"red",shape:"dot",text:"No Entry"});
                                     node.error('Err2', theMsg);
                                     console.log("ASPut : Parser Error getting the AS - no ENTRY");
                                     console.log(result);
                                 }
                             });
                         } else {
                             console.log("ASPut: GET PROFILE NOT OK (" + response.statusCode + ")");
                             console.log(body);
                             node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                             node.error(response.statusCode + ' : ' + response.body, theMsg);
                         } 
                     }
                 } 
             );
         }
        
        
         function _postAS(theMsg, targetId, myData, commentId) {
             var postURL = server + context + "/opensocial/" + node.login.authType;
             //
             //  Build the final URL
             //
             if (config.isEmbExp) {
                 postURL += "/rest/activitystreams/" + targetId + "/@all/@all?format=json";
             } else {
                 postURL += "/rest/ublog/" + targetId + "/@all" + commentId;
             }
             //	
             //	Dump to the Console
             //
             console.log("_postAS : Posting Event to ActivtyStream : " + postURL);
             console.log(JSON.stringify(myData, ' ', 2));
             //
             //  Issue the request
             //
             node.status({fill: "blue", shape: "dot", text: "Posting..."});
             node.login.request(
                 {
                     url: postURL, 
                     body: myData,
                     json: true,
                     method : 'POST',
                     headers: {"Content-Type" : "application/json"}
                 },
                 function (error, response, body) {
                     console.log('_postAS: executing on ' + postURL);
                     if (error) {
                         console.log("_postAS : error posting information to AS !");
                         console.log(JSON.stringify(error, ' ', 2));
                         node.status({fill: "red", shape: "dot", text: error.toString()});
                         node.error(error.toString(), theMsg);
                     } else {
                         if (response.statusCode >= 200 && response.statusCode < 300) {
                             console.log("_postA : POST OK (" + response.statusCode + ")");
                             console.log(body);
                             //
                             //  Need to parse the BODY as it is a string for the ublog API
                             //
                             //var json = JSON.parse(body);
                             //theMsg.status_url = json.entry.url;
                             theMsg.status_url = body.entry.url;
                             theMsg.payload = body;
                             node.status({});
                             node.send(theMsg);
                         } else {
                             console.log("_postAS NOT OK (" + response.statusCode + ")");
                             console.log(body);
                             console.log(postURL);
                             console.log(response.statusMessage);
                             node.status({fill: "red", shape: "dot", text: "Err3 " + response.statusMessage});
                             node.error(response.statusCode + ' : ' + response.statusMessage, theMsg);
                         }
                     }
                 }
             );
         }
 
         //
         //	This to avoid issues on Self-Signed Certificates on Test Sites
         //
         process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; 
        
         this.on('input', function(msg) {
             //
             //	Retrieving Configuration from LOGIN node
             //
             var serverConfig = RED.nodes.getNode(config.server);
             //
             //  Server is a GLOBAL variable
             //
             server = serverConfig.getServer;
             context =config.contextRoot.trim();
             var myData = {};
             var targetId = "";
             var commentId = "";            
             if (config.isEmbExp) {
                 //
                 //	Changing the name of the server in the payload message
                 //	This is required if the "$$$server$$$" macro has been used to create 
                 //  the payload.
                 //	The goal is to replace the macro with the actual NAME of the server
                 //
                 var tmp = JSON.stringify(msg.payload);
                 tmp = tmp.replace(/\$\$\$server\$\$\$/g, server);
                 myData = JSON.parse(tmp);
             } else {
                 //
                 //  Check if there is a message to send 
                 //
                 if ((config.status_update === '') && 
                     ((msg.payload === undefined) || (msg.payload === ''))) {
                     //
                     //  There is an issue
                     //
                     console.log("No Msg to be sent");
                     node.status({fill:"red",shape:"dot",text:"No Msg to be sentr"});
                     node.error('No Msg to be sent', msg);
                     return;
                  } else {
                     if (config.status_update !== '') {
                         myData.content = config.status_update;
                     } else {
                         myData.content = msg.payload;
                     }
                 }
                 //
                 //  Check if it is Comment
                 //
                 if (config.isComment) {
                     if ((config.postId === '') && 
                         ((msg.postId === undefined) || (msg.postId === ''))) {
                         //
                         //  There is an issue
                         //
                         console.log("Missing PostId Information");
                         node.status({fill:"red",shape:"dot",text:"Missing PostId"});
                         node.error('Missing PostId', msg);
                         return;
                      } else {
                         if (config.postId !== '') {
                             commentId = config.postId;
                         } else {
                             commentId = msg.postId;
                         } 
                         commentId = "/" + commentId + "/comments";
                      }
                 }
             }
             //
             //  Check to whom send the message
             //
             switch (config.target) {
                 case "myboard" :
                     targetId = "@me";
                     //
                     //  go and fetch the AS
                     //
                     _postAS(msg, targetId, myData, commentId);
                     break;
                 case "person" :
                     if ((config.userId === '') && 
                         ((msg.userId === undefined) || (msg.userId === ''))) {
                         //
                         //  There is an issue
                         //
                         console.log("Missing target user Information");
                         node.status({fill:"red",shape:"dot",text:"Missing Target User"});
                         node.error('Missing Target User', msg);
                         return;
                      } else {
                         if (config.userId !== '') {
                             targetId = config.userId;
                         } else {
                             targetId = msg.userId;
                         }
                     }
                     if (mailExp.test(targetId)) {
                         //
                         //  target is mail address. Need to find the corresponding Uuid
                         //
                         _postASFromMail(serverConfig.serverType, msg, targetId, myData, commentId, _postAS);
                     } else {
                         //
                         //  TargetID is the person UUid
                         //
                         targetId = 'urn:lsid:lconn.ibm.com:profiles.person:' + targetId;         
                         //
                         //  go and fetch the AS
                         //
                          _postAS(msg, targetId, myData, commentId);
                     }                        
                     break;               
                 case "community" :
                     if ((config.communityId === '') && 
                         ((msg.communityId === undefined) || (msg.communityId === ''))) {
                         //
                         //  There is an issue
                         //
                         console.log("Missing target community Information");
                         node.status({fill:"red",shape:"dot",text:"Missing Target Community"});
                         node.error('Missing Target Community', msg);
                      } else {
                         if (config.communityId !== '') {
                             targetId = config.communityId;
                         } else {
                             targetId = msg.communityId;
                         }
                         targetId = 'urn:lsid:lconn.ibm.com:communities.community:' + targetId;
                         //
                         //  go and fetch the AS
                         //
                          _postAS(msg, targetId, myData, commentId);
                     }
                     break;
             }
         });
     }
     
     RED.nodes.registerType("ICASPut", ICASPut);
 
 
     function ICASGet(config) {
         RED.nodes.createNode(this, config);
         //
         //  Global to access the custom HTTP Request object available from the
         //  ICLogin node
         //
         this.login = RED.nodes.getNode(config.server);
         var node = this;
 
         var mailExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
         var xml2js = require("xml2js");
         var parser = new xml2js.Parser();
         var server = "";
         var context = "";
 
         function _getDate(fromConfig, fromMsg, label) {
             var datePattern = /(\d{2})\/(\d{2})\/(\d{4})((\s|T)(\d{2}):(\d{2}):(\d{2}))?/;
             if ((fromConfig == '') && ((fromMsg == undefined) || (fromMsg == ''))) {
                 //
                 //  There is an issue
                 //
                 node.status({
                     fill: "red",
                     shape: "dot",
                     text: "Missing " + label + " Date"
                 });
                 //node.error("Missing " + label + " Date", theMsg);
                 if (label == "Since") {
                     return new Date('01/01/1970');
                 } else {
                     return new Date();
                 }
             } else {
                 var bb;
                 if (fromConfig != '') {
                     bb = fromConfig;
                 } else {
                     bb = fromMsg;
                 }
                 if (bb.replace(datePattern, '$5') === '') {
                     bb = bb.replace(datePattern, '$3-$2-$1');
                 } else {
                     bb = bb.replace(datePattern, '$3-$2-$1$5$6:$7:$8');
                 }
                 return new Date(bb);
             }
         }
 
         function _getDateConstraints(sinceDate, untilDate) {
             var isoDateSince = new Date(sinceDate).toISOString();
             var isoDateUntil = new Date(untilDate).toISOString();
             return "&dateFilter={'from':'" + isoDateSince + "','to':'" + isoDateUntil + "','fromInclusive':true,'toInclusive':true}}";
         }
 
         function _getASFromMail(serverType, theMsg, targetId, module, constraints, cb) {
             var theURL = server + "/profiles";
             if (node.login.authType === "oauth") theURL += '/oauth';
             if (serverType == "cloud") {
                 theURL += "/atom/search.do?search=" + targetId;
             } else {
                 theURL += "/atom/profile.do?email=" + targetId;
             }
             node.login.request(
                 {
                     url: theURL, 
                     method : "GET",
                     headers: {"Content-Type" : "application/atom+xml"}
                 },
                 function(error, response, body) {
                     console.log('ASGet: executing on ' + theURL);
                     if (error) {
                         console.log("error getting information for profile !" + targetId);
                         node.status({fill:"red",shape:"dot",text:"Err1"});
                         node.error(error.toString(), theMsg);
                     } else {
                         if (response.statusCode >= 200 && response.statusCode < 300) {  
                             console.log("GET OK (" + response.statusCode + ")");
                             console.log(body);
                             //
                             //	Have the node to emit the URL of the newly created event
                             //
                             parser.parseString(body, function (err, result) {
                                 if (err) {
                                     node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                     node.error("Parser Error getting the AS", theMsg);
                                     console.log("Parser Error getting the AS");
                                     console.log(err);
                                     return;
                                 }
                                 if (result.feed.entry && result.feed.entry[0]) {
                                     node.status({fill:"green",shape:"dot",text:"mail translated"});
                                     //
                                     //  Now we have the person UUid
                                     //
                                     var newTarget = "urn:lsid:lconn.ibm.com:profiles.person:" + result.feed.entry[0].contributor[0]['snx:userid'][0] + "/@involved";
                                     //
                                     //  go and fetch the AS
                                     //
                                     cb(theMsg, newTarget, module, constraints);
                                 } else {
                                     node.status({fill:"red",shape:"dot",text:"No Entry"});
                                     node.error('Err2', theMsg);
                                     console.log("Parser Error getting the AS - no ENTRY");
                                     console.log(result);
                                 }
                             });
                         } else {
                             console.log("GET PROFILE NOT OK (" + response.statusCode + ")");
                             console.log(body);
                             node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                             node.error(response.statusCode + ' : ' + response.body, theMsg);
                         } 
                     }
                 } 
             );
         }
 
         function _getAS(theMsg, targetId, module, constraints) {
             var getURL = server + context + "/opensocial/";
             getURL += node.login.authType + "/rest/activitystreams/" + targetId;
             getURL += module;
             getURL += "?format=json&rollup=true";
             getURL += constraints;
             if (config.count) {
                getURL += "&count="+config.count;
             }
             node.status({fill: "blue", shape: "dot", text: "Retrieving..."});
             console.log(getURL);
             node.login.request({
                     url: getURL,
                     method: "GET",
                     headers: {"Content-Type" : "application/json"}
                 },
                 function (error, response, body) {
                     console.log('_getAS: executing on ' + getURL);
                     if (error) {
                         console.log("_getAS : error getting information for AS ! " + error);
                         node.status({fill: "red", shape: "dot", text: "No AS"});
                         node.error(error.toString(), theMsg);
                     } else {
                         if (response.statusCode >= 200 && response.statusCode < 300) {
                             theMsg.payload = JSON.parse(body).list;
                             node.send(theMsg);
                             node.status({});
                         } else {
                             console.log("_GetAS  NOT OK (" + response.statusCode + ")");
                             console.log(body);
                             node.status({fill: "red", shape: "dot", text: "Err3 " + response.statusMessage});
                             node.error(response.statusCode + ' : ' + response.body, theMsg);
                         }
                     }
                 }
             );
         }
 
         this.on('input', function (msg) {
             var serverConfig = RED.nodes.getNode(config.server);
             //
             //  Server is a GLOBAL variable
             //
             server = serverConfig.getServer;
             context =config.contextRoot.trim();
             //
             //  Get the Dates if present
             //
             var sinceDate = new Date('01/01/1970');
             var untilDate = new Date();
             var constraints = '';
             if (config.sinceCB) {
                 sinceDate = _getDate(config.sinceDate, msg.sinceDate, 'Since');
                 if (config.untilCB) {
                     untilDate = _getDate(config.untilDate, msg.untilDate, 'Until');
                 } else {
                     //
                     //  No Until DAte .
                     //  So, we consider up to NOW
                     //
                     untilDate = new Date();
                     console.log('ASGet : no UNTIL date');
                 }
                 constraints = _getDateConstraints(sinceDate, untilDate);
                 console.log('ASGet - since ' + sinceDate);
                 console.log('ASGet - until ' + untilDate);
             } else {
                 console.log('ASGet : no SINCE date');
             }
             //
             //  Get the Module Switch
             //
             var module = '';
             if (config.module !== "All") {
                 module = "/" + config.module;
             } else {
                 module = "/@all";
             }
             //
             //  check the value of the target
             //
             var targetId = "";
             switch (config.target) {
                 case "myboard" :
                     targetId = "@me/@all";
                     //
                     //  go and fetch the AS
                     //
                      _getAS(msg, targetId, module, constraints);
                     break;
                 case "person" :
                     if ((config.userId === '') && 
                         ((msg.userId === undefined) || (msg.userId === ''))) {
                         //
                         //  There is an issue
                         //
                         console.log("Missing target user Information");
                         node.status({fill:"red",shape:"dot",text:"Missing Target User"});
                         node.error('Missing Target User', msg);
                         return;
                      } else {
                         if (config.userId != '') {
                             targetId = config.userId;
                         } else {
                             targetId = msg.userId;
                         }
                     }
                     if (mailExp.test(targetId)) {
                         //
                         //  target is mail address. Need to find the corresponding Uuid
                         //
                         _getASFromMail(serverConfig.serverType, msg, targetId, module, constraints, _getAS);
                     } else {
                         //
                         //  TargetID is the person UUid
                         //
                         targetId = 'urn:lsid:lconn.ibm.com:profiles.person:' + targetId + "/@involved";         
                         //
                         //  go and fetch the AS
                         //
                          _getAS(msg, targetId, module, constraints);
                     }                        
                     break;
                 case "community" :
                     if ((config.communityId === '') && 
                         ((msg.communityId === undefined) || (msg.communityId === ''))) {
                         //
                         //  There is an issue
                         //
                         console.log("Missing target community Information");
                         node.status({fill:"red",shape:"dot",text:"Missing Target Community"});
                         node.error('Missing Target Community', msg);
                      } else {
                         if (config.communityId != '') {
                             targetId = config.communityId;
                         } else {
                             targetId = msg.communityId;
                         }
                         targetId = 'urn:lsid:lconn.ibm.com:communities.community:' + targetId + "/@all";
                         //
                         //  go and fetch the AS
                         //
                          _getAS(msg, targetId, module, constraints);
                     }
                     break;
             }
         });
     }
 
     RED.nodes.registerType("ICASGet", ICASGet);
 
 };
 
