/*
Copyright IBM All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

module.exports = function(RED) {
    var __isDebug = process.env.ICDebug || false;
    var __moduleName = 'IC_Files';
  
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

    function ICFilesGet(config) {      
        RED.nodes.createNode(this,config);                
        //
        //  Global to access the custom HTTP Request object available from the
        //  ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		var node = this;

        //var mailExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        //const jsdom = require("jsdom");
        //const { JSDOM } = jsdom;
        var xml2js = require("xml2js");
        var parser = new xml2js.Parser();
        //var builder  = new xml2js.Builder({rootName: "content"});
        var server = "";
        var async = require("async");
        var pendingTasks = 0;
        var globalOutMsg = {};
        
        function _dummyCallback(err, item) {
            console.log('ICFilesGet._dummyCallback : ' + item);
        }
      
        function _beforeSend(label, theTasks, theMsg) {
            //
            //  This is where the MAGIC of Async happens
            //
            if (theTasks.length > 0) {
                console.log('ICFilesGet._beforeSend ('  + label + ' ): need to process ' + theTasks.length + ' async tasks...');
                async.parallel(theTasks, 
                               function(err, results) {
                                    if (pendingTasks > 0) {
                                        //
                                        //  Still something to do
                                        //
                                        console.log("ICFilesGet._beforeSend (" + label + " ) : there are still things to do.... " + pendingTasks);
                                    } else {
                                        //
                                        //  everything is finished. 
                                        //  we can return
                                        //
                                        console.log("ICFilesGet._beforeSend (" + label + " ) : ready to send final information....");
                                        node.send(globalOutMsg);
                                    }
                                }
                );                  
            } else {
                //
                //  Nothing asynchronous to do
                //  We can return immediatealy
                //
                if (pendingTasks > 0) {
                    console.log('ICFilesGet._beforeSend (' + label + ' ) : there are still things to do.... ' + pendingTasks);
                } else {
                    console.log('ICFilesGet._beforeSend (' + label + ' ) : nothing to execute... returning information');
                    node.send(globalOutMsg);
                }
            }
        }

        function _getDetail(record) {
            var type = '';
            //console.log(JSON.stringify(record, ' ', 2));
            if (record.category.length > 0) {
                for (let k = 0; k < record.category.length; k++) {
                    if (record.category[k]['$'].scheme === 'tag:ibm.com,2006:td/type') {
                        type = record.category[k]['$'].term;
                        break;
                    }
                }
            }
            if (type === 'document') {
                return _getFileDetail(record);
            } else {
                if (type === 'collection') {
                    return _getFolderDetail(record);
                } else {
                    return {};
                }
            }
        }

        function _getFileDetail(record) {
            var file = {};

            file.folderOrDocument = 'document';
            file.name = record.title[0]['_'];
            file.id = record['td:uuid'][0];
            if (record.summary[0]["_"]) {
                file.description = record.summary[0]["_"];
            } else {
                file.description = '';
            }
            file.size = ''; // filled Later
            file.type = '';  // filled later
            file.objectType = record['td:objectTypeName'][0];
            file.version = record['td:versionLabel'][0];
            file.libraryId = record['td:libraryId'][0];
            file.libraryType = record['td:libraryType'][0];
            if (record['td:isFiledInFolder']) file.isInFolder = record['td:isFiledInFolder'][0];
            file.external = record['snx:isExternal'][0];
            if (record['td:visibility']) file.visibility = record['td:visibility'][0];
            if (record['td:sharePermission']) file.sharePermission = record['td:sharePermission'][0];
            if (record['td:shared'] || record['td:sharedBy']) {
                file.shared = {};
                if (record['td:shared']) file.shared.time = record['td:shared'][0];
                if (record['td:sharedBy']) {
                    file.shared.name = record['td:sharedBy'][0].name[0];
                    file.shared.id = record['td:sharedBy'][0]['snx:userid'][0];
                }

            }
            if (record['td:policy']) {
                if (record['td:policy'][0]['td:organizationPublic']) file.organizationPublic = record['td:policy'][0]['td:organizationPublic'][0];
                if (record['td:policy'][0]['"td:contentFollowing']) file.following = record['td:policy'][0]['"td:contentFollowing'][0];
            }
            if (record['td:favorite']) file.favorite = record['td:favorite'][0];
            file.social = {};
            for (let k = 0; k < record['snx:rank'].length; k++) {
                switch (record['snx:rank'][k]['$'].scheme) {
                    case "http://www.ibm.com/xmlns/prod/sn/share":
                        file.social.share = record['snx:rank'][k]['_'];
                        break;
                    case "http://www.ibm.com/xmlns/prod/sn/comment":
                        file.social.comments = record['snx:rank'][k]['_'];
                        break;
                    case "http://www.ibm.com/xmlns/prod/sn/recommendations":
                        file.social.likes = record['snx:rank'][k]['_'];
                        break;
                    case "http://www.ibm.com/xmlns/prod/sn/hit":
                        file.social.downloads = record['snx:rank'][k]['_'];
                        break;
                    case "http://www.ibm.com/xmlns/prod/sn/anonymous_hit":
                        file.social.anon_downloads = record['snx:rank'][k]['_'];
                        break;
                    case "http://www.ibm.com/xmlns/prod/sn/collections":
                        file.social.collections = record['snx:rank'][k]['_'];
                        break;
                    case "http://www.ibm.com/xmlns/prod/sn/attachments":
                        file.social.attachments = record['snx:rank'][k]['_'];
                        break;
                    case "http://www.ibm.com/xmlns/prod/sn/versions":
                        file.social.versions = record['snx:rank'][k]['_'];
                        break;
                    case "http://www.ibm.com/xmlns/prod/sn/references":
                        file.social.references = record['snx:rank'][k]['_'];
                        break;
                }
            }
            file.links = {};
            for (let k = 0; k < record.link.length; k++) {
                switch (record.link[k]['$'].rel) {
                    case "alternate":
                        file.links.view = record.link[k]['$'].href;
                        break;
                    case "self":
                        file.links.href = record.link[k]['$'].href;
                        break;
                    case "thumbnail":
                        file.links.thumbnail = record.link[k]['$'].href;
                        break;
                    case "enclosure":
                        file.size = record.link[k]['$'].length;
                        file.type = record.link[k]['$'].type;
                        file.links.download = record.link[k]['$'].href;
                        break;
                    case "replies":
                        file.replies = {};
                        file.replies.href = record.link[k]['$'].href;
                        file.replies.count = record.link[k]['$']['thr:count'];
                        break;
                }
            }
            file.dates = {};
            file.dates.published = record.published[0];
            file.dates.updated = record.updated[0];
            file.dates.created = record['td:created'][0];
            file.dates.modified = record['td:modified'][0];
            if (record['td:added']) file.dates.added = record['td:added'][0];
            file.author = {};
            file.author.name = record.author[0].name[0];
            file.author.id = record.author[0]['snx:userid'][0];
            file.modifier = {};
            file.modifier.name = record['td:modifier'][0].name[0];
            file.modifier.id = record['td:modifier'][0]['snx:userid'][0];
            if (record['td:addedBy']) {
                file.addedBy = {};
                file.addedBy.name = record['td:addedBy'][0].name[0];
                file.addedBy.id = record['td:addedBy'][0]['snx:userid'][0];
            }
            file.tags = [];
            if (record.category.length > 0) {
                for (let k = 0; k < record.category.length; k++) {
                    if (record.category[k]['$'].scheme !== 'tag:ibm.com,2006:td/type') {
                        file.tags.push(record.category[k]['$'].term);
                    }
                }
            }
            return file;
        }

        function _getFolderDetail(record) {
            var folder = {};

            folder.folderOrDocument = 'folder';
            folder.name = record.title[0]['_'];
            folder.id = record['td:uuid'][0];
            if (record.summary[0]["_"]) {
                folder.description = record.summary[0]["_"];
            } else {
                folder.description = '';
            }
            folder.type = record['td:type'][0]; 
            if (record['td:visibility']) folder.visibility = record['td:visibility'][0];
            if (record['td:sharePermission']) folder.sharePermission = record['td:sharePermission'][0];
            if (record['td:shared'] || record['td:sharedBy']) {
                folder.shared = {};
                if (record['td:shared']) folder.shared.time = record['td:shared'][0];
                if (record['td:sharedBy']) {
                    folder.shared.name = record['td:sharedBy'][0].name[0];
                    folder.shared.id = record['td:sharedBy'][0]['snx:userid'][0];
                }
            }
            if (record['td:policy']) {
                if (record['td:policy'][0]['td:organizationPublic']) folder.organizationPublic = record['td:policy'][0]['td:organizationPublic'][0];
                if (record['td:policy'][0]['"td:contentFollowing']) folder.following = record['td:policy'][0]['"td:contentFollowing'][0];
            }
            if (record['td:favorite']) folder.favorite = record['td:favorite'][0];
            for (let k = 0; k < record['snx:rank'].length; k++) {
                switch (record['snx:rank'][k]['$'].scheme) {
                    case "http://www.ibm.com/xmlns/prod/sn/item":
                        folder.itemsInFolder = record['snx:rank'][k]['_'];
                        break;
                    case "http://www.ibm.com/xmlns/prod/sn/documents":
                        folder.documentsInFolder = record['snx:rank'][k]['_'];
                        break;
                    case "http://www.ibm.com/xmlns/prod/sn/collections":
                        folder.collectionsInFolder = record['snx:rank'][k]['_'];
                        break;
                    case "http://www.ibm.com/xmlns/prod/sn/user":
                        folder.usersForFolder = record['snx:rank'][k]['_'];
                        break;
                    case "http://www.ibm.com/xmlns/prod/sn/group":
                        folder.groupsForFolder = record['snx:rank'][k]['_'];
                        break;
                    default:
                        console.log('********** found special RANK ' + record['snx:rank'][k]['$'].scheme + ' for directory ' + record.title[0]['_']);
                        break;
                }
            }
            folder.links = {};
            for (let k = 0; k < record.link.length; k++) {
                switch (record.link[k]['$'].rel) {
                    case "alternate":
                        folder.links.alternate = record.link[k]['$'].href;
                        break;
                    case "self":
                        folder.links.self = record.link[k]['$'].href;
                        break;
                    case "files":
                        folder.links.files = record.link[k]['$'].href;
                        break;
                    case "container":
                        folder.links.container = record.link[k]['$'].href;
                        break;
                    default:
                        console.log('********** found special LINK ' + record.link[k]['$'].rel + ' for directory ' + record.title[0]['_'] + ' --> ' + record.link[k]['$'].href);
                        break;
                }
            }
            folder.dates = {};
            folder.dates.published = record.published[0];
            folder.dates.updated = record.updated[0];
            folder.dates.created = record['td:created'][0];
            folder.dates.modified = record['td:modified'][0];
            if (record['td:added']) folder.dates.added = record['td:added'][0];
            folder.author = {};
            folder.author.name = record.author[0].name[0];
            folder.author.id = record.author[0]['snx:userid'][0];
            folder.modifier = {};
            folder.modifier.name = record['td:modifier'][0].name[0];
            folder.modifier.id = record['td:modifier'][0]['snx:userid'][0];
            if (record['td:addedBy']) {
                folder.addedBy = {};
                folder.addedBy.name = record['td:addedBy'][0].name[0];
                folder.addedBy.id = record['td:addedBy'][0]['snx:userid'][0];
            }
            folder.tags = [];
            if (record.category.length > 0) {
                for (let k = 0; k < record.category.length; k++) {
                    if (record.category[k]['$'].scheme !== 'tag:ibm.com,2006:td/type') {
                        folder.tags.push(record.category[k]['$'].term);
                    }
                }
            }
            return folder;
        }
        
        function _defaultFilesFlags() {
            var out = '';
            out += 'includeTags=true&';
            out += 'includePath=true&';
            out += 'includeDocumentTypeTitle=true&';
            out += 'includeWorkingDrafts=true&';
            out += 'includeFavorite=true&';
            out += 'ps=500&';
            out += 'sortBy=modified&sortOrder=desc';
            return out;
        }
        
        function _defaultFoldersFlags() {
            var out = '';
            out += 'includeTags=true&';
            out += 'includePath=true&';
            out += 'includeFavorite=true&';
            out += 'ps=500&';
            out += 'sortBy=modified&sortOrder=desc';
            return out;
        }

        function _myFilesShares() {
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

        function _myFoldersShares() {
            if (config.myShares === "none") {
                return "";
            } else {
                if (config.myShares === "withMe") {
                    return "&sharedWithMe=true"
                } else {
                    return "&shared=true";
                }
            }
        }

        function _otherShares(theMsg) {
            if (config.otherShares === "none") {
                return "";
            } else {
                var mailAddr = '';
                if (config.userId !== '') {
                    mailAddr = config.userId;
                } else {
                    mailAddr = theMsg.userId;
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
            var out = '';
            switch (config.visibility) {
                case "private" :
                    out = "&visibility=private";
                    break;
                case "public" :
                    out = "&visibility=public"
                    break;
                case 'All':
                default:
                    break;
            }
            return out;
        }

        function _getFiles(theMsg, theURL, otherURL, isRecursive, isTopLevelFiles, isTopLevelFolders, callback) {
            var URL1 = theURL;
            var URL2 = otherURL;
            console.log('_getFiles : going to execute with URL ' + URL1);
            node.login.request(
                {
                    url: URL1, 
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                },
                function(error, response, body) {
                    console.log('_getFiles: returning on ' + URL1);
                    if (error) {
                        console.log("_getFiles: error getting information for Files : " + URL1 + " - ");
                        console.log(error);
                        node.status({fill:"red", shape:"dot", text:"No Files Info"});
                        node.error(error.toString(), theMsg);
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            console.log("_getFiles: GET OK (" + response.statusCode + ")");
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log("_getFiles: Parser Error on Url " + URL1);
                                    console.log(err);
                                    node.status({fill:"red", shape:"dot", text:"Parser Error"});
                                    node.error("_getFiles: Parser Error", theMsg);
                                }
                                let myData = new Array();
                                if (result.feed.entry) {
                                    for (let i=0; i < result.feed.entry.length; i++) {
                                        myData.push(_getDetail(result.feed.entry[i]));
                                    }
                                    node.status({});
                                } else {
                                    console.log('_getFiles: Empty feed for  : ' + URL1);
                                    node.status({fill:"yellow", shape:"dot", text:"Empty feed "});
                                }
                                if (isRecursive) {
                                    //
                                    //  We are dealing with recursion
                                    //
                                    console.log('_getFiles: Recursion ...');
                                    let asyncTasks = [];
                                    let label = '--';
                                    if (isTopLevelFiles) {
                                        //
                                        //  we are in the situation where we have retrieved the top level files
                                        //  We store them in the output message
                                        //
                                        theMsg.payload = myData;
                                        pendingTasks = 1;
                                        globalOutMsg = theMsg;
                                        label = 'topLevelFILES';
                                        console.log('_getFiles: Recursion: topLevelFiles retrieved...');
                                        //
                                        //  Now we have to retrieve the top level folders
                                        //
                                        asyncTasks.push(function(_dummyCallback) {
                                            _getFiles(theMsg, URL2, '', isRecursive, false, true, _dummyCallback);
                                        });
                                        console.log('_getFiles: Recursion: Pending Tasks after topLevelFiles = ' + pendingTasks);
                                    } else {
                                        if (isTopLevelFolders) {
                                            //
                                            //  we retrieved the top level folders
                                            //  we store them in the output message
                                            //
                                            console.log('_getFiles: Recursion: topLevelFolders retrieved...');
                                            label = 'topLevelFOLDERS';
                                            for (let i=0; i < myData.length; i++) {
                                                theMsg.payload.push(myData[i]);
                                            }
                                            pendingTasks--;
                                            //
                                            //  Now we need to parse each folder
                                            //
                                            for (let i=0; i < theMsg.payload.length; i++) {
                                                if (theMsg.payload[i].folderOrDocument === 'folder') {
                                                    pendingTasks++
                                                    console.log('_getFiles : Recursive : topLevelFolder QUEUING folder ' + theMsg.payload[i].name);
                                                    asyncTasks.push(function(_dummyCallback) {
                                                        _getFiles(theMsg.payload[i], 
                                                                    theMsg.payload[i].links.files + '?sC=all&category=all&includeAncestors=true&includeFavorite=true', 
                                                                    '', 
                                                                    isRecursive, 
                                                                    false, 
                                                                    false, 
                                                                    _dummyCallback);
                                                    });
                                                }
                                            }
                                            console.log('_getFiles: Recursion: Pending Tasks after topLevelFolders = ' + pendingTasks);
                                            callback(null, URL1);
                                        } else {
                                            //
                                            //  We are now processing a child folder (of any level)
                                            //
                                            console.log('_getFiles: Recursion: Intermediate Folder retrieved : ' + theMsg.name);
                                            label = theMsg.name;
                                            theMsg.children = myData;
                                            pendingTasks--;
                                            //
                                            //  Now we need to parse each folder
                                            //
                                            for (let i=0; i < theMsg.children.length; i++) {
                                                if (theMsg.children[i].folderOrDocument === 'folder') {
                                                    pendingTasks++;
                                                    console.log('_getFiles : Recursive : ' + theMsg.name + ' QUEUING folder ' + theMsg.children[i].name);
                                                    asyncTasks.push(function(_dummyCallback) {
                                                        _getFiles(theMsg.children[i], 
                                                                    theMsg.children[i].links.files + '?sC=all&category=all&includeAncestors=true&includeFavorite=true', 
                                                                    '', 
                                                                    isRecursive, 
                                                                    false, 
                                                                    false, 
                                                                    _dummyCallback);
                                                    });
                                                }
                                            }
                                            console.log('_getFiles: Recursion: Pending Tasks after ' + theMsg.name + ' = ' + pendingTasks);
                                            callback(null, URL1);
                                        }
                                    }
                                    if (pendingTasks > 0) _beforeSend(label, asyncTasks, theMsg);
                                } else {
                                    //
                                    //  no recursion
                                    //  Check if we need to get the Folders also
                                    //
                                    if (URL2 !== '') {
                                        //
                                        //  Yes, we need to get the folders also
                                        //
                                        console.log('_getFiles: No Recursion but filesAndFolders. Files retrieved, now going to chase topLevelFolders...');
                                        //
                                        //  Now we have to retrieve the top level folders
                                        //
                                        theMsg.payload = myData;
                                        _getFiles(theMsg, URL2, '', false, false, true, callback);
                                     } else {
                                        //
                                        //  Check if we are retrieving folders AFTER having retrieved Files
                                        //
                                        if (isTopLevelFolders) {
                                            console.log('_getFiles: No Recursion but filesAndFolders. Folders retrieved. Returning...');
                                            for (let i=0; i < myData.length; i++) {
                                                theMsg.payload.push(myData[i]);
                                            }
                                        } else {
                                            //
                                            //  We can safely wrap up
                                            //
                                            console.log('_getFiles: No recursion, no filesAndFolders.. .returning ...');
                                            theMsg.payload = myData;
                                        }
                                        node.send(theMsg);
                                    }
                                }
                            });
                        } else {
                            console.log("_getFiles: GET FILES NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red", shape:"dot", text:response.statusCode + ' : ' + response.statusMessage});
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
                var myURL = '';
                var otherURL = '';
                var isRecursive = false;
                var isTopLevelFiles = false;
                var isTopLevelFolders = false;
                //var asyncTasks = [];
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
                        switch (config.fORf) {
                            case 'files':
                                if (config.myShares === 'none') {
                                    myURL += "/api/myuserlibrary/feed?" + _defaultFilesFlags();
                                } else {
                                    myURL += "/api/documents/shared/feed?" + _defaultFilesFlags() + _myFilesShares();
                                }
                                break;
                            case 'folders':
                                if (config.myShares === 'none') {
                                    myURL += "/api/collections/feed?" + _defaultFoldersFlags() + '&creator=' + node.login.userId;
                                } else {
                                    myURL += "/api/collections/feed?" + _defaultFoldersFlags() + _myFoldersShares();
                                }
                                break;
                            case 'filesAndFolders':
                                //
                                //  We need to get the FILES and the FOLDERS first
                                //  then for each folder we need to get the collection etc ect (ONLY if isRecursive is TRUE)
                                //
                                otherURL = myURL + "/api/collections/feed?" + _defaultFoldersFlags() + '&creator=' + node.login.userId;
                                myURL += "/api/myuserlibrary/feed?" + _defaultFilesFlags();
                                if (config.isRecursive) {
                                    isRecursive = true;
                                    isTopLevelFiles = true;
                                }
                                break;
                        }
                        myURL += _isExternalOption() + _visibilityOption();
                        node.status({ fill: "blue", shape: "dot", text: "Retrieving..." });
                        _getFiles(msg, myURL, otherURL, isRecursive, isTopLevelFiles, isTopLevelFolders, _dummyCallback);
                        break;
                    case "person" :
                        //
                        //	Get Fils for someone else
                        //
                        if ((config.userId.trim() === '') && 
                            (!msg.userId || (msg.userId.trim() === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("ICFiles : Missing Person Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Person Info"});
                            node.error('Missing Person Info', msg);
                        } else {
                            var mailAddr = '';
                            if (config.userId.trim() !== '') {
                                mailAddr = config.userId.trim();
                            } else {
                                mailAddr = msg.userId.trim();
                            }
                            myURL = server + "/files";
                            if (node.login.authType === "oauth") {
                                myURL += '/oauth';
                            } else {
                                myURL += '/basic';
                            }
                            switch (config.fORf) {
                                case 'files':
                                    if (config.myShares === 'none') {
                                        myURL += "/api/userlibrary/" + mailAddr + "/feed?" + _defaultFilesFlags();
                                    } else {
                                        myURL += "/api/documents/shared/feed?" + _defaultFilesFlags() + _otherShares(msg);
                                    }
                                    break;
                                case 'folders':
                                    if (config.myShares === 'none') {
                                        myURL += "/api/collections/feed?" + _defaultFoldersFlags() + '&creator=' + mailAddr;
                                    } else {
                                        //
                                        //  *********** INVALID OPTION **********
                                        //
                                        myURL += "/api/collections/feed?" + _defaultFoldersFlags() + _myFoldersShares();
                                    }
                                    break;
                                case 'filesAndFolders':
                                    otherURL = myURL + "/api/collections/feed?" + _defaultFoldersFlags() + '&creator=' + mailAddr;
                                    myURL += "/api/userlibrary/" + mailAddr + "/feed?" + _defaultFilesFlags();
                                    if (config.isRecursive) {
                                        isRecursive = true;
                                        isTopLevelFiles = true;
                                    }
                                    break;
                            }
                            myURL += _isExternalOption() + _visibilityOption();
                            node.status({ fill: "blue", shape: "dot", text: "Retrieving..." });
                            _getFiles(msg, myURL, otherURL, isRecursive, isTopLevelFiles, isTopLevelFolders, _dummyCallback);
                        }
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
                        switch (config.fORf) {
                            case 'files':
                                myURL += "/anonymous/api/documents/feed?" + _defaultFilesFlags() + _isExternalOption() + '&visibility=public';
                                break;
                            case 'folders':
                                myURL += "/anonymous/api/collections/feed?" + _defaultFoldersFlags() + _isExternalOption() + '&visibility=public';
                                break;
                            case 'filesAndFolders':
                                otherURL = myURL + "/anonymous/api/collections/feed?" + _defaultFoldersFlags() + _isExternalOption() + '&visibility=public';
                                myURL += "/anonymous/api/documents/feed?" + _defaultFilesFlags() + _isExternalOption() + '&visibility=public';
                                if (config.isRecursive) {
                                    isRecursive = true;
                                    isTopLevelFiles = true;
                                }
                                break;
                        }
                        node.status({ fill: "blue", shape: "dot", text: "Retrieving..." });
                        _getFiles(msg, myURL, otherURL, isRecursive, isTopLevelFiles, isTopLevelFolders, _dummyCallback);
                        break;
                    case "community" :
                        //
                        //	Get Community Files
                        //
                        if ((config.communityId.trim() === '') && 
                            (!msg.communityId || (msg.communityId.trim() === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("ICFiles : Missing Community Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Community Info"});
                            node.error('Missing Community Info', msg);
                        } else {
                            node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                            let communityId = '';
                            if (config.communityId.trim() !== '') {
                                communityId = config.communityId.trim();
                            } else {
                                communityId = msg.communityId.trim();
                            }
                            myURL = server + "/files";
                            if (node.login.authType === "oauth") {
                                myURL += '/oauth';
                            } else {
                                myURL += '/basic';
                            }
                            myURL += "/api/communitycollection/" + communityId;
                            switch (config.fORf) {
                                case 'files':
                                    myURL += '/feed?sC=all&category=document&includeAncestors=true&includeFavorite=true';
                                    break;
                                case 'folders':
                                    myURL += '/feed?sC=all&category=collection&includeAncestors=true&includeFavorite=true';
                                    break;
                                case 'filesAndFolders':
                                    otherURL = myURL + '/feed?sC=all&category=collection&includeAncestors=true&includeFavorite=true';
                                    myURL += '/feed?sC=all&category=document&includeAncestors=true&includeFavorite=true';
                                    if (config.isRecursive) {
                                        isRecursive = true;
                                        isTopLevelFiles = true;
                                    }
                                    break;
                            }
                            myURL += _defaultFilesFlags() + _isExternalOption() +  _visibilityOption();
                            node.status({ fill: "blue", shape: "dot", text: "Retrieving..." });
                            _getFiles(msg, myURL, otherURL, isRecursive, isTopLevelFiles, isTopLevelFolders, _dummyCallback);
                        }
                        break;
                    case 'folder':
                        //
                        //	Get  Files from a folder
                        //
                        if ((config.folderId.trim() === '') && 
                            (!msg.folderId || (msg.folderId.trim() === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("ICFiles : Missing Folder Id  Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Folder ID  Info"});
                            node.error('Missing Community Info', msg);
                        } else {
                            node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                            let folderId = '';
                            if (config.folderId.trim() !== '') {
                                folderId = config.folderId.trim();
                            } else {
                                folderId = msg.folderId.trim();
                            }
                            myURL = server + "/files";
                            if (node.login.authType === "oauth") {
                                myURL += '/oauth';
                            } else {
                                myURL += '/basic';
                            }
                            myURL += "/api/collection/" + folderId;
                            switch (config.fORf) {
                                case 'files':
                                    myURL += '/feed?sC=all&category=document&includeAncestors=true&includeFavorite=true';
                                    break;
                                case 'folders':
                                    myURL += '/feed?sC=all&category=collection&includeAncestors=true&includeFavorite=true';
                                    break;
                                case 'filesAndFolders':
                                    otherURL = myURL + '/feed?sC=all&category=collection&includeAncestors=true&includeFavorite=true';
                                    myURL += '/feed?sC=all&category=document&includeAncestors=true&includeFavorite=true';
                                    if (config.isRecursive) {
                                        isRecursive = true;
                                        isTopLevelFiles = true;
                                    }
                                    break;
                            }
                            node.status({ fill: "blue", shape: "dot", text: "Retrieving..." });
                            _getFiles(msg, myURL, otherURL, isRecursive, isTopLevelFiles, isTopLevelFolders, _dummyCallback);
                        }
                        break;
                }
            }
        );
    }
    RED.nodes.registerType("ICFilesGet",  ICFilesGet);
    
    function ICFilePut(config) {
        RED.nodes.createNode(this, config);
        //
        // Global to access the custom HTTP Request object available from the
        // ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
        var node = this;

        //var mailExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        //var xml2js = require("xml2js");
        //var parser = new xml2js.Parser();
        var server = "";
        //var context = "";
        
        //
        // This to avoid issues on Self-Signed Certificates on Test Sites
        //
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

        this.on('input', function (msg) {
            var desc, filename, folder, tags;
            var serverConfig = RED.nodes.getNode(config.server);
            //
            // Server is a GLOBAL variable
            //
            server = serverConfig.getServer;
            //context = config.contextRoot.trim();
            if (msg.tags != undefined) {
                tags = msg.tags.split(/[ ,]+/);
            } else {
                tags = config.fileTags.split(/[ ,]+/);
            }
            if (msg.description != undefined) {
                desc = msg.description;
            } else {
                desc = config.fileDesc;
            }
            if (config.filename != "" && config.filename.split('.')[1] != undefined) {
                filename = config.filename.split('.')[0] + "_" + Date.now() + "." + config.filename.split('.')[1];
                //var filename = config.filename;
            } else {
                if (msg.filename != undefined) {
                    //var filename = msg.filename.split('.')[0]+"_"+ Date.now()+"."+msg.filename.split('.')[1];
                    filename = msg.filename;
                } else {

                    console.log("missing filename or type for file upload");
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Missing filename or type!"
                    });
                    return;
                }

            }
            if (msg.folder != undefined) {
                folder = msg.folder;
            } else {
                folder = config.fileFolder;
            }
            
            var targetId = "";
            switch (config.target) {
                case "mylib":
                    targetId = "myuserlibrary";
                    _addNonce(msg.payload, filename, msg, targetId, tags, desc, folder);
                    break;
                case "community":
                    if ((msg.communityId != undefined) && (msg.communityId != "")) {
                        targetId = "communitylibrary/" + msg.communityId;
                     } else {
                        targetId = "communitylibrary/" + config.communityId;
                     }
                    
                    _addNonce(msg.payload, filename, msg, targetId, tags, desc, folder);
                    break;
            }
        });
        
        //GET-Request for retrieving a NONCE from Connections
        function _addNonce(payload, filename, msg, targetId, tags, desc, folder) {
            var getURL = server + "/files/";
            getURL += node.login.authType + "/api/nonce";
            console.log("_getNonce : Get Nonce from: " + getURL);
            node.status({
                fill: "blue",
                shape: "dot",
                text: "Retrieving Nonce ..."
            });
            node.login.request({
                url: getURL,
                method: 'GET',
                headers: {}
            }, function (error, response, body) {
                if (error) {
                    console.log("_getNonce : error getting nonce!");
                    console.log(error.toString());
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Err1" + response.statusMessage
                    });
                    node.error(response.statusCode + ' : '
                        + response.statusMessage, msg);
                } else {
                    if (response.statusCode >= 200
                        && response.statusCode < 300) {
                        console.log("_getNonce : GET OK ("
                            + response.statusCode + ")");
                        node.status({});
                        console.log("_getNonce = " + body);

                        _postFile(body, payload, filename, msg, targetId, tags, desc, folder)

                    } else {
                        console.log("_getNonce NOT OK ("
                            + response.statusCode + ")");
                        console.log(body);
                        console.log(getURL);
                        console.log(response.statusMessage);
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "Err3 " + response.statusMessage
                        });
                        node.error(response.statusCode + ' : '
                            + response.statusMessage, msg);
                    }

                }
            });

        }
        
        //Executes a POST request for uploading the file to Connections
        function _postFile(nonce, payload, filename, msg, targetId, tags, desc, folder) {
            //console.log('=============== ' + targetId);
            var postURL = server + "/files/";
            postURL += node.login.authType + "/api/" + targetId + "/feed?";
            //attach tags as url parameter
            for (let i in tags) {
                postURL += "tag=" + tags[i] + "&";
            }
            node.status({
                fill: "blue",
                shape: "dot",
                text: "Posting File ..."
            });

			var options = {
				method : 'POST',
				url : postURL,
				headers : {
					'X-Update-Nonce' : nonce,
					'content-type' : 'multipart/form-data'
				},
				formData : {
					description : desc,
					label : filename,
					file : {
						value : payload,
						options : {
							filename : filename
						}
					}
				}
			};

            console.log("_postFile : Posting File to: " + postURL);          
            node.login.request(options, function (error, response, body) {
                    if (error) {
                        console.log("_postFile : error posting file!");
                        console.log(error.toString());
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: "Err1" + response.statusMessage
                        });
                        node.error(response.statusCode + ' : '
                            + response.statusMessage, msg);
                    } else {
                        if (response.statusCode >= 200
                            && response.statusCode < 300) {
                            console.log("_postFile : POST OK ("
                                + response.statusCode + ")");
                            
                            //parse response body to html
                            const cheerio = require('cheerio')
                            const $ = cheerio.load(body);
                            var str = $('body').html();
                            str = str.replace(/&quot;/g,'"')
                            str = str.replace(/&amp;/g,'&')
                            msg.payload=JSON.parse(str);
                            if (msg.payload.links!=undefined){
                                msg.fileUrl = msg.payload.links[1].href;                               
                                //prepare payload.attachments[] for using uploaded file within a status update
                                msg.payload.attachments = new Array(1);
                                msg.payload.attachments[0] = {};
                                msg.payload.attachments[0].displayName = msg.payload.title;
                                msg.payload.attachments[0].url = msg.fileUrl;
                                msg.payload.attachments[0].published = msg.payload.published;
                                msg.payload.attachments[0].image = {};
                                msg.payload.attachments[0].image.url = msg.payload.links[0].href.replace('entry','thumbnail');
                                //clear node's status and send msg
                                node.status({});
                                if (folder === "") {
                                    node.send(msg);
                                } else {
                                    console.log("folderName ="+folder);
                                    console.log("execute _moveFile");
                                    _moveFile(msg,folder);
                                }
                            }else{ //e.g. access denied
                                    console.log("_postFile NOT OK (" + response.statusCode + ")");
                                     console.log(body);
                                     console.log(postURL);
                                     console.log(response.statusMessage);
                                     node.status({
                                         fill: "red",
                                         shape: "dot",
                                         text: "Err3 " + msg.payload.errorCode
                                     });
                                     node.error(response.statusCode + ' : '
                                         + response.statusMessage, msg);
                            }
                            
                        } else {
                            console.log("_postFile NOT OK ("
                                + response.statusCode + ")");
                            console.log(body);
                            console.log(postURL);
                            console.log(response.statusMessage);
                            node.status({
                                fill: "red",
                                shape: "dot",
                                text: "Err3 " + response.statusMessage
                            });
                            node.error(response.statusCode + ' : '
                                + response.statusMessage, msg);
                        }
                    }
                });
        }
        //Moves the uploaded file to the spcified folder
        function _moveFile(msg, folder) {
            //post-request for moving the file
            console.log("_moveFile : Moving File to collection: " + folder);
            var itemId = msg.payload.id.replace("urn:lsid:ibm.com:td:", "");
            console.log(itemId);
            var postURL = server + "/files/";
            postURL += node.login.authType + "/api/collection/" + folder + "/feed?itemId=" + itemId;
            console.log("_moveFile : postURL: " + postURL);
            var options = {
                method: 'POST',
                url: postURL
            };

            node.status({
                fill: "blue",
                shape: "dot",
                text: "Moving file to folder ..."
            });
            node.login.request(options, function (error, response, body) {
                if (response.statusCode == 204) {
                    console.log("_moveFile: The file was successfully moved.");
                    //        			console.log("response: "+response);
                    //        			console.log("body: "+body);
                    node.status({});
                    msg.response = response;
                    node.send(msg);
                } else {
                    console.log("_moveFile NOT OK (" + response.statusCode + ")");
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "Folder Err3 " + response.statusMessage
                    });
                    node.error(response.statusCode + ' : ' + response.statusMessage, msg);
                    node.send(msg);
                }
            });
        }
    }

    RED.nodes.registerType("ICFilePut", ICFilePut);
}
