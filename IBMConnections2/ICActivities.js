module.exports = function(RED) {    
    function ICparseActivityAtomEntry(entry, isAtom) {
        var xml2js = require("xml2js");
        var builder  = new xml2js.Builder({rootName: "entry"});
        var activity = {};
        activity['title'] = entry.title[0]['_'];
        activity['id'] = entry['snx:activity'][0];
        for (j=0; j < entry.link.length; j++ ) {
            var tmp = entry.link[j];
            if (tmp['$'].rel === "self") {
                activity['ref'] =  tmp['$'].href; 
                break;
            }
        }
        if (isAtom) {
            activity['entry'] = builder.buildObject(entry);
        }
        return activity;
    }

    function ICActivitiesNew(config) {      
        RED.nodes.createNode(this,config);        
        //
        //  Global to access the custom HTTP Request object available from the
        //  ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		var node = this;

        var xml2js = require("xml2js");
        var parser = new xml2js.Parser();
        var builder  = new xml2js.Builder({rootName: "entry"});

        
        function _createActivityFromTemplate(theMsg, templateURL, createURL, communityId, activityName) {
             node.login.request(
                {
                    url: templateURL, 
                    method: "GET",
                    headers:{"Content-Type" : "application/atom+xml; charset=UTF-8"}
                },
                function(error,response,body) {
                    if (error) {
                        console.log("_createActivityFromTemplate : error getting information for Actvity !");
                        node.status({fill:"red",shape:"dot",text:"No Activity"});
                        node.error(error.toString(), theMsg);
                        return;
                    } else {
                        console.log('_getTemplate: executing on ' + templateURL);
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                    node.error("Parser Error _createActivityFromTemplate", theMsg);
                                    return;
                                }
                                if (result.feed) {
                                    //
                                    //  We have succesfully fetched the template
                                    //  Now we have to modify it and pass to the creation function
                                    //
                                    var feedJson = result.feed;
                                    //
                                    //  removing the "template" flag
                                    //
                                    var k = -1;
                                    for (i=0; i < feedJson.category.length; i++) {
                                        tmp = feedJson.category[i];
                                        if (tmp["$"].term === "template") {
                                            k = i;
                                            break;
                                        }
                                    }
                                    if (k != -1) feedJson.category.splice(k, 1);
                                    //
                                    //  Changing the flag Activty to CommunityActivity in case
                                    //
                                    if (communityId !== null) {
                                        k = -1;
                                        for (i=0; i < feedJson.category.length; i++) {
                                            tmp = feedJson.category[i];
                                            if (tmp["$"].term === "activity") {
                                                tmp["$"].term = "explicit_membership_community_activity";
                                                tmp["$"].label = "Explicit Membership Community Activity";
                                                break;
                                            }
                                        }
                                    }
                                    //
                                    //  Remove unnecessary things
                                    //
                                    //delete(feedJson.id);
                                    //delete(feedJson.link);
                                    delete(feedJson.contributor);
                                    delete(feedJson.author);
                                    delete(feedJson.generator);
                                    delete(feedJson.updated);
                                    delete(feedJson.entry);
                                    //
                                    //  Set the name
                                    //
                                    feedJson.title[0]["_"] = activityName;
                                    //
                                    //  Finally create the activity from template
                                    //
                                    console.log(builder.buildObject(feedJson));
                                    _createActivity(theMsg, createURL, builder.buildObject(feedJson));
                                } else {
                                    console.log('No TEMPLATE found for URL : ' + templateURL);
                                    node.status({fill:"red",shape:"dot",text:"No Entry "});
                                    node.error("Missing <ENTRY>", theMsg);
                                    return;                               
                                }
                            });
                        } else {
                            console.log("_createActivityFromTemplate: GET TEMPLATE NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + " : " + response.body, theMsg);
                            return;                        
                        }
                    }
                }
            );           
        }
        
        function _createActivity(theMsg, theURL, payload) {
            node.login.request(
                {
                    url: theURL, 
                    method: "POST",
                    body : payload,
                    headers:{"Content-Type" : "application/atom+xml; charset=UTF-8"}
                },
                function(error, response, body) {
                    if (error) {
                        console.log("_createActivity: error creating Actvity !");
                        node.status({fill:"red",shape:"dot",text:"Err Create"});
                        node.error(error.toString(), theMsg);
                        return;
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            console.log("_createActivity: POST OK (" + response.statusCode + ")");
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                    node.error("Parser Error _createActivity", theMsg);
                                    return;
                                }
                                var myData = new Array();
                                myData.push(ICparseActivityAtomEntry(result.entry, true));
                                if (result.entry) {
                                    console.log(JSON.stringify(myData, null, 2));
                                    theMsg.payload = myData;
                                    node.status({});
                                    node.send(theMsg);
                                } else {
                                    onsole.log('_createActivity: No ENTRY found for URL : ' + theURL);
                                    node.status({fill:"red",shape:"dot",text:"No Entry "});
                                    node.error("Missing <ENTRY>", theMsg);
                                }
                            });
                        } else {
                            console.log("_createActivity: Create Activity NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        }
                    }
                }
            );
        }
    
        function createActivity(theMsg, server, theURL, activityName, communityId, templateId) {
            node.status({fill:"blue",shape:"dot",text:"Creating..."});
            if (templateId !== null) {
                //
                //  We need to create an activity from a Template.
                //  Thus we first need to FETCH the template
                //
                var templateURL = server + "/activities/service/atom2/activity?activityUuid=" + templateId;
                _createActivityFromTemplate(theMsg, templateURL, theURL, communityId, activityName);
            } else {
                //
                //  Just create an EMPTY activity
                //
                var body = '';
                body += "<entry";
                body += '    xmlns="http://www.w3.org/2005/Atom"';
                body += '    xmlns:app="http://www.w3.org/2007/app"';
                body += '    xmlns:snx="http://www.ibm.com/xmlns/prod/sn"';
                body += '    xmlns:xhtml="http://www.w3.org/1999/xhtml"';
                body += '    xmlns:thr="http://purl.org/syndication/thread/1.0">';
                body += '    <title type="text">' + activityName + '</title>';
                if (communityId === null) {                   
                    body += '    <category scheme="http://www.ibm.com/xmlns/prod/sn/type" term="activity" label="Activity"/>';
                } else {
                    body += '    <category scheme="http://www.ibm.com/xmlns/prod/sn/type" term="explicit_membership_community_activity" label="Explicit Membership Community Activity"/>';
                }
                body += '    <category scheme="http://www.ibm.com/xmlns/prod/sn/priority" term="1" label="Normal"/>';
                body += '    <content type="html"></content>';
                body += '</entry>';
                _createActivity(theMsg, theURL, body);
            }
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
                
                //
                //  Activity MUST have a name
                //
                if ((config.activityName === '') && 
                    ((msg.activityName === undefined) || (msg.activityName === ''))) {
                    //
                    //  There is an issue
                    //
                    console.log("createActivity: Missing Activity Name");
                    node.status({fill:"red",shape:"dot",text:"Missing Name"});
                    node.error('Missing Name', msg);
                    return;
                } else {
                    var activityName = '';
                    if (config.activityName !== '') {
                        activityName = config.activityName.trim();
                    } else {
                        activityName = msg.activityName.trim();
                    }
                    var templateId = null;
                    if (config.isTemplate) {
                        if ((config.templateId !== '') || 
                            ((msg.templateId !== undefined) && (msg.templateId !== ''))) {
                            //
                            //  a template has been specified
                            //
                            if (config.templateId !== '') {
                                templateId = config.templateId.trim();
                            } else {
                                templateId = msg.templateId.trim();
                            }
                        }                        
                    }
                    myURL = server + "/activities/service/atom2/activities";
                    var prefix = "?";
                    var communityId = null;
                    if (config.isCommunity) {
                        if ((config.communityId !== '') || 
                            ((msg.communityId !== undefined) && (msg.communityId !== ''))) {
                            //
                            //  a Community has been specified
                            //
                            if (config.communityId !== '') {
                                communityId = config.communityId.trim();
                            } else {
                                communityId = msg.communityId.trim();
                            }
                            myURL += prefix + "commUuid=" + communityId;
                            prefix = "&";
                        }                        
                    }
                    myURL += prefix + "public=yes&authenticate=no";
                    createActivity(msg, server, myURL, activityName, communityId, templateId);
                }
            }
        );
    }
    
    RED.nodes.registerType("ICActivitiesNew", ICActivitiesNew);

    
    function ICActivitiesGet(config) {      
        RED.nodes.createNode(this,config);   
        //
        //  Global to access the custom HTTP Request object available from the
        //  ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		var node = this;
 
        var xml2js   = require("xml2js");
        var parser   = new xml2js.Parser();
        
        function getUserActivities(theMsg, theURL, isAtom, isCommunity) {
            //
            //  to get the list of MyActivities as it appears on the 
            //  Connections UI, we need to retrieve the userid of the person.
            //  the quickest way is to shoot a first request on the following URL
            //      /activities/service/atom2/activities
            //  and to process the <author> item to fetch the <snx:userid> information
            //
            //  We then pass the userid as a parameter to the call
            //
             node.login.request(
                {
                    url: theURL, 
                    method: "GET",
                    headers:{"Content-Type" : "application/atom+xml; charset=UTF-8"}
                },
                function(error,response,body) {
                    console.log('getUserActivities: executing on ' + theURL);
                    if (error) {
                        console.log("getUserActivities: error getting information for ActvityList !");
                        node.status({fill:"red",shape:"dot",text:"No ActivityList"});
                        node.error(error.toString(), theMsg);
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                    node.error("Parser Error getUserActivities", theMsg);
                                    return;
                                }
                                var prefix = "?";
                                if (theURL.search("tag=") != -1) prefix = "&";
                                getActivityList(theMsg, 
                                                theURL + prefix + "userid=" + result.feed.author[0]['snx:userid'][0], 
                                                isAtom, isCommunity);
                            });
                        } else {
                            console.log("getUserActivities: GET ACTIVITYLIST  NOT OK (" + response.statusCode + ")");
                            console.log(theURL);
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                            return;
                        }
                    }
                }
            );           
        }

        function getActivityList(theMsg, theURL, isAtom, isCommunity) {
             node.login.request(
                {
                    url: theURL, 
                    method: "GET",
                    headers:{"Content-Type" : "application/atom+xml; charset=UTF-8" }
                },
                function(error,response,body) {
                    console.log('getActivityList: executing on ' + theURL);
                    if (error) {
                        console.log("getActivityList : error getting information for ActvityList !");
                        node.status({fill:"red",shape:"dot",text:"No ActivityList"});
                        node.error(error.toString(), theMsg);
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
                                    node.error("Parser Error getActivitiyList", theMsg);
                                    return;
                                }
                                var myData = new Array();
                                if (result.feed.entry) {
                                   //
                                    for (i=0; i < result.feed.entry.length; i++) {
                                        var processIt = false;
                                        if (isCommunity) {
                                            for (j=0; j < result.feed.entry[i].category.length; j++) {
                                                var tmp = result.feed.entry[i].category[j]["$"];
                                                if (tmp.scheme == "http://www.ibm.com/xmlns/prod/sn/type") {
                                                    if (tmp.term == "community_activity") processIt = true;
                                                }
                                            }
                                        } else {
                                            processIt = true;
                                        }
                                        if (processIt) {
                                            myData.push(ICparseActivityAtomEntry(result.feed.entry[i], isAtom));   
                                        }
                                    }
                                    node.status({});
                                } else {
                                    console.log('getActivityList: No ENTRY found for URL : ' + theURL);
                                    node.status({fill:"red",shape:"dot",text:"No Entry "});
                                }
                                theMsg.payload = myData;
                                node.send(theMsg);
                            });
                        } else {
                            console.log("GET ACTIVITYLIST  NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        }
                    }
                }
            );           
        }

        function getActivity(theMsg, theURL, isAtom) {
             node.login.request(
                {
                    url: theURL, 
                    method: "GET",
                    headers:{"Content-Type" : "application/atom+xml; charset=UTF-8"}
                },
                function(error,response,body) {
                    console.log('getActivity: executing on ' + theURL);
                    if (error) {
                        console.log("getActivity : error getting information for Actvity !");
                        node.status({fill:"red",shape:"dot",text:"No Activity"});
                        node.error(error.toString(), theMsg);
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
                                    node.error("Parser Error getActivity", theMsg);
                                    return;
                                }
                                var myData = new Array();
                                if (result.entry) {
                                    //
                                    myData.push(ICparseActivityAtomEntry(result.entry, isAtom));
                                    node.status({});
                                } else {
                                    console.log('No ENTRY found for URL : ' + theURL);
                                    node.status({fill:"red",shape:"dot",text:"No Entry "});
                                }
                                theMsg.payload = myData;
                                node.send(theMsg);
                            });
                        } else {
                            console.log("GET ACTIVITY  NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.bidy, theMsg);
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
                if (config.activityTags !== '') {
                    theTags = "tag=" + config.activityTags.trim();
                } else if ((msg.activityTags !== undefined) && (msg.activityTags !== '')) {
                    theTags = "tag=" + msg.activityTags.trim();
                }
                
                node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                switch (config.target) {
                    case "AllActivities" :
                        myURL = server + "/activities/service/atom2/activities?public=yes&organization=yes";
                        if (config.isTemplate) myURL += "&templates=only";
                        if (theTags !== '') myURL += '&' + theTags;
                        getActivityList(msg, myURL, config.isAtom, false);
                        break;
                    case "MyActivities" :
                        myURL = server + "/activities/service/atom2/activities?userid=" + serverConfig.userId;
                        if (theTags !== '') myURL += '&' + theTags;
                        getActivityList(msg, myURL, config.isAtom, false);
                        break;
                    case "CommActivities" :
                        myURL = server + "/activities/service/atom2/activities?includeCommunityActivities=only";
                        if (theTags !== '') myURL += '&' + theTags;
                        getActivityList(msg, myURL, config.isAtom, true);
                        break;
                    case "byId" :
                        myURL = server + "/activities/service/atom2/activitynode?activityNodeUuid=";
                        if ((config.activityId === '') && 
                            ((msg.activityId === undefined) || (msg.activityId === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing Activity UUid Information");
                            node.status({fill:"red",shape:"dot",text:"Missing UUid"});
                            node.error('Missing Activity Uuid', msg);
                            return;
                        } else {
                            var theId = '';
                            if (config.activityId !== '') {
                                theId = config.activityId.trim();
                            } else {
                                theId = msg.activityId.trim();
                            }
                            myURL += theId;
                            getActivity(msg, myURL, config.isAtom);
                        }
                        break;
                }
            }
        );
    }
    
    RED.nodes.registerType("ICActivitiesGet", ICActivitiesGet); 
    
    function ICActivitiesUpdate(config) {      
        RED.nodes.createNode(this,config);        
        //
        //  Global to access the custom HTTP Request object available from the
        //  ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		var node = this;

        var xml2js   = require("xml2js");
        var parser   = new xml2js.Parser();
        
        function updateActivity(theMsg, theURL, payload, isAtom) {
             node.status({fill:"blue",shape:"dot",text:"Updating..."});
             node.login.request(
                {
                    url: theURL, 
                    method: "POST",
                    body : payload,
                    headers:{"Content-Type" : "application/atom+xml; charset=UTF-8"}
                },
                function(error, response, body) {
                    console.log('updateActivity: executing on ' + theURL);
                    console.log('updateActivity: posting body ' + payload);
                    if (error) {
                        console.log("updateActivity : error updating the Actvity !");
                        node.status({fill:"red",shape:"dot",text:"No Activity"});
                        node.error(error.toString(), theMsg);
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
                                    node.error("Parser Error updteActivity", theMsg);
                                    return;
                                }
                                if (result.entry) {
                                    var myData = new Array();
                                    myData.push(ICparseActivityAtomEntry(result.entry, isAtom));
                                    theMsg.payload = myData;
                                    node.status({});
                                    node.send(theMsg);
                                } else {
                                    console.log('updateActivity: No ENTRY found for URL : ' + theURL);
                                    node.status({fill:"red",shape:"dot",text:"No Entry "});
                                    node.error('Missing <ENTRY>', theMsg);
                               }
                            });
                        } else {
                            console.log("UPDATE ACTIVITY  NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
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

                var activityId = '';
                if ((config.activityId === '') && 
                    ((msg.activityId === undefined) || (msg.activityId === ''))) {
                    //
                    //  There is an issue
                    //
                    console.log("Missing ActivityID Information");
                    node.status({fill:"red",shape:"dot",text:"Missing ActivityId"});
                    node.error('Missing ActivityID', msg);
                    return;
                }
                if (config.activityId !== '') {
                    activityId = config.activityId.trim();
                } else {
                    activityId = msg.activityId.trim();
                }
                switch (config.target) {
                    case "Section" :
                        //
                        //  Getting Title of the Section (this is a Mandatory argument)
                        //
                        var sectionTitle = '';
                        if ((config.sectionTitle === '') && 
                            ((msg.sectionTitle === undefined) || (msg.sectionTitle === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing Section Name Information");
                            node.status({fill:"red",shape:"dot",text:"Missing SectionName"});
                            node.error('Missing SectionName', msg);
                            return;
                        } else {
                            if (config.sectionTitle !== '') {
                                sectionTitle = config.sectionTitle;
                            } else {
                                sectionTitle = msg.sectionTitle;
                            }
                        }
                        //
                        //  Getting the Description of the Section
                        //
                        var sectionDesc = '';
                        if (config.sectionDesc !== '') {
                            sectionDesc = config.sectionDesc;
                        } else if ((msg.sectionDesc !== undefined) && (msg.sectionDesc !== '')) {
                            sectionDesc = msg.sectionDesc;
                        }
                        //
                        //  Creating the ATOM Entry document associated to the Section
                        //
                        var newEntry = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
                        newEntry += '<entry xmlns="http://www.w3.org/2005/Atom" ';
                        newEntry += 'xmlns:app="http://www.w3.org/2007/app" ';
                        newEntry += 'xmlns:snx="http://www.ibm.com/xmlns/prod/sn" ';
                        newEntry += 'xmlns:os="http://a9.com/-/spec/opensearch/1.1/" ';
                        newEntry += 'xmlns:xhtml="http://www.w3.org/1999/xhtml" ';
                        newEntry += 'xmlns:thr="http://purl.org/syndication/thread/1.0">';
                        newEntry += '<title type="text">' + sectionTitle + '</title>';
                        newEntry += '<category scheme="http://www.ibm.com/xmlns/prod/sn/type" term="section" label="Section" />';
                        newEntry += '<content type="html">' + sectionDesc + '</content>';
                        newEntry += '<snx:position>0</snx:position>';
                        newEntry += '</entry>';
                        //
                        //  create the Section
                        //
                        myURL = server + "/activities/service/atom2/activity?activityUuid=" + activityId;
                        updateActivity(msg, myURL, newEntry, true);
                        break;
                    case "Bookmark" :
                        var containerId = '';
                        //
                        //  Getting the SectionId in which bookmark needs to be created
                        //  defaults to the ActivityID in case it is missing
                        //
                        if (config.inSection) {
                            if ((config.sectionId === '') && 
                                ((msg.sectionId === undefined) || (msg.sectionId === ''))) {
                                //
                                //  There is an issue
                                //
                                console.log("Missing Section Id Information");
                                node.status({fill:"red",shape:"dot",text:"Missing SectionId"});
                                node.error('Missing SectionID', msg);
                                return;
                            } else {
                                if (config.sectionId !== '') {
                                    containerId = config.sectionId.trim();
                                } else {
                                    containerId = msg.sectionId.trim();
                                }
                            }
                        } else {
                            containerId = activityId ;
                        }
                        //
                        //  Getting the URL for the bookmark (this is a Mandatory argument)
                        //
                        var linkURL = '';
                        if ((config.linkURL === '') && 
                            ((msg.linkURL === undefined) || (msg.linkURL === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing Bookmark URL Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Bookmark URL"});
                            node.error('Missing Bookmark URL', msg);
                            return;
                        } else {
                            if (config.linkURL !== '') {
                                linkURL = config.linkURL.trim();
                            } else {
                                linkURL = msg.linkURL.trim();
                            }
                        }
                        //
                        //  Getting the String associated to the URL for the bookmark 
                        //  Defaults to the URL value
                        //
                        var linkName = '';
                        if (config.linkName !== '') {
                            linkName = config.linkName;
                        } else if ((msg.linkName !== undefined) && (msg.linkName !== '')) {
                            linkName = msg.linkName;
                        } else {
                            linkName = linkURL;
                        }
                        //
                        //  Getting Titlte and Description for the Link
                        //
                        var linkDesc = '';
                        if (config.linkDesc !== '') {
                            linkDesc = config.linkDesc;
                        } else if ((msg.linkDesc !== undefined) && (msg.linkDesc !== '')) {
                            linkDesc = msg.linkDesc;
                        }                        
                        var linkTitle = '';
                        if (config.linkTitle !== '') {
                            linkTitle = config.linkTitle;
                        } else if ((msg.linkTitle !== undefined) && (msg.linkTitle !== '')) {
                            linkTitle = msg.linkTitle;
                        }                        
                        //
                        //  Creating the ATOM Entry document associated to the Section
                        //
                        newEntry = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
                        newEntry += '<entry xmlns="http://www.w3.org/2005/Atom" ';
                        newEntry += 'xmlns:app="http://www.w3.org/2007/app" ';
                        newEntry += 'xmlns:snx="http://www.ibm.com/xmlns/prod/sn" ';
                        newEntry += 'xmlns:os="http://a9.com/-/spec/opensearch/1.1/" ';
                        newEntry += 'xmlns:xhtml="http://www.w3.org/1999/xhtml" ';
                        newEntry += 'xmlns:thr="http://purl.org/syndication/thread/1.0">';
                        newEntry += '<title type="text">' + linkTitle + '</title>';
                        newEntry += '<category scheme="http://www.ibm.com/xmlns/prod/sn/type" term="entry" label="Entry" />';
                        newEntry += '<content type="html">' + linkDesc + '</content>';
                        newEntry += '<snx:position>0</snx:position>';
                        newEntry += '<snx:field name="Bookmark" type="link">';
                        newEntry += '<link href= "' + linkURL + '" title="' + linkName + '"/>';
                        newEntry += '</snx:field>';
                        newEntry += '<thr:in-reply-to type="application/atom+xml" ';
                        newEntry += 'ref="urn:lsid:ibm.com:oa:' + containerId;
                        newEntry += '" source="snx:activity-id"/></entry>';
                        //
                        //  create the Section
                        //
                        myURL = server + "/activities/service/atom2/activity?activityUuid=" + activityId;
                        updateActivity(msg, myURL, newEntry, true);
                        break;
                    case "ToDo" :
                        containerId = '';
                        //
                        //  Getting the SectionId in which bookmark needs to be created
                        //  defaults to the ActivityID in case it is missing
                        //
                        if (config.inSection) {
                            if ((config.sectionId === '') && 
                                ((msg.sectionId === undefined) || (msg.sectionId === ''))) {
                                //
                                //  There is an issue
                                //
                                console.log("Missing Section Id Information");
                                node.status({fill:"red",shape:"dot",text:"Missing SectionId"});
                                node.error('Missing SectionID', msg);
                                return;
                            } else {
                                if (config.sectionId !== '') {
                                    containerId = config.sectionId.trim();
                                } else {
                                    containerId = msg.sectionId.trim();
                                }
                            }
                        } else {
                            containerId = activityId ;
                        }
                        var toDoDate = '';
                        //
                        //  Getting TODO date and format it properly
                        //
                        if (config.toDoDate !== '') {
                            toDoDate = config.toDoDate;
                        } else if ((msg.toDoDate !== undefined) && (msg.toDoDate !== '')) {
                            toDoDate = msg.toDoDate;
                        }
                        if (toDoDate !== '') {                               
                            var pattern = /(\d{2})\/(\d{2})\/(\d{4})/;
                            toDoDate = toDoDate.replace(pattern,'$3-$2-$1');
                        }
                        //
                        //  Getting TODO userID and username
                        //
                        var toDoUserId = '';
                        if (config.toDoUserId !== '') {
                            toDoUserId = config.toDoUserId.trim();
                        } else if ((msg.toDoUserId !== undefined) && (msg.toDoUserId !== '')) {
                            toDoUserId = msg.toDoUserId.trim();
                        }                        
                        var toDoUserName = '';
                        if (config.toDoUserName !== '') {
                            toDoUserName = config.toDoUserName.trim();
                        } else if ((msg.toDoUserName !== undefined) && (msg.toDoUserName !== '')) {
                            toDoUserName = msg.toDoUserName.trim();
                        }
                        //
                        //  Getting TODO Description
                        //
                        var toDoDesc = '';
                        if (config.toDoDesc !== '') {
                            toDoDesc = config.toDoDesc;
                        } else if ((msg.toDoDesc !== undefined) && (msg.toDoDesc !== '')) {
                            toDoDesc = msg.toDoDesc;
                        }
                        //
                        //  Getting TODO Title
                        //
                        var toDoTitle = '';
                        if (config.toDoTitle !== '') {
                            toDoTitle = config.toDoTitle;
                        } else if ((msg.toDoTitle !== undefined) && (msg.toDoTitle !== '')) {
                            toDoTitle = msg.toDoTitle;
                        }                        
                        //
                        //  Creating the ATOM Entry document associated to the Section
                        //
                        newEntry = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
                        newEntry += '<entry xmlns="http://www.w3.org/2005/Atom" ';
                        newEntry += 'xmlns:app="http://www.w3.org/2007/app" ';
                        newEntry += 'xmlns:snx="http://www.ibm.com/xmlns/prod/sn" ';
                        newEntry += 'xmlns:os="http://a9.com/-/spec/opensearch/1.1/" ';
                        newEntry += 'xmlns:xhtml="http://www.w3.org/1999/xhtml" ';
                        newEntry += 'xmlns:thr="http://purl.org/syndication/thread/1.0">';
                        newEntry += '<title type="text">' + toDoTitle + '</title>';
                        newEntry += '<category scheme="http://www.ibm.com/xmlns/prod/sn/type" term="todo" label="To Do" />';
                        newEntry += '<content type="html">' + toDoDesc + '</content>';
                        newEntry += '<snx:position>0</snx:position>';
                        if (toDoUserId !== '') {
                            newEntry += '<snx:assignedto name="' + toDoUserName + '" userid="' + toDoUserId + '"/>';                                
                        }
                        if (toDoDate !== '') {
                            newEntry += '<snx:duedate>' + toDoDate + '</snx:duedate>';    
                        }
                        newEntry += '<thr:in-reply-to type="application/atom+xml" ';
                        newEntry += 'ref="urn:lsid:ibm.com:oa:' + containerId;
                        newEntry += '" source="snx:activity-id"/></entry>';
                        //
                        //  create the Section
                        //
                        myURL = server + "/activities/service/atom2/activity?activityUuid=" + activityId;
                        updateActivity(msg, myURL, newEntry, true);
                        break;
                }                    
            }
        );
    }
    
    RED.nodes.registerType("ICActivitiesUpdate", ICActivitiesUpdate);

}
