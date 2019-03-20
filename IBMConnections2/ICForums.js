/*
Copyright IBM All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

module.exports = function(RED) {
    var __isDebug = process.env.ICDebug || false;
    var __moduleName = 'IC_Forums';
  
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

    function _compareValues(key, order = 'asc') {
        //  
        //  Array sort function
        //  This was taken by the excellent article from Olayinka Omole (https://www.sitepoint.com/author/oomole/)
        //  which is featured here : https://www.sitepoint.com/sort-an-array-of-objects-in-javascript/
        //
        return function (a, b) {
            if (!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) {
                //
                //  property doesn't exist on either object
                //
                return 0;
            }

            const varA = (typeof a[key] === 'string') ?
                a[key].toUpperCase() : a[key];
            const varB = (typeof b[key] === 'string') ?
                b[key].toUpperCase() : b[key];

            let comparison = 0;
            if (varA > varB) {
                comparison = 1;
            } else if (varA < varB) {
                comparison = -1;
            }
            return (
                (order == 'desc') ? (comparison * -1) : comparison
            );
        };
    }

    function ICparseCommunityAtomEntry(result, isAtom) {
        var myData = [];
        //
        //  Start Processing
        //
        if (result.feed.entry) {
            for (let i=0; i < result.feed.entry.length; i++) {
                myData.push(_parseForumAtomEntry(result.feed.entry[i], isAtom));
            }
        }
        return myData;
    }

    function ICparseForumAtomEntry(result, isAtom) {
        var myData = [];
        //
        //  Start Processing
        //
        myData.push(_parseForumAtomEntry(result.entry, isAtom));
        return myData;
    }

    function ICparseTopicAtomEntryList(result, isAtom) {
        var myData = [];
        //
        //  Start Processing
        //
        if (result.feed.entry) {
            for (let i=0; i < result.feed.entry.length; i++) {
                myData.push(_parseTopicAtomEntry(result.feed.entry[i], isAtom));
            }
        }
        return myData;
     }

     function ICparseTopicAtomEntry(result, isAtom) {
        var myData = [];
        //
        //  Start Processing
        //
        myData.push(_parseTopicAtomEntry(result.entry, isAtom));
        return myData;
     }

    function _parseForumAtomEntry(entry, isAtom) {
        var xml2js = require("xml2js");
        //var parser = new xml2js.Parser();
        var builder  = new xml2js.Builder({rootName: "entry"});
        var forum = {};
        //console.log(JSON.stringify(entry, ' ', 2));
        //
        //  Start Processing
        //
        forum.title = entry.title[0]['_'];
        forum.id = entry.id[0].replace('urn:lsid:ibm.com:forum:', '');
        forum.updated = entry.updated[0];
        forum.published = entry.published[0];
        forum.authors = [];
        for (let k=0; k < entry.author.length; k++) {
            let tmp = {};
            tmp.name = entry.author[k].name[0];
            tmp.id = entry.author[k]['snx:userid'][0]['_'];
            forum.authors.push(tmp);
        }
        if (entry["snx:communityUuid"]) {
            forum.communityUuid = entry["snx:communityUuid"][0]['_'];
        } else {
            forum.communityUuid = null;
        }
        forum.links = [];
        for (let k=0; k < entry.link.length; k++) {
            let tmp = {};
            tmp.rel = entry.link[k]['$'].rel;
            tmp.type = entry.link[k]['$'].type;
            tmp.href = entry.link[k]['$'].href;
            if (entry.link[k]['$'].title) {
                tmp.title = entry.link[k]['$'].title;
            } else {
                tmp.title = null;
            }
            forum.links.push(tmp);
            if (tmp.rel === 'self') forum.ref = tmp.href;
            if (tmp.rel === 'replies') {
                forum.topics = tmp.href;
                forum.replies = tmp.href.replace('/topics?', '/entries?')
            }
        }
        forum.categories = [];
        for (let k=0; k < entry.category.length; k++) {
            let tmp = {};
            tmp.term = entry.category[k]['$'].term;
            if (entry.category[k]['$'].scheme) {
                tmp.scheme = entry.category[k]['$'].scheme;
            }
            if (entry.category[k]['$'].label) {
                tmp.label = entry.category[k]['$'].label;
            }
            forum.categories.push(tmp);
        }
        if (isAtom) {
            forum.entry = builder.buildObject(entry);
        }
        return forum;
    }


    function _parseTopicAtomEntry(feedEntry, isAtom) {
        var xml2js = require("xml2js");
        //var parser = new xml2js.Parser();
        var builder  = new xml2js.Builder({rootName: "entry"});
        var entry = {};
        //console.log(JSON.stringify(feedEntry, ' ', 2));
        //
        //  Start Processing
        //
        entry.title      = feedEntry.title[0]['_'];
        entry.id         = feedEntry.id[0].replace('urn:lsid:ibm.com:forum:', '');
        entry.isQuestion = false;
        entry.isAnswered = false;
        entry.isAnswer   = false;
        entry.isReply    = false;
        entry.isTopic    = false;
        entry.youLikedIt = true;
        entry.updated    = feedEntry.updated[0];
        if (feedEntry.published) entry.published  = feedEntry.published[0];
        entry.replyTo    = {};
        entry.tags       = [];
        entry.recommendations = 0;
        entry.totalRecommendations = 0;
        if (feedEntry['thr:in-reply-to']) {
            entry.replyTo.href = feedEntry['thr:in-reply-to'][0]['$'].href;
            entry.replyTo.ref  = feedEntry['thr:in-reply-to'][0]['$'].ref.replace('urn:lsid:ibm.com:forum:', '');
        }
        entry.authors    = [];
        for (let k=0; k < feedEntry.author.length; k++) {
            let tmp = {};
            tmp.name = feedEntry.author[k].name[0];
            tmp.id = feedEntry.author[k]['snx:userid'][0]['_'];
            entry.authors.push(tmp);
        }
        if (feedEntry["snx:communityUuid"]) {
            entry.communityUuid = feedEntry["snx:communityUuid"][0]['_'];
        } else {
            entry.communityUuid = null;
        }
        entry.links     = [];
        for (let k=0; k < feedEntry.link.length; k++) {
            let tmp = {};
            tmp.rel = feedEntry.link[k]['$'].rel;
            tmp.type = feedEntry.link[k]['$'].type;
            tmp.href = feedEntry.link[k]['$'].href;
            if (feedEntry.link[k]['$'].title) {
                tmp.title = feedEntry.link[k]['$'].title;
            } else {
                tmp.title = null;
            }
            if (tmp.rel === 'self') entry.href = tmp.href;
            if (tmp.rel === 'replies') entry.repliesFeed = tmp.href;
            if (tmp.rel === 'recommendations') entry.recommendations = feedEntry.link[k]['$']['snx:recommendation'];
            entry.links.push(tmp);
        }
        entry.categories = [];
        for (let k=0; k < feedEntry.category.length; k++) {
            let tmp = {};
            tmp.term = feedEntry.category[k]['$'].term;
            if (feedEntry.category[k]['$'].scheme) {
                tmp.scheme = feedEntry.category[k]['$'].scheme;
                if (tmp.scheme === 'http://www.ibm.com/xmlns/prod/sn/flags') {
                    if (tmp.term === 'question') {
                        entry.isQuestion = true;
                    }
                    if (tmp.term === 'answered') {
                        entry.isAnswered = true;
                    }
                    if (tmp.term === 'answer') {
                        entry.isAnswer = true;
                    }
                    if (tmp.term === 'NotRecommendedByCurrentUser') {
                        entry.youLikedIt = false;
                    }
                    if (tmp.term === 'ThreadRecommendationCount') {
                        entry.totalRecommendations = feedEntry.category[k]['$'].label;
                    }
                }
                if (tmp.scheme === 'http://www.ibm.com/xmlns/prod/sn/type'){
                    if (tmp.term === 'forum-reply') {
                        entry.isReply = true;
                    }
                    if (tmp.term === 'forum-topic') {
                        entry.isTopic = true;
                    }
                }
            }
            if (feedEntry.category[k]['$'].label) {
                tmp.label = feedEntry.category[k]['$'].label;
            }
            if (!tmp.scheme && !tmp.label) {
                //
                //  This is a tag
                //
                entry.tags.push(tmp.term);
            }
            entry.categories.push(tmp);
        }
        if (isAtom) {
            entry.feedEntry = builder.buildObject(feedEntry);
        }
        if (!entry.isQuestion) delete(entry.isQuestion);
        if (!entry.isAnswered) delete(entry.isAnswered);
        if (!entry.isAnswer) delete(entry.isAnswer);
        if (!entry.isReply) {
            delete(entry.isReply);
            delete(entry.replyTo);
        }
        if (!entry.isTopic) delete(entry.isTopic);
        if (!entry.youLikedIt) delete(entry.youLikedIt)
        return entry;
    }
    
    function ICForumsGet(config) {      
        RED.nodes.createNode(this,config);   
        //
        //  Global to access the custom HTTP Request object available from the
        //  ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		var node = this;
 
        var xml2js   = require("xml2js");
        var parser   = new xml2js.Parser();
        var async = require("async");
        var asyncTasks = [];
        
        var _dummyCallback = function(err, item) {
            console.log('ICForumsGet._dummyCallback : ' + item);
        }
      
        function _beforeSend(theMsg) {
            console.log('ICForumsGet._beforeSend: need to process ' + asyncTasks.length + ' async tasks...');
            //
            //  This is where the MAGIC of Async happens
            //
            if (asyncTasks.length > 0) {
                async.parallel(asyncTasks, 
                               function(err, results) {
                                    //
                                    // All tasks are done now
                                    //  We can return
                                    //
                                    console.log("ICForumsGet._beforeSend : ready to send final information....");
                                    node.send(theMsg);
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
        
        function _likeForumAPI(theMsg, theURL, isAtom, theProcessor, isLike) {
            var method = "POST";
            var announce = 'liking';
            var payload = '<entry xmlns="http://www.w3.org/2005/Atom"><title type="text">unlike</title><content type="text">reply test</content><category scheme="http://www.ibm.com/xmlns/prod/sn/type" term="recommendation"></category></entry>';
    
            if (!isLike) {
                method = "DELETE";
                announce = 'unliking';
            }
            node.status({fill:"blue", shape:"dot", text: announce + "..."});
            node.login.request(
               {
                   url: theURL, 
                   method: method,
                   body : payload,
                   headers:{"Content-Type" : "application/atom+xml; charset=UTF-8"}
               },
               function(error, response, body) {
                   console.log('_likeForumAPI: executing on ' + theURL);
                   console.log('_likeForumAPI: posting body ' + payload);
                   if (error) {
                       console.log("_likeForumAPI : error " + announce + " the entry !");
                       node.status({fill:"red", shape:"dot", text:"error " + announce + " the entry !"});
                       node.error(error, theMsg);
                       return;
                   } else {
                       if (response.statusCode >= 200 && response.statusCode < 300) {
                           //
                           //	Have the node to emit the URL of the newly created event
                           //
                           parser.parseString(body, function (err, result) {
                                if (err) {
                                   console.log(err);
                                   node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                   node.error("_likeForumAPI: Parser Error", theMsg);
                                   return;
                                }
                                if (isLike) {
                                    if (result.entry) {
                                        var myData = [];
                                        myData.push(_parseTopicAtomEntry(result.entry, isAtom));
                                        theMsg.payload = myData;
                                        node.status({fill:"green", shape:"dot", text: announce + " Succesfully performed"});
                                        node.send(theMsg);
                                    } else {
                                        console.log('_likeForumAPI: No ENTRY found for URL : ' + theURL);
                                        node.status({fill:"red",shape:"dot", text:"No Entry for " + theURL});
                                        node.error('_likeForumAPI: Missing <ENTRY>', theMsg);
                                    }
                                } else {
                                    delete (theMsg.payload);
                                    node.status({fill:"green", shape:"dot", text: announce + " Succesfully performed"});
                                    node.send(theMsg);
                                }
                           });
                       } else {
                           console.log("_likeForumAPI NOT OK (" + response.statusCode + ")");
                           console.log(body);
                           node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                           node.error(response.statusCode + ' : ' + response.body, theMsg);
                       }
                   }
               }
           );           
        }
    
        
        function _acceptForumAPI(theMsg, theURL, isAccept) {
            node.status({fill:"blue", shape:"dot", text: "Getting the Reply..."});
            node.login.request(
                {
                    url: theURL, 
                    method: "GET",
                    headers:{"Content-Type" : "application/atom+xml; charset=UTF-8" }
                },
                function(error, response, body) {
                    console.log('_acceptForumAPI: executing on ' + theURL);
                    if (error) {
                        console.log("_acceptForumAPI : error getting information for Reply !");
                        node.status({fill:"red",shape:"dot",text:"No Reply"});
                        node.error(error.toString(), error);
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            //
                            //	And NOW accept or reject
                            //
                            let announce = null;
                            let newPayload = null;
                            if (isAccept) {
                                announce = 'accepting';
                                newPayload = body.replace('</source>', '</source><category scheme="http://www.ibm.com/xmlns/prod/sn/flags" term="answer"/>');
                            } else {
                                announce = 'rejecting';
                                newPayload = body.replace('<category scheme="http://www.ibm.com/xmlns/prod/sn/flags" term="answer"/>', '');
                                //
                                //  Trying a different XML syntax ...
                                //
                                newPayload = newPayload.replace('<category term="answer" scheme="http://www.ibm.com/xmlns/prod/sn/flags"></category>','');
                            }
                            node.status({fill:"blue", shape:"dot", text: announce + "..."});
                            node.login.request(
                                {
                                    url: theURL, 
                                    method: 'PUT',
                                    body : newPayload,
                                    headers:{"Content-Type" : "application/atom+xml; charset=UTF-8"}
                                },
                                function(error2, response2, body2) {
                                    console.log('_acceptForumAPI: executing on ' + theURL);
                                    console.log('_acceptForumAPI: posting body ' + newPayload);
                                    if (error) {
                                        console.log("_acceptForumAPI : error " + announce + " the reply !");
                                        node.status({fill:"red", shape:"dot", text:"error " + announce + " the reply !"});
                                        node.error(error2, theMsg);
                                        return;
                                    } else {
                                        if (response2.statusCode >= 200 && response2.statusCode < 300) {
                                            //
                                            //	Have the node to emit the URL of the newly created event
                                            //
                                            parser.parseString(body2, function (err, result) {
                                                if (err) {
                                                    console.log(err);
                                                    node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                                    node.error("_acceptForumAPI: Parser Error", theMsg);
                                                    return;
                                                }
                                                delete (theMsg.payload);
                                                node.status({fill:"green", shape:"dot", text: announce + " Succesfully performed"});
                                                node.send(theMsg);
                                            });
                                        } else {
                                            console.log("_acceptForumAPI NOT OK (" + response2.statusCode + ")");
                                            console.log(body2);
                                            node.status({fill:"red",shape:"dot",text:"Err3 " + response2.statusMessage});
                                            node.error(response2.statusCode + ' : ' + response2.body, theMsg);
                                        }
                                    }
                                }
                            );           
                        } else {
                            console.log("_acceptForumAPI: Status NOT OK (" + response.statusCode + ")" + response.statusMessage);
                            console.log(JSON.stringify(body, ' ', 2));
                            node.status({fill:"red",shape:"dot",text:"_acceptForumAPI: " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        }
                    }
                }
            );           
        }


        function _getForumAPI(theMsg, theURL, isAtom, theProcessor, sortKey, sortOrder, itemNumber, callback) {
            node.login.request(
                {
                    url: theURL, 
                    method: "GET",
                    headers:{"Content-Type" : "application/atom+xml; charset=UTF-8" }
                },
                function(error, response, body) {
                    console.log('_getForumAPI: executing on ' + theURL);
                    if (error) {
                        console.log("_getForumAPI : error getting information for CommunityForums !");
                        node.status({fill:"red",shape:"dot",text:"No CommunityForums"});
                        node.error(error.toString(), error);
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            //
                            //	Parse the body
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log("_getForumAPI: error parsing Body of CommunityForums");
                                    console.log(JSON.stringify(err, ' ', 2));
                                    node.status({fill:"red",shape:"dot",text:"Parser Error for CommunityForums"});
                                    node.error("_getForumAPI: Parser Error _getForumAPI", error);
                                } else {
                                    let myData = theProcessor(result, isAtom);
                                    let outData = [];   
                                    if (myData.length > 0) {
                                        node.status({fill:"green",shape:"dot",text:"Forum topic retrieved"});
                                        if (sortKey) {
                                            outData = myData.sort(_compareValues(sortKey, sortOrder));
                                        } else {
                                            outData = myData;
                                        }
                                    } else {
                                        console.log('_getForumAPI: No ENTRY found for URL : ' + theURL);
                                        node.status({fill:"yellow", shape:"dot", text:"No Entry found"});
                                    }
                                    if (itemNumber >= 0) {
                                        theMsg.payload[itemNumber].replies = outData;
                                        theMsg.payload[itemNumber].numberOfReplies = outData.length;
                                        callback(null, theURL);
                                    } else {
                                        theMsg.payload = outData;
                                        node.send(theMsg);
                                    }
                                }
                            });
                        } else {
                            console.log("_getForumAPI: Status NOT OK (" + response.statusCode + ")" + response.statusMessage);
                            console.log(JSON.stringify(body, ' ', 2));
                            node.status({fill:"red",shape:"dot",text:"_getForumAPI: " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        }
                    }
                }
            );           
        }

        function _getRecursiveForumAPI(theMsg, theURL, isAtom, theProcessor1, theProcessor2, sortKey, sortOrder) {
            node.login.request(
                {
                    url: theURL, 
                    method: "GET",
                    headers:{"Content-Type" : "application/atom+xml; charset=UTF-8" }
                },
                function(error, response, body) {
                    console.log('_getRecursiveForumAPI: executing on ' + theURL);
                    if (error) {
                        console.log("_getRecursiveForumAPI : error getting information for CommunityForums !");
                        node.status({fill:"red",shape:"dot",text:"No CommunityForums"});
                        node.error(error.toString(), error);
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            //
                            //	Parse the body
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log("_getRecursiveForumAPI: error parsing Body of CommunityForums");
                                    console.log(JSON.stringify(err, ' ', 2));
                                    node.status({fill:"red",shape:"dot",text:"Parser Error for CommunityForums"});
                                    node.error("_getRecursiveForumAPI: Parser Error _getRecursiveForumAPI", error);
                                } else {
                                    var myData = theProcessor1(result, isAtom);   
                                    if (myData.length > 0) {
                                        node.status({fill:"green", shape:"dot", text:"Forum topic retrieved"});
                                        if (sortKey) {
                                            theMsg.payload = myData.sort(_compareValues(sortKey, sortOrder));
                                        } else {
                                            theMsg.payload = myData;
                                        }
                                        //
                                        //  Now we have some Entries.
                                        //  They correspond to Topics.
                                        //  We want to get the REPLIES for each of those topics
                                        //
                                        for (let k=0; k < myData.length; k++) {
                                            if (theMsg.payload[k].repliesFeed) {
                                                console.log('_getRecursiveForumAPI: queuing async task for replies: ' + theMsg.payload[k].repliesFeed);
                                                asyncTasks.push(function(_dummyCallback) {
                                                    _getForumAPI(theMsg, theMsg.payload[k].repliesFeed, isAtom, theProcessor2, sortKey, sortOrder, k, _dummyCallback);
                                                });
                                            } else {
                                                console.log('_getRecursiveForumAPI: no replies feed : very strange situation');
                                            }
                                        }   
                                        //
                                        //  Before SEND, we need to verify if there are asynchronous things to be done ....
                                        //
                                        _beforeSend(theMsg);
                                    } else {
                                        console.log('_getRecursiveForumAPI: No ENTRY found for URL : ' + theURL);
                                        node.status({fill:"yellow",shape:"dot",text:"No Entry found"});
                                        theMsg.payload = [];
                                        node.send(theMsg);
                                    }
                                }
                            });
                        } else {
                            console.log("_getRecursiveForumAPI: Status NOT OK (" + response.statusCode + ") " + response.statusMessage);
                            console.log(JSON.stringify(body, ' ', 2));
                            node.status({fill:"red",shape:"dot",text:"_getRecursiveForumAPI: " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.statusMessage, theMsg);
                        }
                    }
                }
            );           
        }
      
        this.on( 
            'input', 
            function(msg) {
                var serverConfig = RED.nodes.getNode(config.server);
                var myURL        = "";
                //
                //  Server is a GLOBAL variable
                //
                var server = serverConfig.getServer;
                var theTags = '';
                //
                //  Check value of Target
                //
                var target = null;
                var commOrForum = null;
                let forumTopicOp = null;
                let forumReplyOp = null;
                let theId = null;

                asyncTasks = [];

                if (config.target === 'fromMSG') {
                    if ((msg.IC_target) && (msg.IC_target.trim() !== '')) {
                        target = msg.IC_target.trim();
                    } else {
                        //
                        //  There is an issue
                        //
                        console.log("ICForumsGet: Missing Target operation");
                        node.status({fill:"red",shape:"dot",text:"Missing target Operation"});
                        node.error('Missing target Operation', msg);
                        return;
                    }
                } else {
                    target = config.target;
                }
                node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                switch (target) {
                    case "CommunityForums" :
                        myURL = server + "/forums/atom/forums?communityUuid=";
                        if ((config.communityId.trim() === '') && 
                            ((msg.communityId === undefined) || (msg.communityId.trim() === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("ICForumsGet: Missing Community UUid Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Community UUid"});
                            node.error('Missing Community Uuid', msg);
                            return;
                        } else {
                            if (config.communityId.trim() !== '') {
                                theId = config.communityId.trim();
                            } else {
                                theId = msg.communityId.trim();
                            }
                            myURL += theId;
                        }
                        _getForumAPI(msg, myURL, config.isAtom, ICparseCommunityAtomEntry, null, null, -1, null);
                        break;
                    case "ForumDetails" :
                        myURL = server + "/forums/atom/forum?forumUuid=";
                        if ((config.forumId.trim() === '') && 
                            ((msg.forumId === undefined) || (msg.forumId.trim() === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("ICForumsGet: Missing Forum UUid Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Forum UUid"});
                            node.error('Missing Forum Uuid', msg);
                            return;
                        } else {
                            if (config.forumId.trim() !== '') {
                                theId = config.forumId.trim();
                            } else {
                                theId = msg.forumId.trim();
                            }
                            myURL += theId;
                        }
                        _getForumAPI(msg, myURL, config.isAtom, ICparseForumAtomEntry, null, null, -1, null);
                        break;
                    case "ForumTopics" :
                        if (config.commOrForum === 'fromMSG') {
                            if ((msg.IC_communityOrForum) && (msg.IC_communityOrForum.trim() !== '')) {
                                commOrForum = msg.IC_communityOrForum.trim();
                            } else {
                                //
                                //  There is an issue
                                //
                                console.log("ICForumsGet: Invalid flag for Commuity Or Forum");
                                node.status({fill:"red", shape:"dot", text:"Invalid flag for Commuity Or Forum"});
                                node.error('Invalid flag for Commuity Or Forum', msg);
                                return;
                            }
                        } else {
                            commOrForum = config.commOrForum;
                        }
                        if (commOrForum === 'Community') {
                            myURL = server + '/communities/service/atom/community/forum/';
                            if (config.target === 'ForumTopics') {
                                myURL += 'topics';
                            } else {
                                myURL += 'entries';
                            }
                            myURL += '?communityUuid=';
                            if ((config.communityId.trim() === '') && 
                                ((msg.communityId === undefined) || (msg.communityId.trim() === ''))) {
                                //
                                //  There is an issue
                                //
                                console.log("ICForumsGet: Missing Community UUid Information");
                                node.status({fill:"red",shape:"dot",text:"Missing Community UUid"});
                                node.error('Missing Community Uuid', msg);
                                return;
                            } else {
                                if (config.communityId.trim() !== '') {
                                    theId = config.communityId.trim();
                                } else {
                                    theId = msg.communityId.trim();
                                }
                                myURL += theId;
                            }
                        } else {
                            myURL = server + '/forums/atom/';
                            if (config.target === "ForumTopics") {
                                myURL += "topics";
                            } else {
                                myURL += "entries";
                            }
                            myURL += '?forumUuid=';
                            if ((config.forumId.trim() === '') && 
                                ((msg.forumId === undefined) || (msg.forumId.trim() === ''))) {
                                //
                                //  There is an issue
                                //
                                console.log("ICForumsGet: Missing Forum UUid Information");
                                node.status({fill:"red",shape:"dot",text:"Missing Forum UUid"});
                                node.error('Missing Forum Uuid', msg);
                                return;
                            } else {
                                if (config.forumId.trim() !== '') {
                                    theId = config.forumId.trim();
                                } else {
                                    theId = msg.forumId.trim();
                                }
                                myURL += theId;
                            }
                        }
                        if (config.answerOrNot !== "topics") {
                            myURL += '&filter=' + config.answerOrNot;
                        }
                        _getForumAPI(msg, myURL, config.isAtom, ICparseTopicAtomEntryList, config.sortBy, 'desc', -1, null);
                        break;
                    case "ForumEntries" :
                        myURL = server + '/forums/atom/entries?forumUuid=';
                        if ((config.forumId.trim() === '') && 
                            ((msg.forumId === undefined) || (msg.forumId.trim() === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("ICForumsGet: Missing Forum UUid Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Forum UUid"});
                            node.error('Missing Forum Uuid', msg);
                            return;
                        } else {
                            if (config.forumId.trim() !== '') {
                                theId = config.forumId.trim();
                            } else {
                                theId = msg.forumId.trim();
                            }
                            myURL += theId;
                        }
                        _getForumAPI(msg, myURL, config.isAtom, ICparseTopicAtomEntryList, null, null, -1, null);
                        break;
                    case "OneForumTopic" :
                        //
                        //  Check the forumTopicOp flag
                        //
                        if (config.forumTopicOp === 'fromMSG') {
                            if ((msg.IC_forumTopicOp) && (msg.IC_forumTopicOp.trim() !== '')) {
                                forumTopicOp = msg.IC_forumTopicOp.trim();
                            } else {
                                //
                                //  There is an issue
                                //
                                console.log("ICForumsGet: Invalid flag for forumTopicOp");
                                node.status({fill:"red", shape:"dot", text:"Invalid flag for forumTopicOp"});
                                node.error('Invalid flag for forumTopicOp', msg);
                                return;
                            }
                        } else {
                            forumTopicOp = config.forumTopicOp;
                        }
                        //
                        //  Get ForumTopic Id
                        //
                        if ((config.forumTopicId.trim() === '') && 
                            ((msg.forumTopicId === undefined) || (msg.forumTopicId.trim() === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("ICForumsGet: Missing Forum Topic UUid Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Forum Topic UUid"});
                            node.error('Missing Forum Topic Uuid', msg);
                            return;
                        } else {
                            if (config.forumTopicId.trim() !== '') {
                                theId = config.forumTopicId.trim();
                            } else {
                                theId = msg.forumTopicId.trim();
                            }
                        }
                        switch (forumTopicOp) {
                            case "get":
                                myURL = server + '/forums/atom/topic?topicUuid=' + theId;
                                _getRecursiveForumAPI(msg, myURL, config.isAtom, ICparseTopicAtomEntry, ICparseTopicAtomEntryList, config.sortBy, 'desc');
                                //_getForumAPI(msg, myURL, config.isAtom, ICparseTopicAtomEntry, null, null, -1, null);
                                break;
                            case "getReplies":
                                myURL = server + '/forums/atom/replies?topicUuid=' + theId;
                                _getForumAPI(msg, myURL, config.isAtom, ICparseTopicAtomEntryList, null, null, -1, null);
                                break;
                            case "like":
                                myURL = server + '/forums/atom/recommendation/entries?postUuid=' + theId;
                                _likeForumAPI(msg, myURL, config.isAtom, null, true);
                                break;
                            case "unlike":
                                myURL = server + '/forums/atom/recommendation/entries?postUuid=' + theId;
                                _likeForumAPI(msg, myURL, config.isAtom, null, false);
                                break;
                            default:
                                //
                                //  There is an issue
                                //
                                console.log("ICForumsGet: " + forumTopicOp + " is not a valid forumTopic Operation");
                                node.status({fill:"red",shape:"dot",  text:"Invalid forumTopic Operation : " + forumTopicOp});
                                node.error("Invalid forumTopic Operation : " + forumTopicOp, msg);
                                break;
                        }
                        break;
                    case "OneForumReply" :
                        //
                        //  Check the forumTopicOp flag
                        //
                        if (config.forumReplyOp === 'fromMSG') {
                            if ((msg.IC_forumReplyOp) && (msg.IC_forumReplyOp.trim() !== '')) {
                                forumReplyOp = msg.IC_forumReplyOp.trim();
                            } else {
                                //
                                //  There is an issue
                                //
                                console.log("ICForumsGet: Invalid flag for forumReplyOp");
                                node.status({fill:"red", shape:"dot", text:"Invalid flag for forumreplyOp"});
                                node.error('Invalid flag for forumReplyOp', msg);
                                return;
                            }
                        } else {
                            forumReplyOp = config.forumReplyOp;
                        }
                        //
                        //  Get ForumTopic Id
                        //
                        if ((config.forumReplyId.trim() === '') && 
                            ((msg.forumReplyId === undefined) || (msg.forumReplyId.trim() === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("ICForumsGet: Missing Forum Reply UUid Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Forum Reply UUid"});
                            node.error('Missing Forum Reply Uuid', msg);
                            return;
                        } else {
                            if (config.forumReplyId.trim() !== '') {
                                theId = config.forumReplyId.trim();
                            } else {
                                theId = msg.forumReplyId.trim();
                            }
                        }
                        switch (forumReplyOp) {
                            case "get":
                                myURL = server + '/forums/atom/reply?replyUuid=' + theId;
                                _getForumAPI(msg, myURL, config.isAtom, ICparseTopicAtomEntry, null, null, -1, null);
                                break;
                            case "like":
                                myURL = server + '/forums/atom/recommendation/entries?postUuid=' + theId;
                                _likeForumAPI(msg, myURL, config.isAtom, null, true);
                                break;
                            case "unlike":
                                myURL = server + '/forums/atom/recommendation/entries?postUuid=' + theId;
                                _likeForumAPI(msg, myURL, config.isAtom, null, false);
                                break;
                            case "accept":
                                myURL = server + '/forums/atom/reply?replyUuid=' + theId;
                                _acceptForumAPI(msg, myURL, true);
                                break;
                            case "reject":
                                myURL = server + '/forums/atom/reply?replyUuid=' + theId;
                                _acceptForumAPI(msg, myURL, false);
                                break;
                            default:
                                //
                                //  There is an issue
                                //
                                console.log("ICForumsGet: " + forumReplyOp + " is not a valid forumReply Operation");
                                node.status({fill:"red",shape:"dot",  text:"Invalid forumReply Operation : " + forumReplyOp});
                                node.error("Invalid forumReply Operation : " + forumReplyOp, msg);
                                break;
                        }
                        break;
                    case "Search" : {
                        myURL = server + '/forums/atom/topics?';
                        let theQuery;
                        //
                        //  Check  Forum IDs is present
                        //
                        if ((config.forumId.trim() === '') && 
                            ((msg.forumId === undefined) || (msg.forumId.trim() === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("ICForumsGet: Missing Forum UUid Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Forum UUid"});
                            node.error('Missing Forum Uuid', msg);
                            return;
                        } else {
                            if (config.forumId.trim() !== '') {
                                theId = config.forumId.trim();
                            } else {
                                theId = msg.forumId.trim();
                            }
                        }
                        //
                        //  Get the Query
                        //
                        if ((config.query.trim() === '') && 
                            ((msg.query === undefined) || (msg.query.trim() === ''))) {
                            theQuery = '';
                        } else {
                            if (config.query.trim() !== '') {
                                theQuery = config.query.trim();
                            } else {
                                theQuery = msg.query.trim();
                            }
                        }
                        //
                        //  Get the Tags
                        //
                        if ((config.forumTags.trim() === '') && 
                            ((msg.forumTags === undefined) || (msg.forumTags.trim() === ''))) {
                            theTags = '';
                        } else {
                            if (config.forumTags.trim() !== '') {
                                theTags = config.forumTags.trim();
                            } else {
                                theTags = msg.forumTags.trim();
                            }
                        }
                        //
                        //  If no query and No tags, then there is a problem
                        //
                        if ((theQuery === '') && (theTags === '')) {
                            //
                            //  There is an issue
                            //
                            console.log("ICForumsGet: Missing Forum both Query and Tangs Information");
                            node.status({fill:"red",shape:"dot",text:"Missing both Query and Tags"});
                            node.error('Missing both Query and Tags', msg);
                            return;
                        }
                        //
                        //  Build the URL
                        //
                        if (theQuery !== '') myURL += 'search=' + theQuery + '&';
                        if (theTags  !== '') myURL += 'tag=' + theTags + '&';
                        myURL += 'filter=' + config.answerOrNot + '&';
                        myURL += 'sortBy=modified&sortOrder=desc&';
                        myURL += 'forumUuid=' + theId;
                        //myURL += 'filter=' + config.answerOrNot + '&';
                        //myURL += 'scope=forums&format=light&';
                        //myURL += 'personalization={"type":"personalContentBoost","value":"on"}&';
                        //myURL += 'social={"type":"community","id":"'+ theId + '"}';
                        _getRecursiveForumAPI(msg, myURL, config.isAtom, ICparseTopicAtomEntryList, ICparseTopicAtomEntryList, config.sortBy, 'desc');
                        break;
                    }
                    default:
                        //
                        //  There is an issue
                        //
                        console.log("ICForumsGet: " + target + " is not a valid target Operation");
                        node.status({fill:"red",shape:"dot",  text:"Invalid target Operation : " + target});
                        node.error("Invalid target Operation : " + target, msg);
                        break;
                }
            }
        );
    }
    
    RED.nodes.registerType("ICForumsGet", ICForumsGet); 

};
