module.exports = function(RED) {
    function ICFilesGet(config) {      
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
        var server = "";

        function _getFileDetail(record) {
            console.log(JSON.stringify(record, ' ', 2));
            var file = {};

            file['name'] = record.title[0]['_'];
            file['id'] = record['td:uuid'][0];
            file['version'] = record['td:versionLabel'][0];
            file['libraryId'] = record['td:libraryId'][0];
            file['libraryType'] = record['td:libraryType'][0];
            if (record['td:visibility']) file['visibility'] = record['td:visibility'][0];
            if (record['summary'][0]["_"]) {
                file['description'] = record['summary'][0]["_"];
            } else {
                file['description'] = '';
            }
            file['external'] = record['snx:isExternal'][0];
            file['social'] = {};
            for (let k = 0; k < record['snx:rank'].length; k++) {
                switch (record['snx:rank'][k]['$'].scheme) {
                    case "http://www.ibm.com/xmlns/prod/sn/share":
                        file['social']['share'] = record['snx:rank'][k]['_'];
                        break;
                    case "http://www.ibm.com/xmlns/prod/sn/comment":
                        file['social']['comments'] = record['snx:rank'][k]['_'];
                        break;
                    case "http://www.ibm.com/xmlns/prod/sn/recommendations":
                        file['social']['likes'] = record['snx:rank'][k]['_'];
                        break;
                    case "http://www.ibm.com/xmlns/prod/sn/hit":
                        file['social']['downloads'] = record['snx:rank'][k]['_'];
                        break;
                    case "http://www.ibm.com/xmlns/prod/sn/anonymous_hit":
                        file['social']['anon_downloads'] = record['snx:rank'][k]['_'];
                        break;
                }
            }
            file['links'] = {};
            for (let k = 0; k < record['link'].length; k++) {
                switch (record['link'][k]['$'].rel) {
                    case "alternate":
                        file['links']['view'] = record['link'][k]['$'].href;
                        break;
                    case "self":
                        file['links']['href'] = record['link'][k]['$'].href;
                        break;
                    case "thumbnail":
                        file['links']['thumbnail'] = record['link'][k]['$'].href;
                        break;
                    case "enclosure":
                        file['size'] = record['link'][k]['$'].length;
                        file['type'] = record['link'][k]['$'].type;
                        file['links']['download'] = record['link'][k]['$'].href;
                    break;
                };
            }
            file['dates'] = {};
            file['dates']['published'] = record['published'][0];
            file['dates']['updated'] = record['updated'][0];
            file['dates']['created'] = record['td:created'][0];
            file['dates']['modified'] = record['td:modified'][0];
            file['author'] = {};
            file['author']['name'] = record['author'][0]['name'][0];
            file['author']['id'] = record['author'][0]['snx:userid'][0];
            file['modifier'] = {};
            file['modifier']['name'] = record['td:modifier'][0]['name'][0];
            file['modifier']['id'] = record['td:modifier'][0]['snx:userid'][0];
            file['tags'] = [];
            if (record['category'].length > 1) {
                for (let k = 1; k < record['category'].length; k++) {
                    file['tags'].push(record['category'][k]['$'].term);
                }
            }
            return file;
        }

        function _myShares() {
            if (config.myShares === "none") {
                return "";
            } else {
                if (config.myShares === "withMe") {
                    return "&direction=inbound"
                } else {
                    return "&direction=outbound";
                }
            }
        }

        function _otherShares() {
            if (config.otherShares === "none") {
                return "";
            } else {
                var mailAddr = '';
                if (config.userId !== '') {
                    mailAddr = config.userId;
                } else {
                    mailAddr = msg.userId;
                }
                if (config.otherShares === "with") {
                    return "&sharedWith=" + mailAddr;
                } else {
                    return "&sharedBy=" + mailAddr;
                }
            }
        }

        function _isExternalOption() {
            if (config.isExternal === "Both") {
                return "";
            } else if (config.isExternal === "Only") {
                return "&isExternal=true"
            } else {
                return "&isExternal=false";
            }
        }

        function _visibilityOption() {
            if (config.visibility === "Both") {
                return "";
            } else if (config.visibility === "Private") {
                return "&visibility=private"
            } else {
                return "&visibility=public";
            }
        }

        function _getFiles(theMsg, theURL) {
            console.log('_getFiles : with URL ' + theURL);
            node.login.request(
                {
                    url: theURL, 
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                },
                function(error, response, body) {
                    console.log('_getFiles: executing on ' + theURL);
                    if (error) {
                        console.log("error getting information for Files : " + theURL + " - " + error);
                        node.status({fill:"red",shape:"dot",text:"No Files Info"});
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
                                    node.error("_getFiles: Parser Error", theMsg);
                                    return;
                                }
                                if (result.feed.entry) {
                                    var myData = new Array();
                                    for (i=0; i < result.feed.entry.length; i++) {
                                        myData.push(_getFileDetail(result.feed.entry[i]));
                                    }
                                    theMsg.payload = myData;
                                    node.status({});
                                    node.send(theMsg);
                                } else {
                                    console.log('_getFiles: Missing <ENTRY> element : ' + result);
                                    node.status({fill:"yellow",shape:"dot",text:"No Entry "});
                                    theMsg.payload = {};
                                    node.send(theMsg);
                                    //node.error('getForOther: Missing <ENTRY> element', theMsg);
                               }
                            });
                        } else {
                            console.log("_getFiles: GET FILES NOT OK (" + response.statusCode + ")");
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
                var myURL = "";
                //
                //  Server is a GLOBAL variable
                //
                server   =  serverConfig.getServer;
                node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                switch (config.target) {
                    case "myself" :
                        //
                        // get my files
                        //
                        node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                        myURL = server + "/files";
                        if (node.login.authType === "oauth") {
                            myURL += '/oauth';
                        } else {
                            myURL += '/basic';
                        }
                        let myShares = _myShares();
                        if (myShares === '') {
                            myURL += "/api/myuserlibrary/feed?includeTags=true&includePath=true&ps=500&sortBy=modified&sortOrder=desc";
                        } else {
                            myURL += "/api/documents/shared/feed?includeTags=true&includePath=true&ps=500&sK=created&sO=dsc&sC=docshare" + myShares;
                        }
                        myURL += _isExternalOption() + _visibilityOption();
                        _getFiles(msg, myURL);
                        break;
                    case "public" :
                        //
                        // get Public Files
                        //
                        node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                        myURL = server + "/files";
                        if (node.login.authType === "oauth") {
                            myURL += '/oauth';
                        } else {
                            myURL += '/basic';
                        }
                        myURL += "/anonymous/api/documents";
                        myURL += "/feed?includeTags=true&includePath=true&ps=500&sortBy=modified&sortOrder=desc" + _isExternalOption() + '&visibility=public';
                        _getFiles(msg, myURL);
                        break;
                    case "community" :
                        //
                        //	Get Community Files
                        //
                        if ((config.communityId === '') && 
                            ((msg.communityId === undefined) || (msg.communityId === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("ICFiles : Missing Community Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Community Info"});
                            node.error('Missing Community Info', msg);
                        } else {
                            node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                            var communityId = '';
                            if (config.communityId !== '') {
                                communityId = config.communityId;
                            } else {
                                communityId = msg.communityId;
                            }
                            myURL = server + "/files";
                            if (node.login.authType === "oauth") {
                                myURL += '/oauth';
                            } else {
                                myURL += '/basic';
                            }
                            myURL += "/api/communitycollection/" + communityId.trim();
                            myURL += "/feed?includeTags=true&includePath=true&ps=500&sortBy=modified&sortOrder=desc" + _isExternalOption() +  _visibilityOption();
                            //
                            // get Profile Informations
                            //
                            _getFiles(msg, myURL);
                        }
                        break;
                    case "person" :
                        //
                        //	Get Fils for someone else
                        //
                        if ((config.userId === '') && 
                            ((msg.userId === undefined) || (msg.userId === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("ICFiles : Missing Person Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Person Info"});
                            node.error('Missing Person Info', msg);
                        } else {
                            var mailAddr = '';
                            if (config.userId !== '') {
                                mailAddr = config.userId;
                            } else {
                                mailAddr = msg.userId;
                            }
                            myURL = server + "/files";
                            if (node.login.authType === "oauth") {
                                myURL += '/oauth';
                            } else {
                                myURL += '/basic';
                            }
                            let otherShares = _otherShares();
                            if (otherShares === '') {
                                myURL += "/api/userlibrary/" + mailAddr.trim() + "/feed?includeTags=true&includePath=true&ps=500&sortBy=modified&sortOrder=desc";
                            } else {
                                myURL += "/api/documents/shared/feed?includeTags=true&includePath=true&ps=500&sK=created&sO=dsc&sC=docshare" + otherShares;
                            }
                            myURL += _isExternalOption() + _visibilityOption();
                            node.status({ fill: "blue", shape: "dot", text: "Retrieving..." });
                            _getFiles(msg, myURL);
                        }
                        break;
                }
             }
        );
    }
    
    RED.nodes.registerType("ICFilesGet",  ICFilesGet);
    
}
