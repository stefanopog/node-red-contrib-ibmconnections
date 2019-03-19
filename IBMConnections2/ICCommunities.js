module.exports = function (RED) {

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

        function parseAtomEntry(entry, isAtom) {
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
                for (j = 0; j < entry.link.length; j++) {
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

        function parseMemberEntry(entry, isAtom) {
            var xml2js = require("xml2js");
            var builder = new xml2js.Builder({
                rootName: "entry"
            });
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
                                    for (i = 0; i < result.feed.entry.length; i++) {
                                        myData.push(parseAtomEntry(result.feed.entry[i], true));
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
                                    for (i = 0; i < result.feed.entry.length; i++) {
                                        myData.push(parseMemberEntry(result.feed.entry[i], true));
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
                thMail = theMail.trim();

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
        var xml2js = require("xml2js");
        var parser = new xml2js.Parser();

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
                }
            }
        );
    }

    RED.nodes.registerType("ICCommunitiesUpdate", ICCommunitiesUpdate);
};
