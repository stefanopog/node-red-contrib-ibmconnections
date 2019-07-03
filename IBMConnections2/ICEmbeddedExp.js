/*
Copyright IBM All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

module.exports = function(RED) {
    const ICX = require('./common.js');
    const __isDebug = ICX.__getDebugFlag();
    const __moduleName = 'IC_EmbeddedExperience';

    const mailExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    const xml2js = require("xml2js");
  
    console.log("*****************************************");
    console.log("* Debug mode is " + (__isDebug ? "enabled" : "disabled") + ' for module ' + __moduleName);
    console.log("*****************************************");


    function _getDateConstraints(sinceDate, untilDate) {
        var isoDateSince = new Date(sinceDate).toISOString();
        var isoDateUntil = new Date(untilDate).toISOString();
        return "&dateFilter={'from':'" + isoDateSince + "','to':'" + isoDateUntil + "','fromInclusive':true,'toInclusive':true}}";
    }

    function _getDateConstraints2(sinceDate, untilDate) {
        var isoDateSince = new Date(sinceDate).toISOString();
        var isoDateUntil = new Date(untilDate).toISOString();
        return "&updatedSince=" + isoDateSince + "&updatedBefore" + isoDateUntil;
    }

    async function _getAS(loginNode, getURL, targetId) {
        var __msgText = 'error getting ActivityStream for ' + targetId;
        var __msgStatus = 'No getActivityStream';
        try {
            ICX.__log(__moduleName, true, '_getAS: executing on ' + getURL);
            let response = await loginNode.rpn(
                {
                    url: getURL,
                    method: "GET",
                    headers: {"Content-Type": "application/json"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "_getAS OK", response);
            //
            //	We got the ActivityStream. Check we really do not have errors
            //  Now parse it
            //
            return JSON.parse(response).list;
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "_getAS : " + __msgText, error);
            throw error;
        }
    }

    function ICASPut(config) {      
         RED.nodes.createNode(this,config);        
         //
         //  Global to access the custom HTTP Request object available from the
         //  ICLogin node
         //
         this.login = RED.nodes.getNode(config.server);
         var node = this;
 
         var parser = new xml2js.Parser();
         var server = node.login.getServer;
         var context = config.contextRoot.trim();
 
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

        var server = node.login.getServer;
        var context = config.contextRoot.trim();
        if (node.login.serverType === 'cloud') context = '/connections';

        this.on('input', function (msg) {
            //
            //  Get the Dates if present
            //
            var defaultString = "?format=json&rollup=true";
            var sinceDate;
            var untilDate;
            var constraintsString = '';
            if (config.sinceCB) {
                sinceDate = ICX.__getOptionalInputDate(__moduleName, config.sinceDate, msg.sinceDate, msg.IC_sinceDate, true, node);
            } else {
                //
                //  No Since Date. So we consider the initial Unix date
                //
                sinceDate = new Date('02/01/1970');
                ICX.__log(__moduleName, __isDebug, 'ASGet : forcing SINCE date to 01/01/1970');
            }
            if (config.untilCB) {
                untilDate = ICX.__getOptionalInputDate(__moduleName, config.untilDate, msg.untilDate, msg.IC_untilDate, false, node);
            } else {
                //
                //  No Until Date. So, we consider up to NOW
                //
                untilDate = new Date();
                ICX.__log(__moduleName, __isDebug, 'ASGet : forcing UNTIL date to NOW');
            }
            if (config.target === 'person') {
                constraintsString = _getDateConstraints2(sinceDate, untilDate);
            } else {
                constraintsString = _getDateConstraints(sinceDate, untilDate);
            }
            ICX.__logJson(__moduleName, __isDebug, 'ASGet: Constraints Dates', constraintsString);
            //
            //  Get the facets
            //
            var facetArray = [];
            var facetString = '';
            var hotTopicsFacet = ICX.__getOptionalInputInteger(__moduleName, config.facetHotTopics, msg.IC_hotTopicsFacet, 'Hot Topics Facet', node);
            if (hotTopicsFacet > 0) {
                facetArray.push('{hot_topics:' + hotTopicsFacet + '}');
            }
            var peopleFacet = ICX.__getOptionalInputInteger(__moduleName, config.facetPeople, msg.IC_peopleFacet, 'People Facet', node);
            if (peopleFacet > 0) {
                facetArray.push('{people:' + peopleFacet + '}');
            }
            var communitiesFacet = ICX.__getOptionalInputInteger(__moduleName, config.facetCommunities, msg.IC_communitiesFacet, 'Communities Facet', node);
            if (communitiesFacet > 0) {
                facetArray.push('{communities:' + communitiesFacet + '}');
            }
            if (facetArray.length > 0) {
                facetString = '&[' + facetArray.join(',') + ']';
            }
            //
            //  get The Query
            //
            var queryString = ICX.__getOptionalInputInteger(__moduleName, config.query, msg.IC_query, 'Query String', node);
            if (queryString) queryString = '&' + queryString;
            //
            //  count Parameter
            //
            var count = ICX.__getOptionalInputInteger(__moduleName, config.count, msg.IC_numberOfEvents, 'Number of Events', node);
            var countString = '';
            if (count > 0) countString = '&count=' + count;
            //
            //  Get the Module Switch
            //
            var theModule = '';
            if (config.module !== "All") {
                theModule = "/" + config.module;
            } else {
                theModule = "/@all";
            }
            //
            //  Establish the process based on the value of the target
            //
            var targetId = "";
            var getURL = server + context + "/opensocial/" + node.login.authType + "/rest/activitystreams/";
            node.status({fill: "blue", shape: "dot", text: "Retrieving..."});
            switch (config.target) {
                case "myactions":
                    break;
                case "myboard" :
                    if (theModule === '@status') {
                        //
                        //  Selector for which kind of status but no Application
                        //
                        targetId = "@me/" + config.myGroup2;
                        getURL += targetId + defaultString + constraintsString;
                    } else {
                        //
                        //  in this case, myGroup0 = @all and we add application
                        //
                        targetId = "@me/" + config.myGroup0;
                        getURL += targetId + theModule + defaultString + constraintsString;
                    }
                    //
                    //  go and fetch the AS
                    //
                    _getAS(node.login, getURL, targetId).then(async function(myData) {
                        try {
                            if (myData) {
                                node.status({});
                                msg.payload = myData;
                            } else {
                                node.status({fill: "yellow", shape: "dot", text: "No Entry "});
                                msg.payload = null;
                            }
                            node.send(msg);
                        } catch(error) {
                            ICX.__logError(__moduleName, "ERROR INSIDE getting myboard", null, error, msg, node);
                        }
                    })
                    .catch(error => {
                        ICX.__logError(__moduleName, "ERROR getting myboard", null, error, msg, node);
                    });
                    break;
                case "person" :
                    targetId = ICX.__getMandatoryInputString(__moduleName, config.userId, msg.IC_userId, '', 'userId', msg, node);
                    if (!targetId) {
                        //
                        //  Trying with old syntax
                        //
                        targetId = ICX.__getMandatoryInputString(__moduleName, config.userId, msg.userId, '', 'userId', msg, node);
                        if (!targetId) return;
                    }
                    if (mailExp.test(targetId)) {
                        //
                        //  target is mail address. Need to find the corresponding Uuid
                        //
                        node.login.getUserInfosFromMail(targetId, false, false, false, false).then(async function(myData) {
                            try {
                                if (myData) {
                                    getURL += 'urn:lsid:lconn.ibm.com:profiles.person:' + myData.userid + '/@involved' + theModule + defaultString + constraintsString;
                                    let myData2 = await _getAS(node.login, getURL, targetId);
                                    node.status({});
                                    msg.payload = myData2;
                                } else {
                                    node.status({fill: "yellow", shape: "dot", text: "User " + targetId + " not recognized"});
                                    msg.payload = null;
                                }
                                node.send(msg);
                            } catch(error) {
                                ICX.__logError(__moduleName, "ERROR INSIDE getting person board", null, error, msg, node);
                            }
                        })
                        .catch(error => {
                            ICX.__logError(__moduleName, "ERROR getting person board", null, error, msg, node);
                        });
                    } else {
                        //
                        //  TargetID is the person UUid
                        //
                        targetId = 'urn:lsid:lconn.ibm.com:profiles.person:' + targetId + "/@involved";         
                        getURL += targetId + theModule + defaultString + constraintsString;
                        //
                        //  go and fetch the AS
                        //
                        _getAS(node.login, getURL, targetId).then(async function(myData) {
                            try {
                                if (myData) {
                                    node.status({});
                                    msg.payload = myData;
                                } else {
                                    node.status({fill: "yellow", shape: "dot", text: "User " + targetId + " not recognized"});
                                    msg.payload = null;
                                }
                                node.send(msg);
                            } catch(error) {
                                ICX.__logError(__moduleName, "ERROR INSIDE getting person board", null, error, msg, node);
                            }
                        })
                        .catch(error => {
                            ICX.__logError(__moduleName, "ERROR getting person board", null, error, msg, node);
                        });
                    }                        
                    break;
                case "community" :
                    targetId = ICX.__getMandatoryInputString(__moduleName, config.communityId, msg.IC_communityId, '', 'communityId', msg, node);
                    if (!targetId) {
                        //
                        //  Trying with old syntax
                        //
                        targetId = ICX.__getMandatoryInputString(__moduleName, config.communityId, msg.communityId, '', 'communityId', msg, node);
                        if (!targetId) return;
                    }
                    targetId = 'urn:lsid:lconn.ibm.com:communities.community:' + targetId + "/@all";
                    getURL += targetId + theModule + defaultString + constraintsString;
                    //
                    //  go and fetch the AS
                    //
                    _getAS(node.login, getURL, targetId).then(async function(myData) {
                        try {
                            if (myData) {
                                node.status({});
                                msg.payload = myData;
                            } else {
                                node.status({fill: "yellow", shape: "dot", text: "No Entry "});
                                msg.payload = null;
                            }
                            node.send(msg);
                        } catch(error) {
                            ICX.__logError(__moduleName, "ERROR INSIDE getting community board", null, error, msg, node);
                        }
                    })
                    .catch(error => {
                        ICX.__logError(__moduleName, "ERROR getting community board", null, error, msg, node);
                    });
                    break;
            }
        });
    }
 
     RED.nodes.registerType("ICASGet", ICASGet);
 
 };
 
