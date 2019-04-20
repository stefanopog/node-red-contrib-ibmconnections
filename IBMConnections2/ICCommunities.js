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
    const __moduleName = 'IC_Communities';
    const __mailExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    const __urlExp = /^(https?|chrome|localhost):\/\/[^\s$.?#].[^\s]*$/;
    const __winFilePathExp = /^([a-zA-Z]\:|\\\\[^\/\\:*?"<>|]+\\[^\/\\:*?"<>|]+)(\\[^\/\\:*?"<>|]+)+(\.[^\/\\:*?"<>|]+)$/;
    const __unixFilePathExp = /^(\/)?([^\/\0]+(\/)?)+$/;
    const __encodedImageExp = /^data:(image\/(gif|png|jpeg|jpg));base64,(.*)$/;
    const __allowedMemberRoles = ['owner', 'member', 'business-owner'];
    const __allowedMemberActions = ['AddMember', 'RemoveMember'];
    const __allowedWidgetActions = ['AddWidget', 'RemoveWidget'];
    const __allowedWidgets = ["ImportantBookmarks",
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

    var   __verboseOutput = __isDebug;

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
        if (entry['snx:listWhenRestricted']) community.listWhenRestricted = entry['snx:listWhenRestricted'][0];
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
        community.ref = '';
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

    function createAuthorDocument(theName, theId, theMail, isAuthor) {
        var theDocument = 
        `${isAuthor ? "<author>" : "<contributor>"}
        <name>${theName}</name>        
        <email>${theMail}m</email>        
        <snx:userid>${theId}</snx:userid>        
        <snx:userState>active</snx:userState>        
        ${isAuthor ? "</author>" : "</contributor>"}`;
        return theDocument;
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
        <category term="widget" scheme="http://www.ibm.com/xmlns/prod/sn/type" />
        <snx:widgetDefId>${widgetId}</snx:widgetDefId>       
        <snx:hidden>false</snx:hidden>
        <title type="text">${title}</title>
        ${selectLocation ? "<snx:location>" + location + "</snx:location>" : ""}
        </entry>`;
      return theDocument;
    }
    function createAddCommunityDocument(commTitle, commDesc, commType, commExternal, commVisibility, theAuthor, theContributor) {
        var isExternal = false;
        var isListingVisible = false;
        if (commType === 'private') {
            if (commExternal === 'External') isExternal = true;
            if (commVisibility === 'Visible') isListingVisible = true;
        }
        var theDocument =
        `<entry xmlns="http://www.w3.org/2005/Atom" xmlns:app="http://www.w3.org/2007/app" xmlns:snx="http://www.ibm.com/xmlns/prod/sn">
        <title type="text">${commTitle}</title>
        <content type="html">${commDesc}</content>
        <category term="community" scheme="http://www.ibm.com/xmlns/prod/sn/type"></category>
        ${theAuthor}
        ${theContributor}
        <snx:communityType>${commType}</snx:communityType>
        <snx:listWhenRestricted>${isListingVisible ? "true" : "false"}</snx:listWhenRestricted>
        <snx:isExternal>${isExternal ? "true" : "false"}</snx:isExternal>
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
    async function createCommunity(loginNode, body, motherCommunityId) {
        var theURL = '';
        if (motherCommunityId === '') {
            theURL = loginNode.getServer + "/communities/service/atom/communities/my";
        } else {
            //
            //  SUBCommunity
            //
            theURL = loginNode.getServer + '/communities/service/atom/community/subcommunities?communityUuid=' + motherCommunityId;
        }
        var _include_headers = function(body, response, resolveWithFullResponse) {
            return {'headers': response.headers, 'data': body};
        };
        var __msgText = 'error getting information for createCommunity';
        var __msgStatus = 'No createCommunity';
        try {
            ICX.__log(__moduleName, true, 'createCommunity: executing on ' + theURL);
            let response = await loginNode.rpn(
                {
                    url: theURL,
                    method: "POST",
                    transform: _include_headers,
                    body: body,
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "createCommunity OK", response);
            let locationArray = response.headers.location.split('=');
            return locationArray[1];
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "createCommunity : " + __msgText, error);
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
    async function deleteCommunityWidget(loginNode, communityId, instanceId) {
        var theURL = loginNode.getServer + "/communities/service/atom/community/widgets?communityUuid=" + communityId + '&widgetInstanceId=' + instanceId;
        var __msgText = 'error getting information for deleteCommunityWidget';
        var __msgStatus = 'No deleteCommunityWidget';
        try {
            ICX.__log(__moduleName, true, 'deleteCommunityWidget: executing on ' + theURL);
            let response = await loginNode.rpn(
                {
                    url: theURL,
                    method: "DELETE",
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "deleteCommunityWidget OK", response);
            return response;
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "deleteCommunityWidget : " + __msgText, error);
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
        const __urlQualifier = '?sortBy=modified&sortOrder=desc&ps=100';
        //
        //  Main Processing
        //
        this.on(
            'input',
            function (msg) {
                //
                //  Server is a GLOBAL variable
                //
                var myURL  = node.login.getServer + "/communities/service/atom";
                //var myURL  = node.login.getServer + "/communities/service/atom/communities/my";
                if (node.login.authType === "oauth") myURL += '/oauth';
                //
                //  Get the Inputs
                //
                var theTag = ICX.__getOptionalInputString(__moduleName, config.communityTag, msg.IC_communityTag, 'Tag', node);
                if (theTag !== '') theTag = "&tag=" + theTag;
                var theSearch = ICX.__getOptionalInputString(__moduleName, config.searchString, msg.IC_searchString, 'Search', node);
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
                        myURL += '/communities/my';
                        myURL += __urlQualifier;
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
                        myURL += '/communities/all';
                        myURL += __urlQualifier;
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
                            let theMail = ICX.__getMandatoryInputString(__moduleName, config.userId , msg.IC_userId, '', 'UserId', msg, node);
                            myURL += '/communities/all';
                            myURL += __urlQualifier;
                            myURL += theTag;
                            myURL += theSearch;
                            if (__mailExp.test(theMail)) {
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
        //  Global to access the custom HTTP Request object available from the ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		var node = this;

        async function mainProcessing() {
            return;
        }

        this.on(
            'input',
            function (msg) {
                var communityId = '';
                var motherCommunityId = '';
                var communityType = '';
                var communityVisibility = '';
                var communityExternal = '';
                var communityTitle = '';
                var communityDesc = '';
                var communityTags = '';
                var communityTagsReplace = false;
                //
                //  Check Operation to be performed
                //
                var operationType = ICX.__getMandatoryInputStringFromSelect(__moduleName, config.newOrUpdate, msg.IC_newOrUpdate, 'Community Operation', ['Create', 'Update', 'SubCommunity'], msg, node);
                if (!operationType) return;
                if (operationType === 'Update') {
                    //
                    //  Check if CommunityId is specified. It is MANDATORY in this case
                    //
                    communityId = ICX.__getMandatoryInputString(__moduleName, config.communityId , msg.IC_communityId, '', 'CommunityId', msg, node);
                    if (!communityId) return;
                    //
                    //  Get Community Title if present (optional)
                    //
                    communityTitle = ICX.__getOptionalInputString(__moduleName, config.communityTitle, msg.IC_communityTitle, 'Community Title', node);
                    //
                    //  Get Community Desc if Present (optional)
                    //
                    communityDesc = ICX.__getOptionalInputString(__moduleName, config.communityDesc, msg.IC_communityDesc, 'Community Desc', node);
                } else {
                    if (operationType === 'SubCommunity') {
                        //
                        //  Check if CommunityId is specified. It is MANDATORY in this case
                        //
                        motherCommunityId = ICX.__getMandatoryInputString(__moduleName, config.motherCommunityId , msg.IC_motherCommunityId, '', 'Mother CommunityId', msg, node);
                        if (!motherCommunityId) return;
                    }
                    //
                    //  Get Community Title (MANDATORY in this case)
                    //
                    communityTitle = ICX.__getMandatoryInputString(__moduleName, config.communityTitle, msg.IC_communityTitle, '', 'Community Title', msg, node);
                    if (!communityTitle) return;
                    //
                    //  Get Community Desc (MANDATORY in this case)
                    //
                    communityDesc = ICX.__getMandatoryInputString(__moduleName, config.communityDesc, msg.IC_communityDesc, '', 'Community Desc', msg, node);
                    if (!communityDesc) return;
                    //
                    //  Get Type of Community to be created
                    //
                    communityType = ICX.__getMandatoryInputStringFromSelect(__moduleName, config.communityType, msg.IC_communityType, 'Community Type', ['private', 'publicInviteOnly', 'public'], msg, node);
                    if (!communityType) return;
                    if (communityType === 'private') {
                        //
                        //  Open to Outside ?
                        //
                        communityExternal = ICX.__getMandatoryInputStringFromSelect(__moduleName, config.communityExternal, msg.IC_communityExternal, 'Community External', ['External', 'Internal'], msg, node);
                        if (!communityExternal) return;
                        //
                        //  Visible for Listing ?
                        //
                        communityVisibility = ICX.__getMandatoryInputStringFromSelect(__moduleName, config.communityVisibility, msg.IC_communityVisibility, 'Community Visibility', ['Visible', 'Invisible'], msg, node);
                        if (!communityVisibility) return;
                    }
                }
                //
                //  Get Community Tags (if present)
                //
                communityTags = ICX.__getOptionalInputString(__moduleName, config.communityTags, msg.IC_communityTags, 'Community Tags', node);
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
                            if (logoFrom.match(__urlExp) || logoFrom.match(__unixFilePathExp) || logoFrom.match(__winFilePathExp)) {
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
                    if (memberMgmt !== 'fromMsg') {
                        //
                        //  Configuration available from Configuration Panel
                        //
                        if (memberMgmt !== 'none') {
                            if (__allowedMemberActions.includes(memberMgmt)) {
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
                                    let theRole = '';
                                    if (memberMgmt === 'AddMember') {
                                        ltheRole = config.userRole.trim();
                                    } else {
                                        theRole = 'none';
                                    }
                                    if (__allowedMemberRoles.includes(theRole)) {
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
                                    if (__allowedMemberActions.includes(theMembers[i].action)) {
                                        theMembers[i].action = theAction;
                                        theMembers[i].user = theMembers[i].user.trim();
                                        if (theAction === 'AddMember') {
                                            if (theMembers[i].role && (typeof theMembers[i].role === 'string')) {
                                                //
                                                //  attribute "role" is present
                                                //
                                                let theRole = theMembers[i].role.trim();
                                                if (__allowedMemberRoles.includes(theRole)) {
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
                    if (widgetMgmt !== 'fromMsg') {
                        //
                        //  Configuration available from Configuration Panel
                        //
                        if (widgetMgmt !== 'none') {
                            if (__allowedWidgetActions.includes(widgetMgmt)) {
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
                                        if (__allowedWidgets.includes(tmpWidgetsArray[i].trim())) {
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
                                    if (__allowedWidgetActions.includes(theWidgets[i].action)) {
                                        theWidgets[i].widget = theWidgets[i].widget.trim();
                                        if (__allowedWidgets.includes(theWidgets[i].widget)) {
                                            theWidgets[i].action = theAction;
                                            if (!theWidgets[i].title || (theWidgets[i].title.trim() === '')) {
                                                theWidgets[i].title = theWidgets[i].widget;
                                            }
                                            if (theWidgets[i].id && (theWidgets[i].id.trim() !== '')) {
                                                theWidgets[i].id = theWidgets[i].id.trim();
                                            } else {
                                                if (theWidgets[i].id) delete theWidgets[i].id;
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
                //  At this point, theWidgets is an array where each item is fully specified (widget, title, action and optionally its instanceId)
                //
                //
                //  Initialize UI
                //
                node.status({fill: "blue", shape: "dot", text: "Retrieving..."});
                //
                //  Start Processing....
                //
                mainProcessing().then(async function() {
                    try {
                        //
                        //  Since we neeed to modify the Community, it is better to retrieve it
                        //  We retrieve it with ALL the information that are required 
                        //
                        if (operationType !== 'Update') {
                            //
                            //  Retrieve myself
                            //
                            let thisIsMe = await node.login.getUserInfosFromId(node.login.userId, false, false);
                            //
                            //  Prepare ATOM Entry to create the Community
                            //
                            let theAuthorDoc = createAuthorDocument(thisIsMe.name, thisIsMe.id, thisIsMe.mail, true);
                            let theContributorDoc = createAuthorDocument(thisIsMe.name, thisIsMe.id, thisIsMe.mail, false);
                            let newCommunityDoc = createAddCommunityDocument(communityTitle, '', communityType, communityExternal, communityVisibility, theAuthorDoc, theContributorDoc);
                            //
                            //  Create New Community or SubCommunity
                            //  Note:
                            //      Supporting an HTML Description imposes escaping the HTML string.
                            //      I preferred to defer the Description to an UPDATE operation that will do later
                            //      So, during creation we ONLY set the TITLE
                            //
                            //
                            try {
                                if (operationType === 'Create') {
                                    communityId = await createCommunity(node.login, newCommunityDoc, '');
                                } else {
                                    communityId = await createCommunity(node.login, newCommunityDoc, motherCommunityId);
                                }
                                ICX.__log(__moduleName, true, 'Community ' + communityId + '  succesfully created !!!');
                                //
                                //  We say that the Title has already been set
                                //
                                communityTitle = '';
                            } catch (error) {
                                throw error;
                            }
                            //
                            //  For a Create or SubCommunity operation, we did not get the communityId as an input.
                            //  But now we have it: it is the result of the Create operation !!
                            //
                        }
                        //
                        //  Get the Details of the Community to be updated or of the newly created Community
                        //  This will be the basis or the output.
                        //  We FORCE the __verboseOutput to TRUE in order to get the "entry" and "originalentry" information out of the 
                        //  "getCommunityById" call. We need the "originalentry" in order to reuse it as a basis for the ATOM entry to be sent 
                        //  when updating the Community
                        //
                        __verboseOutput = true;
                        let thisCommunity = await getCommunityById(node.login, communityId);
                        __verboseOutput = __isDebug;
                        if (thisCommunity) {
                            let tmp_remoteApplications = null;
                            let tmp_widgets = null;
                            let tmp_communityLogo = null;
                            let tmp_members = null;
                            //
                            //  Deal with the Community Metadata
                            //
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
                                node.status({fill: "blue", shape: "dot", text: "Updating community Details..."});
                                thisCommunity = await updateCommunity(node.login, entry, communityId);
                                ICX.__log(__moduleName, true, 'Community Details succesfully updated');
                            }
                            //
                            //  Deal with Community Logo
                            //
                            if (logoFrom !== 'none') {
                                let base64Image = '';
                                let mime = '';
                                if (logoBytes !== null) {
                                    // 
                                    //  We got the image from the Configuration Panel
                                    //  We need to retrieve the MIME-TYPE and separate the encodedImage part of the string
                                    //
                                    let parsedImage = logoBytes.match(__encodedImageExp);
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
                                    if (logoFrom.match(__urlExp)) {
                                        //
                                        //  The image comes from the Internet
                                        //
                                        logoBytes = await ICX.__getBase64ImageFromUrl(logoFrom);
                                        let parsedImage = logoBytes.match(__encodedImageExp);
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
                                node.status({fill: "blue", shape: "dot", text: "Updating logo..."});
                                let aa = await updateCommunityImage(node.login, communityId, base64Image, mime);
                                ICX.__log(__moduleName, true, 'New logo image successfully updated');
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
                                    if (theMembers[i].user.match(__mailExp)) {
                                        userDetails = await node.login.getUserInfosFromMail(theMembers[i].user, false, false);
                                    } else {
                                        userDetails = await node.login.getUserInfosFromId(theMembers[i].user, false, false);
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
                                            ICX.__log(__moduleName, true, 'User ' + userDetails.name  + ' Succesfully added as ' + theMembers[i].role);
                                        } catch(err) {
                                            if (err.response.statusCode === 409) {
                                                //
                                                //  user in that role already exists
                                                //  Ignore
                                                //
                                                node.warn('User ' + userDetails.name + ' is already ' + theMembers[i].role + ' of the community');
                                                ICX.__log(__moduleName, true, 'User ' + userDetails.name  + ' is already ' + theMembers[i].role + ' of the community');
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
                                            ICX.__log(__moduleName, true, 'User ' + userDetails.name  + ' Succesfully removed from Community');
                                        } catch(err) {
                                            if (err.response.statusCode === 404) {
                                                //
                                                //  user is NOT member of the Community
                                                //  Ignore
                                                //
                                                node.warn('User ' + userDetails.name + ' cannot be removed because not a member');
                                                ICX.__log(__moduleName, true, 'User ' + userDetails.name + ' cannot be removed because not a member');
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
                                let currentWidgets = null;
                                let currentWidgets_table = [];
                                for (let i=0; i < theWidgets.length; i++) {
                                    if (theWidgets[i].action === 'AddWidget') {
                                        //
                                        //  Add Widget
                                        //
                                        let widgetDoc = createAddWidgetDocument(theWidgets[i].widget, theWidgets[i].title, theWidgets[i].location);
                                        ICX.__log(__moduleName, __isDebug, 'WidgetDoc to be added: \n' + widgetDoc);
                                        try {
                                            node.status({fill: "blue", shape: "dot", text: "Adding Widget " + theWidgets[i].widget});
                                            await addCommunityWidget(node.login, communityId, widgetDoc);
                                            ICX.__log(__moduleName, true, 'Widget ' + theWidgets[i].widget + ' Succesfully added');
                                        } catch(err) {
                                            if (err.response.statusCode === 403) {
                                                //
                                                //  user in that role already exists
                                                //  Ignore
                                                //
                                                node.warn('Widget ' + theWidgets[i].widget + ' is already assigned to this  community');
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
                                        //  To remove a Widget, we need to get the InstanceId of the widget to be removed
                                        //  Thus we need to retrieve the current list of widgets
                                        //
                                        if (!currentWidgets) {
                                            currentWidgets = await getCommunityWidgets(node.login, communityId);
                                            //
                                            //  Create a simple table of widgets indexed by WidgetDef
                                            //
                                            for (let i=0; i < currentWidgets.length; i++) {
                                                if (currentWidgets_table[currentWidgets[i].widgetDefId]) {
                                                    //
                                                    //  an instance of this already exists
                                                    //
                                                    currentWidgets_table[currentWidgets[i].widgetDefId] += ',' + currentWidgets[i].widgetInstanceId;
                                                } else {
                                                    currentWidgets_table[currentWidgets[i].widgetDefId] = currentWidgets[i].widgetInstanceId;
                                                }
                                            }
                                        }
                                        try {
                                            if (currentWidgets_table[theWidgets[i].widget]) {
                                                //
                                                //  At least an instance of this Widget exists
                                                //
                                                let tmp = currentWidgets_table[theWidgets[i].widget].split(',');
                                                if (tmp.length === 1) {
                                                    //
                                                    //  Only one instance. We can safely remove it
                                                    //
                                                    node.status({fill: "blue", shape: "dot", text: "Removing widget " + theWidgets[i].widget});
                                                    await deleteCommunityWidget(node.login, communityId, currentWidgets_table[theWidgets[i].widget]);
                                                    ICX.__log(__moduleName, true, 'The instance ' + currentWidgets_table[theWidgets[i].widget] + ' for widget ' + theWidgets[i].widget + ' has been removed');
                                                    delete currentWidgets_table[theWidgets[i].widget];
                                                } else {
                                                    //
                                                    //  Multiple instances of the widget
                                                    //
                                                    if (theWidgets[i].id) {
                                                        //
                                                        //  We know which instance to remove
                                                        //
                                                        let pos = tmp.indexOf(theWidgets[i].id);
                                                        if (pos >= 0) {
                                                            //
                                                            //  Instance exists
                                                            //
                                                            node.status({fill: "blue", shape: "dot", text: "Removing one instance of widget " + theWidgets[i].widget});
                                                            await deleteCommunityWidget(node.login, communityId, tmp[pos]);
                                                            ICX.__log(__moduleName, true, 'The instance ' + tmp[pos] + ' for widget ' + theWidgets[i].widget + ' has been removed');
                                                            tmp.splice(pos, 1);
                                                            currentWidgets_table[theWidgets[i].widget] = tmp.join(',');
                                                        } else {
                                                            //
                                                            //  That specific instance does not exist
                                                            //
                                                            node.status({fill: 'yellow', shape: 'dot', text: 'Widget ' + theWidgets[i].id + ' does not exist'});
                                                            node.warn('The instance ' + theWidgets[i].id + ' for widget ' + theWidgets[i].widget + ' cannot be removed because it does not exist');
                                                            ICX.__log(__moduleName, true, 'The instance ' + theWidgets[i].id + ' for widget ' + theWidgets[i].widget + ' cannot be removed because it does not exist');
                                                        }
                                                    } else {
                                                        //
                                                        //  No ID specified. We are removing ALL INSTANCES
                                                        //
                                                        node.warn('Removing ALL INSTANCES for widget ' + theWidgets[i].widget + ' since ID was not specified');
                                                        ICX.__log(__moduleName, true, 'Removing ALL INSTANCES for widget ' + theWidgets[i].widget + ' since ID was not specified');
                                                        for (let j=0; j < tmp.length; j++) {
                                                            node.status({fill: "blue", shape: "dot", text: "Removing " + j + "^ instance of widget " + theWidgets[i].widget});
                                                            await deleteCommunityWidget(node.login, communityId, tmp[j]);
                                                            ICX.__log(__moduleName, true, 'The instance ' + tmp[j] + ' for widget ' + theWidgets[i].widget + ' has been removed');
                                                        }
                                                        delete currentWidgets_table[theWidgets[i].widget];
                                                    }
                                                }
                                            } else {
                                                //
                                                //  That Widget DOES NOT exist, so it cannot be removed
                                                //
                                                node.status({fill: 'yellow', shape: 'dot', text: 'Widget ' + theWidgets[i].widget + ' does not exist'});
                                                node.warn('No instance for widget ' + theWidgets[i].widget + ' exist, so it cannot be removed');
                                                ICX.__log(__moduleName, true, 'No instance for widget ' + theWidgets[i].widget + ' exist, so it cannot be removed');
                                            }
                                        } catch(err) {
                                            //
                                            //  Serious Issue
                                            //
                                            throw err;
                                        }
                                    }
                                }
                                tmp_widgets = await getCommunityWidgets(node.login, communityId);
                                tmp_remoteApplications = await getCommunityApplications(node.login, communityId);
                            } else {
                                //
                                //  Nothing to do with Members
                                //
                            }
                            //
                            //  Prepare the output
                            //
                            if (tmp_members) thisCommunity.members = tmp_members;
                            if (tmp_widgets) thisCommunity.widgets = tmp_widgets;
                            if (tmp_remoteApplications) thisCommunity.remoteApplications = tmp_remoteApplications;
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
                        ICX.__logError(__moduleName, "ERROR INSIDE mainProcessing", null, error, msg, node);
                        return;    
                    }
                })
                .catch(error => {
                    ICX.__logError(__moduleName, "ERROR getting mainProcessing", null, error, msg, node);
                    return;    
                });
            }
        );
    }

    RED.nodes.registerType("ICCommunitiesUpdate", ICCommunitiesUpdate);

    //
    //  Http Endpoint to get the current IMG URL of the logo
    //
    RED.httpAdmin.get('/image', (req, res) => {
        ICX.__logJson(__moduleName, __isDebug, 'Get Image Executing with these parameters : ', req.query);
        if (req.query && req.query.link) {
            let body = {};
            ICX.__getBase64ImageFromUrl(req.query.link)
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
