/* eslint-disable no-useless-escape */
/*
Copyright IBM All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

module.exports = function (RED) {
    const ICX = require('./common.js');
    const xml2js = require("xml2js");
    const imageSize = require('image-size');
    const __isDebug = ICX.__getDebugFlag();
    var   __verboseOutput = __isDebug;
    const __moduleName = 'IC_Communities';
    const mailExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    const urlExp = /^(https?|chrome|localhost):\/\/[^\s$.?#].[^\s]*$/;
    const winFilePath = /^([a-zA-Z]\:|\\\\[^\/\\:*?"<>|]+\\[^\/\\:*?"<>|]+)(\\[^\/\\:*?"<>|]+)+(\.[^\/\\:*?"<>|]+)$/;
    const unixFilePath = /^(\/)?([^\/\0]+(\/)?)+$/;
    const encodedImageExp = /^data:(image\/(gif|png|jpeg|jpg));base64,(.*)$/;

    console.log("*****************************************");
    console.log("* Debug mode is " + (__isDebug ? "enabled" : "disabled") + ' for module ' + __moduleName);
    console.log("*****************************************");
  
    function parseAtomEntry(entry) {
        var community = {};
        if (entry.title && entry.title[0]['_']) {
            community.title = entry.title[0]['_'];
        } else if (entry.title && entry.title[0]) {
            community.title = entry.title[0];
        }
        if (entry.id) community.id = entry.id[0];
        if (entry['snx:communityType']) community.communityType = entry['snx:communityType'][0];
        if (entry['snx:isExternal']) community.isExternal = entry['snx:isExternal'][0];
        if (entry['snx:communityUuid']) community.Uuid = entry['snx:communityUuid'][0];
        if (entry['snx:membercount']) community.memberCount = entry['snx:membercount'][0];
        if (entry['snx:orgId']) community.orgId = entry['snx:orgId'][0];
        if (entry.published) community.published = entry.published[0];
        if (entry.updated) community.updated = entry.updated[0];
        if (entry.author) {
            community.author = {};
            community.author.name = entry.author[0].name[0];
            community.author.userid = entry.author[0]['snx:userid'][0];
        }
        if (entry.content && entry.content[0] && entry.content[0]['_']) {
            community.content = entry.content[0]['_'];
        }
        if (entry.summary && entry.summary[0] && entry.summary[0]['_']) {
            community.summary = entry.summary[0]['_'];
        }
        community.tags = [];
        for (let i=0; i < entry.category.length; i++) {
            if (!entry.category[i]['$'].scheme) community.tags.push(entry.category[i]['$'].term);
        }
        if (entry.link) {
            community.links = {};
            for (let j = 0; j < entry.link.length; j++) {
                let tmp = entry.link[j];
                if (tmp['$'].rel === "self") {
                    community.ref = tmp['$'].href;
                }
                try {
                    let rel = tmp['$'].rel;
                    rel = rel.replace('http://www.ibm.com/xmlns/prod/sn/', '');
                    community.links[rel] = tmp['$'].href;
                } catch (err) {
                    ICX.__logJson(__moduleName, true, 'error Parsing Entry ', tmp);
                    ICX.__logJson(__moduleName, true, 'error is ', err);
                }
            }
        }
        if (__verboseOutput) {
            let builder = new xml2js.Builder({rootName: "entry"});
            community.entry = builder.buildObject(entry);
            community.originalentry = entry;
        }
        return community;
    }
    function parseMemberEntry(entry) {
        var member = {};
        member.name = entry.contributor[0].name[0];
        member.userState = entry.contributor[0]['snx:userState'][0]['_'];
        if (member.userState === 'active') {
            if (entry.contributor[0].email) {
                member.mail = entry.contributor[0].email[0];
            } else {
                member.mail = "UNDEFINED@UNDEFINED.COM";
            }
            member.userid = entry.contributor[0]['snx:userid'][0]['_'];
            if (entry.contributor[0]['snx:isExternal']) member.isExternal = entry.contributor[0]['snx:isExternal'][0]['_'];
            member.role = entry['snx:role'][0]['_'];
            if (entry.category) {
                for (let i=0; i < entry.category.length; i++) {
                    if (entry.category[i]['$'] && entry.category[i]['$'].term && (entry.category[i]['$'].term === 'business-owner')) {
                        member.role = 'business-owner';
                        break;
                    }
                }
            }
            member.orgId = entry['snx:orgId'][0]['_'];
        }
        return member;
    }
    function parseAtomEntryApplications(entry) {
        var app = {};
        app.type = entry.category[0]['$'].term;
        app.title = entry.title[0]['_'];
        app.content = entry.content[0]['_'];
        app.published = entry.published[0];
        app.updated = entry.updated[0];
        app.author = {};
        app.author.name = entry.author[0].name[0];
        app.author.userid = entry.author[0]['snx:userid'][0]['_'];
        app.links = {};
        for (let i=0; i < entry.link.length; i++) {
            app.links[entry.link[i]['$'].rel.replace('http://www.ibm.com/xmlns/prod/sn/remote-application/', '')] = entry.link[i]['$'].href;
        }
        return app;
    }
    function parseAtomEntryWidgets(entry) {
        var widget = {};
        widget.id = entry.id[0];
        widget.title = entry.title[0]['_'];
        widget.category = entry.category[0]['$'].term;
        if (entry['snx:widgetDefId']) widget.widgetDefId = entry['snx:widgetDefId'][0];
        if (entry['snx:widgetInstanceId']) widget.widgetInstanceId = entry['snx:widgetInstanceId'][0];
        widget.hidden = entry['snx:hidden'][0];
        if (entry['snx:location']) widget.location = entry['snx:location'][0];
        widget.links = {};
        for (let i=0; i < entry.link.length; i++) {
            widget.links[entry.link[i]['$'].rel.replace('http://www.ibm.com/xmlns/prod/sn/remote-application/', '')] = entry.link[i]['$'].href;
        }
        return widget;
    }

    function createAddMemberDocument(mailAddress, userId, name, role, orgId) {
        var isBusinessOwner = false;
        if (role === 'business-owner') isBusinessOwner = true;
        var theDocument =
        `<entry xmlns="http://www.w3.org/2005/Atom" xmlns:app="http://www.w3.org/2007/app" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/" xmlns:snx="http://www.ibm.com/xmlns/prod/sn">
        <contributor>
          <email>${mailAddress}</email>
          <snx:userid xmlns:snx="http://www.ibm.com/xmlns/prod/sn">${userId}</snx:userid>
          <snx:userState xmlns:snx="http://www.ibm.com/xmlns/prod/sn">active</snx:userState>
          <snx:isExternal xmlns:snx="http://www.ibm.com/xmlns/prod/sn">false</snx:isExternal>
          <name>${name}</name>
        </contributor>        
        <snx:role xmlns:snx="http://www.ibm.com/xmlns/prod/sn" component="http://www.ibm.com/xmlns/prod/sn/communities">${role}</snx:role>
        ${isBusinessOwner ? '<category term="business-owner" scheme="http://www.ibm.com/xmlns/prod/sn/type" />' : ''}
        <category term="person" scheme="http://www.ibm.com/xmlns/prod/sn/type" />
        <snx:orgId xmlns:snx="http://www.ibm.com/xmlns/prod/sn">${orgId}</snx:orgId>
      </entry>`;
      return theDocument;
    }
    function createAddWidgetDocument(widgetId, title, location) {
        var selectLocation = false;
        if (location && (location.trim() !== '')) selectLocation = true;
        var theDocument =
        `<?xml version="1.0" encoding="UTF-8"?>
        <entry xmlns:snx="http://www.ibm.com/xmlns/prod/sn" xmlns="http://www.w3.org/2005/Atom">>        
        <title type="text">${title}</title>
        <category term="widget" scheme="http://www.ibm.com/xmlns/prod/sn/type" />
        <snx:widgetDefId>${widgetId}</snx:widgetDefId>       
        <snx:widgetCategory />
        <snx:hidden>false</snx:hidden>
        ${selectLocation ? "<snx:location>" + location + "</snx:location>" : ""}
        </entry>`;
      return theDocument;
    }

    async function getCommunityById(loginNode, communityId) {
        var theURL = loginNode.getServer + "/communities/service/atom/community/instance?communityUuid=" + communityId;
        var __msgText = 'error getting information for CommunityById2';
        var __msgStatus = 'No getCommunityById';
        try {
            ICX.__log(__moduleName, true, 'getCommunityById: executing on ' + theURL);
            let response = await loginNode.rpn(
                {
                    url: theURL,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "getCommunityById OK", response);
            //
            //	We got the Community.
            //  Now we parse it
            //
            __msgText = 'Parser error in getCommunityById !';
            __msgStatus = 'Parser Error';
            let result = await ICX.__getXmlAttribute(response);
            if (result.entry) {
                let myData = parseAtomEntry(result.entry);
                ICX.__log(__moduleName, true, 'getCommunityById: Succesfully Parsed 1 entry...');
                return myData;
            } else {
                ICX.__log(__moduleName, true, 'getCommunityById: No ENTRY found for URL : ' + theURL);
                return null;
            }
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "getCommunityById : " + __msgText, error);
            throw error;
        }
    }
    async function updateCommunity(loginNode, body, communityId) {
        var theURL = loginNode.getServer + "/communities/service/atom/community/instance?communityUuid=" + communityId;
        var __msgText = 'error getting information for updateCommunity';
        var __msgStatus = 'No updateCommunity';
        try {
            ICX.__log(__moduleName, true, 'updateCommunity: executing on ' + theURL);
            let response = await loginNode.rpn(
                {
                    url: theURL,
                    method: "PUT",
                    body: body,
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "updateCommunity OK", response);
            //
            //	We got the Updated Community.
            //  Now we parse it
            //
            __msgText = 'Parser error in updateCommunity !';
            __msgStatus = 'Parser Error';
            let result = await ICX.__getXmlAttribute(response);
            if (result.entry) {
                let myData = parseAtomEntry(result.entry);
                ICX.__log(__moduleName, true, 'updateCommunity: Succesfully Parsed 1 entry...');
                return myData;
            } else {
                ICX.__log(__moduleName, true, 'updateCommunity: No ENTRY found for URL : ' + theURL);
                return null;
            }
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "updateCommunity : " + __msgText, error);
            throw error;
        }
    }
    async function getCommunityList(loginNode, theURL) {
        var __msgText = 'error getting information for CommunityList2';
        var __msgStatus = 'No getCommunityList';
        try {
            ICX.__log(__moduleName, true, 'getCommunityList: executing on ' + theURL);
            let response = await loginNode.rpn(
                {
                    url: theURL,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "getCommunityList OK", response);
            //
            //	We got the list of Communities.
            //  Now parse it
            //
            __msgText = 'Parser error in getCommunityList !';
            __msgStatus = 'Parser Error';
            let result = await ICX.__getXmlAttribute(response);
            if (result.feed.entry) {
                let myData = new Array();
                for (let i = 0; i < result.feed.entry.length; i++) {
                    myData.push(parseAtomEntry(result.feed.entry[i]));
                }
                ICX.__log(__moduleName, true, 'getCommunityList: Succesfully Parsed ' + result.feed.entry.length + ' entries...');
                ICX.__logJson(__moduleName, __isDebug, 'getCommunityList: Here is the result...', myData);
                return myData;
            } else {
                ICX.__log(__moduleName, true, 'getCommunityList: No ENTRY found for URL : ' + theURL);
                return null;
            }
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "getCommunityList : " + __msgText, error);
            throw error;
        }
    }
    async function getCommunityApplications(loginNode, communityId) {
        var theURL = loginNode.getServer + "/communities/service/atom/community/remoteApplications?communityUuid=" + communityId;
        var __msgText = 'error getting information for getCommunityApplications';
        var __msgStatus = 'No getCommunityApplications';
        try {
            ICX.__log(__moduleName, true, 'getCommunityApplications: executing on ' + theURL);
            let response = await loginNode.rpn(
                {
                    url: theURL,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "getCommunityApplications OK", response);
            //
            //	We got the list of Communities.
            //  Now parse it
            //
            __msgText = 'Parser error in getCommunityApplications !';
            __msgStatus = 'Parser Error';
            let result = await ICX.__getXmlAttribute(response);
            if (result.feed.entry) {
                let myData = new Array();
                for (let i = 0; i < result.feed.entry.length; i++) {
                    myData.push(parseAtomEntryApplications(result.feed.entry[i]));
                }
                ICX.__log(__moduleName, true, 'getCommunityApplications: Succesfully Parsed ' + result.feed.entry.length + ' entries...');
                ICX.__logJson(__moduleName, __isDebug, 'getCommunityApplications: Here is the result...', myData);
                return myData;
            } else {
                ICX.__log(__moduleName, true, 'getCommunityApplications: No ENTRY found for URL : ' + theURL);
                return null;
            }
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "getCommunityApplications : " + __msgText, error);
            throw error;
        }
    }
    async function getCommunityWidgets(loginNode, communityId) {
        var theURL = loginNode.getServer + "/communities/service/atom/community/widgets?communityUuid=" + communityId;
        var __msgText = 'error getting information for getCommunityWidgetss';
        var __msgStatus = 'No getCommunityWidgetss';
        try {
            ICX.__log(__moduleName, true, 'getCommunityWidgetss: executing on ' + theURL);
            let response = await loginNode.rpn(
                {
                    url: theURL,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "getCommunityWidgetss OK", response);
            //
            //	We got the list of Communities.
            //  Now parse it
            //
            __msgText = 'Parser error in getCommunityWidgetss !';
            __msgStatus = 'Parser Error';
            let result = await ICX.__getXmlAttribute(response);
            if (result.feed.entry) {
                let myData = new Array();
                for (let i = 0; i < result.feed.entry.length; i++) {
                    //myData.push(result.feed.entry[i]);
                    myData.push(parseAtomEntryWidgets(result.feed.entry[i]));
                }
                ICX.__log(__moduleName, true, 'getCommunityWidgetss: Succesfully Parsed ' + result.feed.entry.length + ' entries...');
                ICX.__logJson(__moduleName, __isDebug, 'getCommunityWidgetss: Here is the result...', myData);
                return myData;
            } else {
                ICX.__log(__moduleName, true, 'getCommunityWidgetss: No ENTRY found for URL : ' + theURL);
                return null;
            }
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "getCommunityWidgetss : " + __msgText, error);
            throw error;
        }
    }
    async function addCommunityWidget(loginNode, communityId, widgetDoc) {
        var theURL = loginNode.getServer + "/communities/service/atom/community/widgets?communityUuid=" + communityId;
        var __msgText = 'error getting information for addCommunityWidget';
        var __msgStatus = 'No addCommunityWidget';
        try {
            ICX.__log(__moduleName, true, 'addCommunityWidget: executing on ' + theURL);
            let response = await loginNode.rpn(
                {
                    url: theURL,
                    method: "POST",
                    body: widgetDoc,
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "addCommunityWidget OK", response);
            return response;
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "addCommunityWidget : " + __msgText, error);
            throw error;
        }
    }
    async function getCommunityImage(loginNode, communityId) {
        var theURL = loginNode.getServer + "/communities/service/html/image?communityUuid=" + communityId;
        var __msgText = 'error getting information for getCommunityImage';
        var __msgStatus = 'No getCommunityImage';
        try {
            ICX.__log(__moduleName, true, 'getCommunityImage: executing on ' + theURL);
            let response = await loginNode.rpn(
                {
                    url: theURL,
                    method: "GET",
                    headers: {"Content-Type": "image/*"},
                    encoding: 'binary'
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "getCommunityImage OK", response);
            return response;
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "getCommunityImage : " + __msgText, error);
            throw error;
        }
    }
    async function updateCommunityImage(loginNode, communityId, theImage, mime) {
        var theURL = loginNode.getServer + "/communities/service/html/image?communityUuid=" + communityId;
        var __msgText = 'error getting information for updateCommunityImage';
        var __msgStatus = 'No updateCommunityImage';
        try {
            ICX.__log(__moduleName, true, 'updateCommunityImage: executing on ' + theURL);
            let response = await loginNode.rpn(
                {
                    url: theURL,
                    method: "PUT",
                    body: theImage,
                    headers: {"Content-Type": mime}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "updateCommunityImage OK", response);
            return response;
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "updateCommunityImage : " + __msgText, error);
            throw error;
        }
    }
    async function getCommunityMembers(loginNode, communityId) {
        var theURL = loginNode.getServer + "/communities/service/atom/community/members?communityUuid=" + communityId;
        var __msgText = 'error getting information for getCommunityMembers';
        var __msgStatus = 'No getCommunityMembers';
        try {
            ICX.__log(__moduleName, true, 'getCommunityMembers: executing on ' + theURL);
            let response = await loginNode.rpn(
                {
                    url: theURL,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "getCommunityMembers OK", response);
            //
            //	We got the Community Members.
            //  Now we parse it
            //
            __msgText = 'Parser error in getCommunityMembers !';
            __msgStatus = 'Parser Error';
            let result = await ICX.__getXmlAttribute(response);
            if (result.feed.entry) {
                let myData = new Array();
                for (let i = 0; i < result.feed.entry.length; i++) {
                    myData.push(parseMemberEntry(result.feed.entry[i]));
                }
                ICX.__log(__moduleName, true, 'getCommunityMembers: Succesfully Parsed ' + result.feed.entry.length + ' entries...');
                return myData;
            } else {
                ICX.__log(__moduleName, true, 'getCommunityMembers: No ENTRY found for URL : ' + theURL);
                return null;
            }
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "getCommunityMembers : " + __msgText, error);
            throw error;
        }
    }
    async function addCommunityMember(loginNode, communityId, memberDoc) {
        var theURL = loginNode.getServer + "/communities/service/atom/community/members?communityUuid=" + communityId;
        var __msgText = 'error getting information for addCommunityMember';
        var __msgStatus = 'No addCommunityMember';
        try {
            ICX.__log(__moduleName, true, 'addCommunityMember: executing on ' + theURL);
            let response = await loginNode.rpn(
                {
                    url: theURL,
                    method: "POST",
                    body: memberDoc,
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "addCommunityMember OK", response);
            return response;
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "addCommunityMember : " + __msgText, error);
            throw error;
        }
    }
    async function deleteCommunityMember(loginNode, communityId, userId) {
        var theURL = loginNode.getServer + "/communities/service/atom/community/members?communityUuid=" + communityId + '&userid=' + userId;
        var __msgText = 'error getting information for deleteCommunityMember';
        var __msgStatus = 'No deleteCommunityMember';
        try {
            ICX.__log(__moduleName, true, 'deleteCommunityMember: executing on ' + theURL);
            let response = await loginNode.rpn(
                {
                    url: theURL,
                    method: "DELETE",
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "deleteCommunityMember OK", response);
            return response;
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "deleteCommunityMember : " + __msgText, error);
            throw error;
        }
    }

    function ICCommunitiesGet(config) {
        RED.nodes.createNode(this, config);
        //
        //  Global to access the custom HTTP Request object available from the
        //  ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		var node = this;
        //
        //  Main Processing
        //
        this.on(
            'input',
            function (msg) {
                //
                //  Server is a GLOBAL variable
                //
                var myURL  = node.login.getServer + "/communities/service/atom/communities/my?sortBy=modified&sortOrder=desc&ps=100";
                if (node.login.authType === "oauth") myURL += '/oauth';
                //
                //  Get the Inputs
                //
                var theTag = ICX.__getOptionalInputString(__moduleName, config.communityTag, msg.communityTag, 'Tag', node);
                if (theTag !== '') theTag = "&tag=" + theTag;
                var theSearch = ICX.__getOptionalInputString(__moduleName, config.searchString, msg.searchString, 'Search', node);
                if (theSearch !== '') theSearch = '&search="' + theSearch + '"';
                var showLogo = false;
                var showMembers = false;
                var showWidgets = false;
                var showApplications = false;
                if (config.target !== "Members") {
                    if (config.showLogo) showLogo = config.showLogo;
                    if (config.showMembers) showMembers = config.showMembers;
                    if (config.showWidgets) showWidgets = config.showWidgets;
                    if (config.showApplications) showApplications = config.showApplications;
                }
                //
                //  Initialize UI
                //
                node.status({fill: "blue", shape: "dot", text: "Retrieving..."});
                //
                //  Start Processing....
                //
                switch (config.target) {
                    case "MyCommunities":
                        myURL += theTag;
                        myURL += theSearch;
                        getCommunityList(node.login, myURL).then(async function(myData) {
                            try {
                                if (myData) {
                                    //
                                    //  Get The Community Applications, Widgets, Members and Logo
                                    //
                                    for (let i=0; i < myData.length; i++) {
                                        node.status({fill: "green", shape: "dot", text: "...community #" + i + " /" + myData.length});
                                        if (showApplications) myData[i].remoteApplications = await getCommunityApplications(node.login, myData[i].Uuid);
                                        if (showWidgets) myData[i].widgets = await getCommunityWidgets(node.login, myData[i].Uuid);
                                        if (showMembers) myData[i].members = await getCommunityMembers(node.login, myData[i].Uuid);
                                        if (showLogo) myData[i].logo = await getCommunityImage(node.login, myData[i].Uuid);
                                    }
                                    //
                                    //  Give out results
                                    //
                                    node.status({});
                                    msg.payload = myData;
                                } else {
                                    node.status({fill: "yellow", shape: "dot", text: "No Entry "});
                                    msg.payload = null;
                                }
                                node.send(msg);
                            } catch(error) {
                                ICX.__logError(__moduleName, "ERROR INSIDE getting MyCommunities", null, error, msg, node);
                            }
                        })
                        .catch(error => {
                            ICX.__logError(__moduleName, "ERROR getting MyCommunities", null, error, msg, node);
                        });
                        break;
                    case "AllCommunities":
                        myURL += theTag;
                        myURL += theSearch;
                        getCommunityList(node.login, myURL).then(async function(myData) {
                            try {
                                if (myData) {
                                    //
                                    //  Get The Community Applications, Widgets, Members and Logo
                                    //
                                    for (let i=0; i < myData.length; i++) {
                                        node.status({fill: "green", shape: "dot", text: "...community #" + i + " /" + myData.length});
                                        if (showApplications) myData[i].remoteApplications = await getCommunityApplications(node.login, myData[i].Uuid);
                                        if (showWidgets) myData[i].widgets = await getCommunityWidgets(node.login, myData[i].Uuid);
                                        if (showMembers) myData[i].members = await getCommunityMembers(node.login, myData[i].Uuid);
                                        if (showLogo) myData[i].logo = await getCommunityImage(node.login, myData[i].Uuid);
                                    }
                                    //
                                    //  Give out results
                                    //
                                    node.status({});
                                    msg.payload = myData;
                                } else {
                                    node.status({fill: "yellow", shape: "dot", text: "No Entry "});
                                    msg.payload = null;
                                }
                                node.send(msg);
                            } catch(error) {
                                ICX.__logError(__moduleName, "ERROR INSIDE getting AllCommunities", null, error, msg, node);
                            }
                        })
                        .catch(error => {
                            ICX.__logError(__moduleName, "ERROR getting AllCommunities", null, error, msg, node);
                        });
                        break;
                    case "UserCommunities": {
                            let theMail = ICX.__getMandatoryInputString(__moduleName, config.userId , msg.userId, '', 'UserId', msg, node);
                            myURL += theTag;
                            myURL += theSearch;
                            if (mailExp.test(theMail)) {
                                myURL += "&email=" + theMail;
                            } else {
                                myURL += "&userId=" + theMail;
                            }
                            getCommunityList(node.login, myURL).then(async function(myData) {
                                try {
                                    if (myData) {
                                        //
                                        //  Get The Community Applications, Widgets, Members and Logo
                                        //
                                        for (let i=0; i < myData.length; i++) {
                                            node.status({fill: "green", shape: "dot", text: "...community #" + i + " /" + myData.length});
                                            if (showApplications) myData[i].remoteApplications = await getCommunityApplications(node.login, myData[i].Uuid);
                                            if (showWidgets) myData[i].widgets = await getCommunityWidgets(node.login, myData[i].Uuid);
                                            if (showMembers) myData[i].members = await getCommunityMembers(node.login, myData[i].Uuid);
                                            if (showLogo) myData[i].logo = await getCommunityImage(node.login, myData[i].Uuid);
                                        }
                                        //
                                        //  Give out results
                                        //
                                        node.status({});
                                        msg.payload = myData;
                                    } else {
                                        node.status({fill: "yellow", shape: "dot", text: "No Entry "});
                                        msg.payload = null;
                                    }
                                    node.send(msg);
                                } catch(error) {
                                    ICX.__logError(__moduleName, "ERROR INSIDE getting UserCommunities", null, error, msg, node);
                                }
                            })
                            .catch(error => {
                                ICX.__logError(__moduleName, "ERROR getting UserCommunities", null, error, msg, node);
                            });
                        }
                        break;
                    case "Members": {
                            let communityId = ICX.__getMandatoryInputString(__moduleName, config.communityId , msg.IC_communityId, '', 'CommunityId', msg, node);
                            if (communityId) {
                                getCommunityMembers(node.login, communityId).then(async function(myData) {
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
                                        ICX.__logError(__moduleName, "ERROR INSIDE getting Members", null, error, msg, node);
                                    }
                                })
                                .catch(error => {
                                    ICX.__logError(__moduleName, "ERROR getting Members", null, error, msg, node);
                                });
                            }
                        }
                        break;
                    case "Id" : {
                            let communityId = ICX.__getMandatoryInputString(__moduleName, config.communityId , msg.IC_communityId, '', 'CommunityId', msg, node);
                            if (communityId) {
                                getCommunityById(node.login, communityId).then(async function(myData) {
                                    try {
                                        if (myData) {
                                            if (showApplications) myData.remoteApplications = await getCommunityApplications(node.login, myData.Uuid);
                                            if (showWidgets) myData.widgets = await getCommunityWidgets(node.login, myData.Uuid);
                                            if (showMembers) myData.members = await getCommunityMembers(node.login, myData.Uuid);        
                                            if (showLogo) myData.logo = await getCommunityImage(node.login, myData.Uuid);
                                            //
                                            //  Give out results
                                            //
                                            node.status({});
                                            msg.payload = myData;
                                        } else {
                                            node.status({fill: "yellow", shape: "dot", text: "No Entry "});
                                            msg.payload = null;
                                        }
                                        node.send(msg);
                                    } catch(error) {
                                        ICX.__logError(__moduleName, "ERROR INSIDE getting ommunitiesById", null, error, msg, node);
                                    }
                                })
                                .catch(error => {
                                    ICX.__logError(__moduleName, "ERROR getting CommunitiesById", null, error, msg, node);
                                });
                            }
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

        async function tttt() {
            return;
        }

        this.on(
            'input',
            function (msg) {
                //
                //  Server is a GLOBAL variable
                //
                var communityURL = node.login.getServer + "/communities";
                if (node.login.authType === "oauth") myURL += '/oauth';
                //
                //  Check if CommunityId is specified
                //
                var communityId = ICX.__getMandatoryInputString(__moduleName, config.communityId , msg.IC_communityId, '', 'CommunityId', msg, node);
                if (!communityId) return;
                //
                //  Get Community Title if present
                //
                var communityTitle = ICX.__getOptionalInputString(__moduleName, config.communityTitle, msg.IC_communityTitle, 'Community Title', node);
                //
                //  Get Community Desc if Present
                //
                var communityDesc = ICX.__getOptionalInputString(__moduleName, config.communityDesc, msg.IC_communityDesc, 'Community Desc', node);
                //
                //  Get Community Tags (if present)
                //
                var communityTags = ICX.__getOptionalInputString(__moduleName, config.communityTags, msg.IC_communityTags, 'Community Tags', node);
                var communityTagsReplace = false;
                if (communityTags !== '') {
                    //
                    //  There are TAGS, either from Configuration Panel or form Msg
                    //
                    if (config.communityTags.trim()) {
                        //
                        //  From Configuration Panel.
                        //  Check if to be added or to replace entirely the existing ones
                        //
                        communityTagsReplace = config.replaceTags;
                    } else {
                        //
                        //  From the incoming Msg.
                        //  If the string is enclosed in PARENTHESIS (aka "(" and ")") then the tags will REPLACE the existing ones
                        //
                        const inParenthesis = /^(\()([\w-]*[,\s\w-]*)\)$/;
                        if (communityTags.match(inParenthesis)) {
                            //
                            //  Incoming string had parenthesis
                            //
                            communityTagsReplace = true;
                            communityTags = communityTags.replace('(', '').replace(')', '');
                        } else {
                            communityTagsReplace = false;
                        }
                    }
                }
                //
                //  Get Logo  Information
                //
                var logoBytes = null;
                var logoFrom = config.imageFrom.trim();
                if (logoFrom !== '') {
                    if (logoFrom !== 'fromMsg') {
                        if (logoFrom !== 'none') {
                            //
                            //  The Image comes from the configuration Panel
                            //
                            if (logoFrom === 'localFile') {
                                logoBytes = config.localImageBytes;
                            } else {
                                logoBytes = config.internetImageBytes;
                            }
                            if (logoBytes === '') {
                                //
                                //  There is a problem
                                //
                                ICX.__logError(__moduleName, "The image corrsponding to<" + logoFrom + "> has not been loaded", null, null, msg, node);
                                return;
                            }
                        } else {
                            //
                            //  Nothing to do
                            //
                        }
                    } else {
                        //
                        //  Parsing information from input Message
                        //  the msg.IC_logoFrom is a string which could either contain the path to a file available on the NodeRED server,
                        //  or the URL to an image available on the internet
                        //
                        if (msg.IC_logoFrom) {
                            //
                            //  Check if it is a syntactically valid path or URL
                            //
                            logoFrom = msg.IC_logoFrom.trim();
                            if (logoFrom.match(urlExp) || logoFrom.match(unixFilePath) || logoFrom.match(winFilePath)) {
                                //
                                //  The input is valid
                                //  We will verify this later if it corresponds to an existing file
                                //
                            } else {
                                ICX.__logError(__moduleName, "Invalid IC_logoFrom from input Message: " + logoFrom, null, null, msg, node);
                                return;    
                            }
                        } else {
                            ICX.__logError(__moduleName, "Missing IC_logoFrom from input Message", null, null, msg, node);
                            return;    
                        }
                    }
                } else {
                    ICX.__logError(__moduleName, "Missing Image From string from configuration panel", null, null, msg, node);
                    return;    
                }
                //
                //  Get Member Mgmt Information
                //
                var memberMgmt = config.target.trim();
                var theMembers = [];
                if (memberMgmt !== '') {
                    const allowedRoles = ['owner', 'member', 'business-owner'];
                    const allowedActions = ['AddMember', 'RemoveMember'];
                    if (memberMgmt !== 'fromMsg') {
                        //
                        //  Configuration available from Configuration Panel
                        //
                        if (memberMgmt !== 'none') {
                            if (allowedActions.includes(memberMgmt)) {
                                //
                                //  Valid Value in Configuration Panel
                                //  Retrieve Members now
                                //
                                let theUsers = config.userId.trim();
                                if (theUsers !== '') {
                                    //
                                    //  We have users. Build an array of ouf them
                                    //
                                    let theIdsArray = theUsers.split(',');
                                    //
                                    //  get the ROLE
                                    //
                                    let theRole = config.userRole.trim();
                                    if (allowedRoles.includes(theRole)) {
                                        //
                                        //  Valid Role
                                        //  Build Final Array
                                        //
                                        for (let i=0; i < theIdsArray.length; i++) {
                                            let tmp = {};
                                            tmp.user = theIdsArray[i].trim();
                                            tmp.action = memberMgmt;
                                            tmp.role = theRole;
                                            theMembers.push(tmp);
                                        }
                                    } else {
                                        //
                                        //  Unknown value from Configuration Panel
                                        //
                                        ICX.__logError(__moduleName, "Invalid 'Member Role Mgmt' string : " + theRole, null, null, msg, node);
                                        return;
                                    }
                                }
                            } else {
                                //
                                //  Unknown value from Configuration Panel
                                //
                                ICX.__logError(__moduleName, "Invalid 'Member Mgmt' string : " + memberMgtm, null, null, msg, node);
                                return;
                            }
                        } else {
                            //
                            //  Nothing to do
                            //
                        }
                    } else {
                        //
                        //  Information comes from Message
                        //
                        if (msg.IC_communityMembers && Array.isArray(msg.IC_communityMembers)) {
                            theMembers = msg.IC_communityMembers;
                            //
                            //  Check if syntax is correct
                            //
                            for (let i=0; i < theMembers.length; i++) {
                                if (theMembers[i].action && (typeof theMembers[i].action === 'string')) {
                                    //
                                    //  attribute "Action" is present
                                    //
                                    let theAction = theMembers[i].action.trim();
                                    if (allowedActions.includes(theMembers[i].action)) {
                                        theMembers[i].action = theAction;
                                        theMembers[i].user = theMembers[i].user.trim();
                                        if (theAction === 'AddMember') {
                                            if (theMembers[i].role && (typeof theMembers[i].role === 'string')) {
                                                //
                                                //  attribute "role" is present
                                                //
                                                let theRole = theMembers[i].role.trim();
                                                if (allowedRoles.includes(theRole)) {
                                                    theMembers[i].role = theRole;
                                                } else {
                                                    //
                                                    //  Wrong Role String
                                                    //
                                                    ICX.__logError(__moduleName, "Invalid Member Role Mgmt string (position " + i + ") : " + theRole, null, null, msg, node);
                                                    return;
                                                }
                                            } else {
                                                ICX.__logError(__moduleName, "Missing Member Role Mgmt string (position " + i + ")", null, null, msg, node);
                                                return;    
                                            }
                                        } else {
                                            //
                                            //  Role not required for RemoveMember
                                            //
                                        }
                                    } else {
                                        //
                                        //  Wrong Member Operation String
                                        //
                                        ICX.__logError(__moduleName, "Invalid Member Mgmt string (position " + i + ") : " + theAction, null, null, msg, node);
                                        return;    
                                    }
                                } else {
                                    ICX.__logError(__moduleName, "Missing Member Mgmt string (position " + i + ")", null, null, msg, node);
                                    return;    
                                }
                            }
                        } else {
                            //
                            //  There is a problem
                            //
                            ICX.__logError(__moduleName, "Expecting members information from msg.IC_communityMembers", null, null, msg, node);
                            return;    
                        }
                    }
                } else {
                    ICX.__logError(__moduleName, "Missing Member Mgmt string from configuration panel", null, null, msg, node);
                    return;    
                }
                //
                //  At this point, theMembers is an array where each item is fully specified (user, role, action)
                //
                //
                //  Get the Widgets
                //
                var widgetMgmt = config.target2.trim();
                var theWidgets = [];
                if (widgetMgmt !== '') {
                    const allowedActions = ['AddWidget', 'RemoveWidget'];
                    const allowedWidgets = ["ImportantBookmarks",
                    "StatusUpdates",
                    "description",
                    "Files",
                    "Tags",
                    "RichContent",
                    "Wiki",
                    "Forum",
                    "Bookmarks",
                    "Blog",
                    "IdeationBlog",
                    "Gallery",
                    "Calendar",
                    "RichContent",
                    "FeaturedSurvey",
                    "Surveys",
                    "MembersSummary",
                    "Activities",
                    "SubcommunityNav",
                    "RelatedCommunities",
                    "Connections Engagement Center"];
                    if (widgetMgmt !== 'fromMsg') {
                        //
                        //  Configuration available from Configuration Panel
                        //
                        if (widgetMgmt !== 'none') {
                            if (allowedActions.includes(widgetMgmt)) {
                                //
                                //  Valid Value in Configuration Panel
                                //  Retrieve Widgets now
                                //
                                let tmpWidgets = config.widgetId.trim();
                                if (tmpWidgets !== '') {
                                    //
                                    //  We have Widgets. Build an array out of them
                                    //
                                    let tmpWidgetsArray = tmpWidgets.split(',');
                                    //
                                    //  Build Final Array
                                    //
                                    for (let i=0; i < tmpWidgetsArray.length; i++) {
                                        if (allowedWidgets.includes(tmpWidgetsArray[i].trim())) {
                                            let tmp = {};
                                            tmp.widget = tmpWidgetsArray[i].trim();
                                            tmp.title = tmp.widget;
                                            tmp.action = widgetMgmt;
                                            theWidgets.push(tmp);
                                        } else {
                                            //
                                            //  Widget NOT Allowed
                                            //
                                            ICX.__logError(__moduleName, "Invalid Widget ID string (position " + i + ") : " + theWidgets[i].widget, null, null, msg, node);
                                            return;    
                                        }
                                    }
                                }
                            } else {
                                //
                                //  Unknown value from Configuration Panel
                                //
                                ICX.__logError(__moduleName, "Invalid  'Widget Mgmt'  string : " + widgetMgmt, null, null, msg, node);
                                return;
                            }
                        } else {
                            //
                            //  Nothing to do
                            //
                        }
                    } else {
                        //
                        //  Information comes from Message
                        //
                        if (msg.IC_communityWidgets && Array.isArray(msg.IC_communityWidgets)) {
                            theWidgets = msg.IC_communityWidgets;
                            //
                            //  Check if syntax is correct
                            //
                            for (let i=0; i < theWidgets.length; i++) {
                                if (theWidgets[i].action && (typeof theWidgets[i].action === 'string')) {
                                    //
                                    //  attribute "Action" is present
                                    //
                                    let theAction = theWidgets[i].action.trim();
                                    if (allowedActions.includes(theWidgets[i].action)) {
                                        theWidgets[i].widget = theWidgets[i].widget.trim();
                                        if (allowedWidgets.includes(theWidgets[i].widget)) {
                                            theWidgets[i].action = theAction;
                                            if (!theWidgets[i].title || (theWidgets[i].title.trim() === '')) {
                                                theWidgets[i].title = theWidgets[i].widget;
                                            }
                                        } else {
                                            //
                                            //  Widget NOT Allowed
                                            //
                                            ICX.__logError(__moduleName, "Invalid Widget ID string (position " + i + ") : " + theWidgets[i].widget, null, null, msg, node);
                                            return;    
                                        }
                                    } else {
                                        //
                                        //  Wrong Widget Operation String
                                        //
                                        ICX.__logError(__moduleName, "Invalid Widget Mgmt string (position " + i + ") : " + theAction, null, null, msg, node);
                                        return;    
                                    }
                                } else {
                                    ICX.__logError(__moduleName, "Missing Widget Mgmt string (position " + i + ")", null, null, msg, node);
                                    return;    
                                }
                            }
                        } else {
                            //
                            //  There is a problem
                            //
                            ICX.__logError(__moduleName, "Expecting Widget information from msg.IC_communityWidgets", null, null, msg, node);
                            return;    
                        }
                    }
                } else {
                    ICX.__logError(__moduleName, "Missing Widget Mgmt string from configuration panel", null, null, msg, node);
                    return;    
                }
                //
                //  At this point, theWidgets is an array where each item is fully specified (widget and action)
                //
                //
                //  Initialize UI
                //
                node.status({fill: "blue", shape: "dot", text: "Retrieving..."});
                //
                //  Start Processing....
                //
                tttt().then(async function() {
                    try {
                        //
                        //  Since we neeed to modify the Community, it is better to retrieve it
                        //  We retrieve it with ALL the information that are required 
                        //
                        __verboseOutput = true;
                        let thisCommunity = await getCommunityById(node.login, communityId);
                        __verboseOutput = __isDebug;
                        let tmp_remoteApplications = null;
                        let tmp_widgets = null;
                        let tmp_communityLogo = null;
                        let tmp_members = null;
                        if (thisCommunity) {
                            //
                            //  Deal with Community Logo
                            //
                            if (logoFrom !== 'none') {
                                node.status({fill: "blue", shape: "dot", text: "Updating logo..."});
                                let base64Image = '';
                                let mime = '';
                                if (logoBytes !== null) {
                                    // 
                                    //  We got the image from the Configuration Panel
                                    //  We need to retrieve the MIME-TYPE and separate the encodedImage part of the string
                                    //
                                    let parsedImage = logoBytes.match(encodedImageExp);
                                    if (parsedImage && parsedImage.length) {
                                        mime = parsedImage[1];
                                        base64Image = Buffer.from(parsedImage[3], 'base64');
                                    }
                                    //  
                                    //  Following, TWO DIFFERENT WAYS to succesfully create an output file
                                    //
                                    //let fs = require('fs');
                                    //fs.writeFile('zorro.jpeg', logoBytes, 'base64', function(err){node.error(err)});
                                    //fs.writeFile('zorro2.jpeg', ttt,  function(err){node.error(err)});
                                } else {
                                    //
                                    //  We get the image from the incoming msg element
                                    //
                                    if (logoFrom.match(urlExp)) {
                                        //
                                        //  The image comes from the Internet
                                        //
                                        logoBytes = await getBase64ImageFromUrl(logoFrom);
                                        let parsedImage = logoBytes.match(encodedImageExp);
                                        if (parsedImage && parsedImage.length) {
                                            mime = parsedImage[1];
                                            base64Image = Buffer.from(parsedImage[3], 'base64');
                                        }
                                    } else {
                                        //
                                        //  The image is a local file
                                        //
                                        logoBytes = await ICX.__readFile(logoFrom, 'base64');
                                        base64Image = Buffer.from(logoBytes, 'base64');
                                        mime = imageSize(logoFrom).type;
                                        if (mime === 'jpg') mime = 'jpeg';
                                        mime = 'image/' + mime;
                                    }
                                }
                                //
                                //  Now we are ready to change the logo
                                //
                                let aa = await updateCommunityImage(node.login, communityId, base64Image, mime);
                                tmp_communityLogo = await getCommunityImage(node.login, communityId);
                            } else {
                                //
                                //  Nothing to do with Logo
                                //
                            }
                            //
                            //  Deal with a Change to the Community Members
                            //
                            if (theMembers.length !== 0) {
                                //
                                //  Operations on Members need to be done
                                //
                                for (let i=0; i < theMembers.length; i++) {
                                    let userDetails = null;
                                    node.status({fill: "blue", shape: "dot", text: "User Details for " + theMembers[i].user});
                                    if (theMembers[i].user.match(mailExp)) {
                                        userDetails = await node.login.fromMailToId(theMembers[i].user, true);
                                    } else {
                                        userDetails = await node.login.fromIdToMail(theMembers[i].user, true);
                                    }
                                    //
                                    //  We have the information to Add or Remove the member
                                    //
                                    if (theMembers[i].action === 'AddMember') {
                                        //
                                        //  Add Member
                                        //
                                        let memberDoc = createAddMemberDocument(userDetails.mail, userDetails.userid, userDetails.name, theMembers[i].role, thisCommunity.orgId);
                                        ICX.__log(__moduleName, __isDebug, 'MemberDoc to be added: \n' + memberDoc);
                                        try {
                                            node.status({fill: "blue", shape: "dot", text: "Adding user " + theMembers[i].user + " as " + theMembers[i].role});
                                            await addCommunityMember(node.login, communityId, memberDoc);
                                        } catch(err) {
                                            if (err.response.statusCode === 409) {
                                                //
                                                //  user in that role already exists
                                                //  Ignore
                                                //
                                                node.warn('User ' + userDetails.name + ' is already ' + theMembers[i].role + ' of the community');
                                            } else {
                                                //
                                                //  Serious Issue
                                                //
                                                throw err;
                                            }
                                        }
                                    } else {
                                        //
                                        //  Remove Members
                                        //
                                        try {
                                            node.status({fill: "blue", shape: "dot", text: "Removing user " + theMembers[i].user});
                                            await deleteCommunityMember(node.login, communityId, userDetails.userid)
                                        } catch(err) {
                                            if (err.response.statusCode === 404) {
                                                //
                                                //  user is NOT member of the Community
                                                //  Ignore
                                                //
                                                node.warn('User ' + userDetails.name + ' cannot be removed because not a member');
                                            } else {
                                                //
                                                //  Serious Issue
                                                //
                                                throw err;
                                            }
                                         }
                                    }
                                }
                                tmp_members = await getCommunityMembers(node.login, communityId);
                            } else {
                                //
                                //  Nothing to do with Members
                                //
                            }
                            //
                            //  Deal with a Change to the Community Widgets
                            //
                            if (theWidgets.length !== 0) {
                                //
                                //  Operations on Widgets need to be done
                                //
                                for (let i=0; i < theWidgets.length; i++) {
                                    if (theWidgets[i].action === 'AddWidget') {
                                        //
                                        //  Add Widget
                                        //
                                        let widgetDoc = createAddWidgetDocument(theWidgets[i].widget, theWidgets[i].widget, theWidgets[i].location);
                                        ICX.__log(__moduleName, __isDebug, 'WidgetDoc to be added: \n' + widgetDoc);
                                        try {
                                            node.status({fill: "blue", shape: "dot", text: "Adding Widget " + theWidgets[i].widget});
                                            await addCommunityWidget(node.login, communityId, widgetDoc);
                                        } catch(err) {
                                            if (err.response.statusCode === 409) {
                                                //
                                                //  user in that role already exists
                                                //  Ignore
                                                //
                                                node.warn('Widget ' + theWidgets[i].widget + ' is already ..... of the community');
                                            } else {
                                                //
                                                //  Serious Issue
                                                //
                                                throw err;
                                            }
                                        }
                                    } else {
                                        //
                                        //  Remove Widget
                                        //
                                        try {
                                            node.status({fill: "blue", shape: "dot", text: "Removing widget " + theWidgets[i].widget});
                                            await deleteCommunityWidget(node.login, communityId, theWidgets[i].widget)
                                        } catch(err) {
                                            if (err.response.statusCode === 404) {
                                                //
                                                //  user is NOT member of the Community
                                                //  Ignore
                                                //
                                                node.warn('Widget ' + theWidgets[i].widget + ' cannot be removed because not...');
                                            } else {
                                                //
                                                //  Serious Issue
                                                //
                                                throw err;
                                            }
                                         }
                                    }
                                }
                                tmp_widgets = await getCommunityWidgets(node.login, communityId);
                            } else {
                                //
                                //  Nothing to do with Members
                                //
                            }
                            if ((communityTitle !== '') || (communityDesc !== '') || (communityTags !== '')) {
                                //
                                //  We have to modify something in the Community. So we need the Original Structure (thisCommunity.originalentry)
                                //
                                let original = thisCommunity.originalentry;
                                //
                                //  Deal with a Change to the Community Title
                                //
                                if (communityTitle !== '') original.title[0]['_'] = communityTitle;
                                //
                                //  Deal with a Change to the Community Description
                                //  Note, we support the HTML Description here
                                //
                                if (communityDesc !== '') {
                                    original.content[0]['_'] = communityDesc;
                                    delete original.summary;
                                }
                                //
                                //  Deal with a Change to the Community Tags
                                //
                                if (communityTags !== '') {
                                    let theTags = communityTags.split(',');
                                    if (communityTagsReplace) {
                                        //
                                        //  We need, first, to remove the existing tags
                                        //
                                        let newCategory = [];
                                        for (let i=0; i< original.category.length; i++) {
                                            if (original.category[i]['$'].scheme) {
                                                newCategory.push(original.category[i]);
                                                break;
                                            }
                                        }
                                        original.category = newCategory;
                                    }
                                    for (let i=0; i < theTags.length; i++) {
                                        let tmp = theTags[i].trim();
                                        let obj1 = {};
                                        obj1['$'] = {};
                                        obj1['$'].term = tmp;
                                        original.category.push(obj1);
                                    }
                                }
                                //
                                //  Re-create the ATOM
                                //
                                let builder = new xml2js.Builder({rootName: "entry"});
                                let entry = builder.buildObject(original);
                                //
                                //  And, now, we can update the Community
                                //
                                thisCommunity = await updateCommunity(node.login, entry, communityId);
                            }
                            //
                            //  Prepare the output
                            //
                            if (tmp_members) thisCommunity.members = tmp_members;
                            if (tmp_communityLogo) thisCommunity.logo = tmp_communityLogo;
                            msg.payload = thisCommunity;
                            node.status({});
                            node.send(msg);     
                        } else {
                            //
                            //  Houston, we have a problem. The Community to be updated DOES NOT exist
                            //
                            ICX.__logError(__moduleName, "Community " + communityId + " does NOT EXIST !", null, null, msg, node);
                            return;    
                        } 
                    } catch (error) {
                        ICX.__logError(__moduleName, "ERROR INSIDE tttt", null, error, msg, node);
                        return;    
                    }
                })
                .catch(error => {
                    ICX.__logError(__moduleName, "ERROR getting tttt", null, error, msg, node);
                    return;    
                });
/*
                //
                //  Get Widget Mgmt Information
                //
                var widgetMgmt = ICX.__getMandatoryInputStringFromSelect(__moduleName, config.target2, msg.IC_communityWidgets, 'Widget Mgmt', ['none', 'AddWidget', 'RemoveWidget'], msg, node);
                if (!widgetMgmt) return;

                //
                //  Now deal with Members
                //
                if (config.target !== 'none') {
                    if (config.target !== 'fromMsg') {
                        //
                        //  We need to parse the inputs from the configuration panel
                        //
                        let theIds = config.userId.trim();
                        if (theIds !== '') {
                            let theIdsArray = theIds.split(',');
                            tttt().then(async function() {
                                try {
                                    for (let index=0; index < theIdsArray.length; index++) {
                                        theIdsArray[index] = theIdsArray[index].trim();
                                        if (mailExp.test(theIdsArray[index])) {
                                            //
                                            //  Mail address. Need to be converted
                                            //
                                            console.log('--> ' + index);
                                            let toto = await node.login.fromMailToId(theIdsArray[index], node);
                                            //console.log(JSON.stringify(toto, ' ', 2));
                                            if (toto) theIdsArray[index] = toto.userid;
                                            console.log('----> ' + index + ': ' + theIdsArray[index])
                                        } else {
                                            //
                                            //  It is already an ID
                                            //
                                        }
                                    }
                                    console.log(JSON.stringify(theIdsArray, ' ', 2));
                                } catch(theError) {
                                    node.status({fill: "red", shape: "dot", text: theError.message});
                                    node.error(theError, msg);
                                }
                            });
                        }
                    }
                }
*/
/*
                myURL += "/community/members?communityUuid=" + communityId;
                getCommunityMembers(msg, myURL);
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
                */
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
                var loginNode = RED.nodes.getNode(config.server);
                //
                //  Server is a GLOBAL variable
                //
                var server = loginNode.getServer;
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


    async function getBase64ImageFromUrl(imageUrl) {
        const rp = require("request-promise-native");
        var _include_headers = function(body, response, resolveWithFullResponse) {
            return {'headers': response.headers, 'data': body};
          };
          
        var options = {
            method: 'GET',
            uri: imageUrl,
            transform: _include_headers,
            encoding: null    // https://stackoverflow.com/questions/31289826/download-an-image-using-node-request-and-fs-promisified-with-no-pipe-in-node-j
        };
        try {
            const res = await rp(options);

            var buf = Buffer.from(res.data);
            var base64 = 'data:' + res.headers['content-type'] + ';base64,' + buf.toString('base64')
            //console.log(JSON.stringify(res.headers, ' ', 2));
            //console.log(base64);
            return base64;
        } catch (error) {
            return Promise.reject(error);
        }
    }
    //
    //  Http Endpoint to get the current IMG URL of the logo
    //
    RED.httpAdmin.get('/image', (req, res) => {
        ICX.__logJson(__moduleName, __isDebug, 'Get Image Executing with these parameters : ', req.query);
        if (req.query && req.query.link) {
            let body = {};
            getBase64ImageFromUrl(req.query.link)
                .then(result => {
                    ICX.__log(__moduleName, __isDebug, 'Get Image was Successfull');
                    res.status(200);
                    res.send(result);
                    res.end()
                })
                .catch(err => {
                    ICX.__logJson(__moduleName, true, 'Get Image Failed with this error :', err);
                    res.status(400).json(err);
                });
        } else {
            //
            //  Nothing to get
            //
            res.status(400);
            res.send('No image to be retrieved has been specified');
            res.end();
        }
    });
};
