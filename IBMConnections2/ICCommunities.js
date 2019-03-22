/*
Copyright IBM All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

module.exports = function (RED) {
    var __isDebug = process.env.ICDebug || false;
    var __moduleName = 'IC_Communities';
  
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

    function ICCommunitiesGet(config) {
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

        function parseAtomEntry(entry) {
            var xml2js = require("xml2js");
            var builder = new xml2js.Builder({
                rootName: "entry"
            });
            var community = {};
            if (entry.title && entry.title[0]['_']) {
                community['title'] = entry.title[0]['_'];
            } else if (entry.title && entry.title[0]) {
                community['title'] = entry.title[0];
            }
            if (entry.id) {
                community['id'] = entry.id[0];
            }
            if (entry.link) {
                for (let j = 0; j < entry.link.length; j++) {
                    var tmp = entry.link[j];
                    if (tmp['$'].rel === "self") {
                        community['ref'] = tmp['$'].href;
                        break;
                    }
                }
            }
            if (entry['snx:communityType']) {
                community['communityType'] = entry['snx:communityType'][0];
            }
            if (entry['snx:isExternal']) {
                community['isExternal'] = entry['snx:isExternal'][0];
            }
            if (entry['snx:communityUuid']) {
                community['Uuid'] = entry['snx:communityUuid'][0];
            }
            community['entry'] = builder.buildObject(entry);
            community['originalentry'] = entry;
            return community;
        }

        function parseMemberEntry(entry) {
            //var xml2js = require("xml2js");
            //var builder = new xml2js.Builder({rootName: "entry"});
            var member = {};

            //console.log(JSON.stringify(entry, ' ', 2));
            member.name = entry.contributor[0].name[0];
            member.userState = entry.contributor[0]['snx:userState'][0]['_'];
            if (member.userState === 'active') {
                if (entry.contributor[0].email) {
                    member.mail = entry.contributor[0].email[0];
                } else {
                    member.mail = "UNDEFINED@UNDEFINED.COM";
                }
                member.userid = entry.contributor[0]['snx:userid'][0]['_'];
                member.isExternal = entry.contributor[0]['snx:isExternal'][0]['_'];
                member.role = entry['snx:role'][0]['_'];
                member.orgId = entry['snx:orgId'][0]['_'];
            }
            return member;
        }

        function getCommunityList(theMsg, theURL) {
            node.login.request(
                {
                    url: theURL,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                },
                function (error, response, body) {
                    console.log('getCommunityList: executing on ' + theURL);
                    if (error) {
                        console.log("getCommunityList : error getting information for CommunityList !");
                        node.status({fill: "red", shape: "dot", text: "No CommunityList"});
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
                                    console.log(err);
                                    node.status({fill: "red", shape: "dot", text: "Parser Error"});
                                    node.error("Parser Error getCommunityList", theMsg);
                                    return;
                                }
                                var myData = new Array();
                                if (result.feed.entry) {
                                    for (let i = 0; i < result.feed.entry.length; i++) {
                                        myData.push(parseAtomEntry(result.feed.entry[i]));
                                    }
                                    node.status({});
                                } else {
                                    console.log('getCommunityList: No ENTRY found for URL : ' + theURL);
                                    node.status({fill: "red", shape: "dot", text: "No Entry "});
                                }
                                theMsg.payload = myData;
                                node.send(theMsg);
                            });
                        } else {
                            console.log("GET COMMUNITY LIST NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill: "red", shape: "dot", text: "Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        }
                    }
                }
            );
        }

        function getCommunityById(theMsg, theURL) {
            node.login.request(
                {
                    url: theURL,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                },
                function (error, response, body) {
                    console.log('getCommunityById: executing on ' + theURL);
                    if (error) {
                        console.log("getCommunityById : error getting information for Community !");
                        node.status({fill: "red", shape: "dot", text: "No Community"});
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
                                    console.log(err);
                                    node.status({fill: "red", shape: "dot", text: "Parser Error"});
                                    node.error("Parser Error getCommunityById", theMsg);
                                    return;
                                }
                                var myData = '';
                                if (result.entry) {
                                    myData = parseAtomEntry(result.entry, true);
                                    node.status({});
                                } else {
                                    console.log('getCommunityById: No ENTRY found for URL : ' + theURL);
                                    node.status({fill: "red", shape: "dot", text: "No Entry "});
                                }
                                theMsg.payload = myData;
                                node.send(theMsg);
                            });
                        } else {
                            console.log("GET COMMUNITY BY ID NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill: "red", shape: "dot", text: "Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        }
                    }
                }
            );
        }

        function getCommunityMembers(theMsg, theURL) {
            node.login.request({
                    url: theURL,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml;"}
                },
                function (error, response, body) {
                    console.log('getCommunityMembers: executing on ' + theURL);
                    if (error) {
                        console.log("getCommunityMembers : error getting information for CommunityMembers !");
                        node.status({fill: "red", shape: "dot", text: "No CommunityMembers"});
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
                                    console.log(err);
                                    node.status({fill: "red", shape: "dot", text: "Parser Error"});
                                    node.error("Parser Error getCommunityMembers", theMsg);
                                    return;
                                }
                                var myData = new Array();
                                if (result.feed.entry) {
                                    for (let i = 0; i < result.feed.entry.length; i++) {
                                        myData.push(parseMemberEntry(result.feed.entry[i]));
                                    }
                                    node.status({});
                                } else {
                                    console.log('getCommunityMembers: No ENTRY found for URL : ' + theURL);
                                    node.status({fill: "red", shape: "dot", text: "No Entry "});
                                }
                                theMsg.payload = myData;
                                node.send(theMsg);
                            });
                        } else {
                            console.log("GET COMMUNITY MEMBERS NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill: "red", shape: "dot", text: "Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        }
                    }
                }
            ); 
        }

        this.on(
            'input',
            function (msg) {
                var serverConfig = RED.nodes.getNode(config.server);
                //
                //  Server is a GLOBAL variable
                //
                var server = serverConfig.getServer;
                var myURL  = server + "/communities/service/atom";
                if (node.login.authType === "oauth") myURL += '/oauth';
                var theTag = '';
                var theSearch = '';
                var theMail = '';
                if (config.communityTag != '') {
                    theTag = "&tag=" + config.communityTag.trim();
                } else if ((msg.communityTag != undefined) && (msg.communityTag != '')) {
                    theTag = "&tag=" + msg.communityTag.trim();
                }
                if (config.searchString != '') {
                    theSearch = '&search="' + config.searchString.trim() + '"';
                } else if ((msg.searchString != undefined) && (msg.searchString != '')) {
                    theSearch = '&search="' + msg.searchString.trim() + '"';
                }
                if (config.userId != '') {
                    theMail = config.userId.trim();
                } else if ((msg.userId != undefined) && (msg.userId != '')) {
                    theMail = msg.userId.trim();
                }
                theMail = theMail.trim();

                node.status({fill: "blue", shape: "dot", text: "Retrieving..."});
                switch (config.target) {
                    case "MyCommunities":
                        myURL +=  "/communities/my?sortBy=modified&sortOrder=desc&ps=10000";
                        myURL += theTag;
                        myURL += theSearch;
                        getCommunityList(msg, myURL);
                        break;
                    case "AllCommunities":
                        myURL += "/communities/all?sortBy=modified&sortOrder=desc&ps=10000";
                        myURL += theTag;
                        myURL += theSearch;
                        getCommunityList(msg, myURL);
                        break;
                    case "UserCommunities":
                        if (theMail === '') {
                            //
                            //  There is an issue
                            //
                            console.log("Missing userId Information");
                            node.status({fill: "red", shape: "dot", text: "Missing userID"});
                            node.error('Missing userID', msg);
                        } else {
                            myURL += "/communities/all?sortBy=modified&sortOrder=desc&ps=10000";
                            myURL += theTag;
                            myURL += theSearch;
                            if (mailExp.test(theMail)) {
                                myURL += "&email=" + theMail;
                            } else {
                                myURL += "&userId=" + theMail;
                            }
                            getCommunityList(msg, myURL);
                        }
                        break;
                    case "Members":
                        if ((config.communityId == '') && 
                            ((msg.communityId == undefined) || (msg.communityId == ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing CommunityId Information");
                            node.status({fill: "red", shape: "dot", text: "Missing CommunityID"});
                            node.error('Missing CommunityID', msg);
                        } else {
                            var communityId = '';
                            if (config.communityId != '') {
                                communityId = config.communityId.trim();
                            } else {
                                communityId = msg.communityId.trim();
                            }
                            myURL += "/community/members?communityUuid=" + communityId;
                            //
                            // get Profile By Tags
                            //
                            getCommunityMembers(msg, myURL);
                        }
                        break;
                    case "Id" :
                        if ((config.communityId == '') &&
                            ((msg.communityId == undefined) || (msg.communityId == ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing CommunityId Information");
                            node.status({ fill: "red", shape: "dot", text: "Missing CommunityID" });
                            node.error('Missing CommunityID', msg);
                        } else {
                            if (config.communityId != '') {
                                myURL += "/community/instance?communityUuid=" + config.communityId.trim();
                            } else {
                                myURL += "/community/instance?communityUuid=" + msg.communityId.trim();
                            }
                            //
                            // get Profile By Tags
                            //
                            getCommunityById(msg, myURL);
                        }
                        break;
                }
            }
        );
    }

    RED.nodes.registerType("ICCommunitiesGet", ICCommunitiesGet);

    function ICCommunitiesUpdate(config) {
        RED.nodes.createNode(this, config);
        //
        //  Global to access the custom HTTP Request object available from the
        //  ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		var node = this;

        var mailExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        //var xml2js = require("xml2js");
        //var parser = new xml2js.Parser();

        function addCommunityMember(theMsg, theURL, userRole, userLine) {
            var theBody = '';
            theBody = '<entry xmlns="http://www.w3.org/2005/Atom" xmlns:app="http://www.w3.org/2007/app" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/" xmlns:snx="http://www.ibm.com/xmlns/prod/sn">';
            theBody += '<contributor>' + userLine + '</contributor>';
            theBody += '<snx:role xmlns:snx="http://www.ibm.com/xmlns/prod/sn" component="http://www.ibm.com/xmlns/prod/sn/communities">' + userRole.toLowerCase() + '</snx:role>';
            theBody += '<category term="person" scheme="http://www.ibm.com/xmlns/prod/sn/type"></category></entry>';
            node.login.request({
                    url: theURL,
                    method: "POST",
                    body: theBody,
                    headers: {"Content-Type": "application/atom+xml"}
                },
                function (error, response, body) {
                    if (error) {
                        console.log("addCommunityMember : error gadding a member !");
                        node.status({fill: "red", shape: "dot", text: "error addMember"});
                        node.error(error.toString(), theMsg);
                    } else {
                        console.log('addCommunityMember: executing on ' + theURL);
                        theMsg.statusCode = response.statusCode;
                        theMsg.statusMessage = response.statusMessage;
                        if ((response.statusCode >= 200) && (response.statusCode < 300)) {
                            console.log("addCommunityMember OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({});
                            node.send(theMsg);
                        } else {
                            console.log("addCommunityMember NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            console.log(theURL);
                            node.status({fill: "red", shape: "dot", text: "Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.statusMessage, theMsg);
                        }
                    }
                }
            );
        }

        function removeCommunityMember(theMsg, theURL) {
            node.login.request({
                    url: theURL,
                    method: "DELETE",
                    headers: {"Content-Type": "application/atom+xml"}
                },
                function (error, response, body) {
                    if (error) {
                        console.log("removeCommunityMember : error removing a member !");
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "error RemoveMember"
                        });
                        node.error(error.toString(), theMsg);
                    } else {
                        console.log('removeCommunityMember: executing on ' + theURL);
                        theMsg.statusCode = response.statusCode;
                        theMsg.statusMessage = response.statusMessage;
                        if ((response.statusCode >= 200) && (response.statusCode < 300)) {
                            console.log("removeCommunityMember OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({});
                            node.send(theMsg);
                        } else {
                            console.log("removeCommunityMember NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            console.log(theURL);
                            node.status({fill: "red", shape: "dot", text: "Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.statusMessage, theMsg);
                        }
                    }
                }
            );
        }

        function changeImage(theMsg, theURL, commId, image) {
            node.login.request({
                url: theURL,
                method: "PUT",
                body: image,
                headers: {"Content-Type": "image/png"}
            },
            function (error, response, body) {
                if (error) {
                    console.log("changeCommunityImage : error changing image");
                    node.status({fill: "red", shape: "dot", text: "error changing image"});
                    node.error(error.toString(), theMsg);
                } else {
                    console.log('changeCommunityImage: run');
                    if ((response.statusCode >= 200) && (response.statusCode < 300)) {
                        console.log("changeCommunityImage OK (" + response.statusCode + ")");
                        console.log(body);
                        node.status({});
                        node.send(theMsg);
                    } else {
                        console.log("changeCommunityImage NOT OK (" + response.statusCode + ")");
                        console.log(body);
                        console.log(theURL);
                        node.status({fill: "red", shape: "dot", text: "Err3 " + response.statusMessage});
                        node.error(response.statusCode + ' : ' + response.statusMessage, theMsg);
                    }
                }
            });
        }

        this.on(
            'input',
            function (msg) {
                var serverConfig = RED.nodes.getNode(config.server);
                //
                //  Server is a GLOBAL variable
                //
                var server = serverConfig.getServer;
                var myURL = server + "/communities";
                if (node.login.authType === "oauth") myURL += '/oauth';
                var communityId = '';
                //
                //  Check if CommunityId is specified
                //
                if ((config.communityId == '') && 
                    ((msg.communityId == undefined) || (msg.communityId == ''))) {
                    //
                    //  There is an issue
                    //
                    console.log("Missing CommunityId Information");
                    node.status({fill: "red", shape: "dot", text: "Missing CommunityID"});
                    node.error('Missing CommunityID', msg);
                    return;
                } else {
                    if (config.communityId != '') {
                        communityId = config.communityId.trim();
                    } else {
                        communityId = msg.communityId.trim();
                    }
                }
                //
                //  Check if the user to be added/removed is specified
                //
                var userId = '';
                var communityImage = '';
                if (config.target === "AddMember" || config.target ==="RemoveMember") {
                    if ((config.email == '') &&
                        ((msg.userId == undefined) || (msg.userId == ''))) {
                        //
                        //  There is an issue
                        //
                        console.log("Missing UserId Information");
                        node.status({ fill: "red", shape: "dot", text: "Missing UserId" });
                        node.error('Missing UserId', msg);
                        return;
                    } else {
                        if (config.userId != '') {
                            userId = config.userId.trim();
                        } else {
                            userId = msg.userId.trim();
                        }
                    }
                } else {
                    if ((msg.communityImage == undefined || msg.communityImage == '')) {
                        //
                        //  There is an issue
                        //
                        console.log("Missing communityImage Information");
                        node.status({fill: "red", shape: "dot", text: "Missing communityImage"});
                        node.error('Missing communityImage', msg);
                        return;
                    } else {
                        communityImage = msg.communityImage;
                    }
                }
            
                //
                //  Initialize the display
                //
                node.status({fill: "blue", shape: "dot", text: "Updating..."});
                switch (config.target) {
                    case "AddMember":
                        var theLine = '';
                        if (mailExp.test(userId)) {
                            //
                            //  add By Mail
                            //
                            theLine = '<email>' + userId + '</email>';
                        } else {
                            //
                            //  Retrieve by Uuid
                            //
                            theLine = '<snx:userid xmlns:snx="http://www.ibm.com/xmlns/prod/sn">' + userId + '</snx:userid>';
                        }
                        myURL += "/service/atom/community/members?communityUuid=" + communityId;
                        //
                        // add new Member
                        //
                        addCommunityMember(msg, myURL, config.userRole, theLine);
                        break;
                    case "RemoveMember":
                        myURL += "/service/atom/community/members?communityUuid=" + communityId;
                        if (mailExp.test(userId)) {
                            //
                            //  add By Mail
                            //
                            myURL += '&email=' + userId;
                        } else {
                            //
                            //  Retrieve by Uuid
                            //
                            myURL += '&userid=' + userId;
                        }
                        //
                        // remove Member
                        //
                        removeCommunityMember(msg, myURL);
                        break;
                    case "ChangeImage":
                        myURL += "/service/html/image?communityUuid=" + communityId;
                        changeImage(msg, myURL, communityId, communityImage);
                        break;
                }
            }
        );
    }

    RED.nodes.registerType("ICCommunitiesUpdate", ICCommunitiesUpdate);

    function ICCommunityNew(config) {
        RED.nodes.createNode(this,config);
        //
        //  Global to access the custom HTTP Request object available from the
        //  ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
        var node = this;

        function createCommunity(theMsg, theURL, commTitle, commDesc) {
            var theBody = '';
            theBody += '<entry xmlns="http://www.w3.org/2005/Atom" xmlns:app="http://www.w3.org/2007/app" xmlns:snx="http://www.ibm.com/xmlns/prod/sn">';
            theBody += '<title type="text">' + commTitle + '</title>';
            theBody += '<content type="html">' + commDesc + '</content>';
            theBody += '<category term="community" scheme="http://www.ibm.com/xmlns/prod/sn/type"></category>';
            theBody += '<snx:communityType>private</snx:communityType>';
            theBody += ' <snx:isExternal>true</snx:isExternal>';
            theBody += '</entry>';

            node.login.request({
                url: theURL,
                method: "POST",
                body: theBody,
                headers: {"Content-Type": "application/atom+xml"}
            },
            function (error, response, body) {
                if (error) {
                    if (response.statusCode == 409) {
                        console.log("createCommunity : community already exists");
                        node.status({fill: "red", shape: "dot", text: "community already exists"});
                        node.error(error.toString(), theMsg);
                    } else {
                        console.log("createCommunity : error creating community");
                        node.status({fill: "red", shape: "dot", text: "error createCommunity"});
                        node.error(error.toString(), theMsg);
                    }
                } else {
                    console.log('createCommunity: run');
                    theMsg.statusCode = response.statusCode;
                    theMsg.statusMessage = response.statusMessage;
                    let communityLocation = response.headers.location;
                    if ((response.statusCode >= 201) && (response.statusCode < 300)) {
                        console.log("createCommunity OK (" + response.statusCode + ")");
                        console.log(body);
                        console.log(communityLocation);
                        theMsg.payload = communityLocation.split('communityUuid=')[1];
                        node.status({});
                        node.send(theMsg);
                    } else {
                        console.log("createCommunity NOT OK (" + response.statusCode + ")");
                        console.log(body);
                        console.log(theURL);
                        node.status({fill: "red", shape: "dot", text: "Err3 " + response.statusMessage});
                        node.error(response.statusCode + ' : ' + response.statusMessage, theMsg);
                    }
                }
            });
        }

        this.on(
            'input',
            function(msg) {
                var serverConfig = RED.nodes.getNode(config.server);
                //
                //  Server is a GLOBAL variable
                //
                var server = serverConfig.getServer;
                var myURL = server + "/communities";
                if (node.login.authType === "oauth") myURL += '/oauth';
                let communityTitle = '';
                let communityDescription = '';
                if ((config.communityTitle == '') &&
                    ((msg.communityTitle == undefined || msg.communityTitle == ''))) {
                    //
                    //  There is an issue
                    //
                    console.log("Missing CommunityTitle Information");
                    node.status({fill: "red", shape: "dot", text: "Missing CommunityTitle"});
                    node.error('Missing CommunityTitle', msg);
                    return;
                } else if ((config.communityDescription == '') &&
                    ((msg.communityDescription == undefined || msg.communityDescription == ''))) {
                    //
                    //  There is an issue
                    //
                    console.log("Missing communityDescription Information");
                    node.status({fill: "red", shape: "dot", text: "Missing communityDescription"});
                    node.error('Missing communityDescription', msg);
                    return;
                } else {
                    if (config.communityTitle != '') {
                        communityTitle = config.communityTitle.trim();
                    } else {
                        communityTitle = msg.communityTitle.trim();
                    }
                    if (config.communityDescription != '') {
                        communityDescription = config.communityDescription.trim();
                    } else {
                        communityDescription = msg.communityDescription.trim();
                    }
                    node.status({fill: "blue", shape: "dot", text: "Creating..."});
                    myURL += "/service/atom/communities/my";
                    createCommunity(msg, myURL, communityTitle, communityDescription);
                }
            }
        )
    }

    RED.nodes.registerType("ICCommunityNew", ICCommunityNew);
};
