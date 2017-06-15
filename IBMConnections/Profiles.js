module.exports = function(RED) {
    function ProfilesGet(config) {      
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
        var builder  = new xml2js.Builder({rootName: "content"});
        var server = "";
        
        function _getUserDetail(record) {
            var person = {};
            var tmp = '';
            //
            //  This function retrieves the photo "sp_XX:div" from the VCARD
            //
            var kk = (function (a) { return a[Object.keys(a)[1]]})(record.content[0]);
            
            tmp = record.id[0];
            if (config.vcard) person['vcard'] = builder.buildObject(record.content[0]);
            if (config.key || config.links) person['key'] = tmp.split(':entry')[1];
            if (config.uuid) person['userid'] = record.contributor[0]['snx:userid'][0];
            if (config.mail) person['mail'] = record.contributor[0]['email'][0];
            if (config.thename) person['name'] = record.contributor[0]['name'][0];
            try {
                //if (config.photo) person['photo'] = record.content[0]['sp_0:div'][0]['span'][0]['div'][0]['img'][0]['$'].src;
                if (config.photo) person['photo'] = kk[0]['span'][0]['div'][0]['img'][0]['$'].src;
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
                            console.log(body);
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
                                    node.status({fill:"red",shape:"dot",text:"No Entry "});
                                    node.error('getForMe: Missing <ENTRY> element', theMsg);
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
            console.log(theURL);
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
                            console.log(body);
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
                                        //  Since this is another REST call, the task to 
                                        //  return control to the flow is left to the 
                                        //  function that will be invoked (and, thus, to
                                        //  its callback function)
                                        //
                                        _getProfileLinks(theMsg, theMsg.payload);
                                    } else {
                                        //
                                        //  Safely return node results as no other action 
                                        //  is required
                                        //
                                        node.status({});
                                        node.send(theMsg);
                                    }
                                } else {
                                    console.log('getForOther: Missing <ENTRY> element : ' + result);
                                    node.status({fill:"red",shape:"dot",text:"No Entry "});
                                    node.error('getForOther: Missing <ENTRY> element', theMsg);
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
                            console.log(body);
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
                                    //
                                    var myData = new Array();
                                    for (i=0; i < result.feed.entry.length; i++) {
                                        myData.push(_getUserDetail(result.feed.entry[i]));
                                    }
                                    theMsg.payload = myData;
                                    node.status({});
                                    node.send(theMsg);
                                } else {
                                    console.log('getByParams: Missing <ENTRY> element : ' + result);
                                    node.error('getByParams: Missing <ENTRY> element', theMsg);
                                    node.status({fill:"red",shape:"dot",text:"No Entry "});
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

        //
        //  The following method must be called as the last one of a chain since it performs 
        //  the closing operations and the transfer to the flow
        //  When an error is found, it does NOT return an error to the flow. 
        //  It simples signals with a YELLOW DOT and DOES NOT fill the payload.linkroll 
        //  property
        //
        function _getProfileLinks(theMsg, data) {
            var theURL = server + '/profiles';
            if (node.login.authType === "oauth") theURL += '/oauth';
            theURL += '/atom/profileExtension.do?key=' + data.key + '&extensionId=profileLinks';
            node.login.request(
                {
                    url: theURL,
                    method: "GET"
                },
                function(error,response,body) {
                    if (error) {
                        console.log("error getting profileLinks for profile : " + theURL + " - " + error);
                        node.status({fill:"yellow",shape:"dot",text:"No Profile Info"});
                    } else {
                        if (response.statusCode == 200) {
                            console.log("GET OK (" + response.statusCode + ")");
                            console.log(body);
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"yellow",shape:"dot",text:"Parser Error _getProfileLinks"});
                                } else {
                                    var links = [];
                                    for (i=0; i < result.linkroll.link.length; i++) {
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
                    node.send(theMsg);
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
                            myURL += '/atom/search.do?"' + freeSyntax + '"';
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
    
    RED.nodes.registerType("ProfilesGet",  ProfilesGet);
    
}
