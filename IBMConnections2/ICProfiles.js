/*
Copyright IBM All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

module.exports = function(RED) {
    const ICX = require('./common.js');
    const __isDebug = ICX.__getDebugFlag();
    const __moduleName = 'IC_Profiles';
  
    console.log("*****************************************");
    console.log("* Debug mode is " + (__isDebug ? "enabled" : "disabled") + ' for module ' + __moduleName);
    console.log("*****************************************");

    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;

    const __ADD = 'add';
    const __REMOVE = 'remove';
    const __QUESTION_MARKS = '???';
    const mailExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

    function createModifyAttributeDocument(attributeName, attributeValue) {
        var theDocument = 
        `<entry><key>${attributeName}</key><value><type>text</type><data>${attributeValue}</data></value></entry>`;
        return theDocument;
    }
    function createUpdateAttributesDocument(attributeDocuments) {
        var theDocument =
        `<?xml version="1.0" encoding="UTF-8"?>
        <entry xmlns:app="http://www.w3.org/2007/app" xmlns:thr="http://purl.org/syndication/thread/1.0" xmlns:fh="http://purl.org/syndication/history/1.0" xmlns:snx="http://www.ibm.com/xmlns/prod/sn" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/" xmlns="http://www.w3.org/2005/Atom">
            <category term="profile" scheme="http://www.ibm.com/xmlns/prod/sn/type"></category>
            <content type="application/xml">
                <person xmlns="http://ns.opensocial.org/2008/opensocial">
                    <com.ibm.snx_profiles.attrib>
                        ${Array(attributeDocuments.length).fill().map((item, i) => attributeDocuments[i]).join('')}
                    </com.ibm.snx_profiles.attrib>
                </person>
            </content>
        </entry>`;
        return theDocument;
    }
    function createTagsUpdateDocument(theTags) {
        var theDocument = '<categories xmlns="http://www.w3.org/2007/app" xmlns:atom="http://www.w3.org/2005/Atom">';
        for (let i=0; i < theTags.length; i++) {
            theDocument += '<atom:category xmlns:snx="http://www.ibm.com/xmlns/prod/sn" term="' + theTags[i] + '" snx:frequency="1" snx:intensityBin="1" snx:visibilityBin="1" snx:type="general" />';
        }
        theDocument += '</categories>';
        return theDocument;
    }
    function buildTagsByUser(sourceArray, targetArray, operation, resetTags) {
        function __findUser(theUser, theArray) {
            var theIndex = -1;
            for (let i=0; i < theArray.length; i++) {
                if (theArray[i].user === theUser) {
                    theIndex = i;
                    break;
                }
            }
            return theIndex;
        }
        //
        //  walking through users...
        //
        for (let i=0; i < sourceArray.length; i++) {
            //
            //  Walking through tags
            //
            let theUser = sourceArray[i].user.trim().toLowerCase();
            for (let j=0; j < sourceArray[i].tags.length; j++) {
                let tagName = sourceArray[i].tags[j];
                let tagRecord = {};
                tagRecord.tagName = tagName;
                tagRecord.operation = operation;
                let tmpIndex = __findUser(theUser, targetArray);
                if (tmpIndex >= 0) {
                    //
                    //  Already exists
                    //
                    targetArray[tmpIndex].tags.push(tagRecord);
                } else {
                    //
                    //  Does not exist yet
                    //
                    let userRecord = {};
                    userRecord.user = theUser;
                    userRecord.resetTags = resetTags;
                    userRecord.key = __QUESTION_MARKS;
                    userRecord.name = __QUESTION_MARKS;
                    userRecord.existingTags = [];
                    userRecord.tags = [];
                    userRecord.tags.push(tagRecord);
                    targetArray.push(userRecord);
                }
            }
        }
        return targetArray;
    }
    function getTagsByUser(tagsByUser, tagCloud) {
        var outArray = [];
        var isMail = mailExp.test(tagsByUser.user);
        var theKeys = Object.keys(tagCloud);
        for (let i=0; i < theKeys.length; i++) {
            for (let j=0; j < tagCloud[theKeys[i]].contributors.length; j++) {
                if (isMail) {
                    if (tagCloud[theKeys[i]].contributors[j].email.toLowerCase() === tagsByUser.user.toLowerCase()) {
                        //
                        //  Tag found
                        //
                        outArray.push(theKeys[i]);
                        //
                        //  Complete the record
                        //
                        tagsByUser.key = tagCloud[theKeys[i]].contributors[j].key;
                        tagsByUser.name = tagCloud[theKeys[i]].contributors[j].name;
                        break;
                    }
                } else {
                    if (tagCloud[theKeys[i]].contributors[j].userId.toLowerCase() === tagsByUser.user.toLowerCase()) {
                        //
                        //  Tag found
                        //
                        outArray.push(theKeys[i]);
                        //
                        //  Complete the record
                        //
                        tagsByUser.key = tagCloud[theKeys[i]].contributors[j].key;
                        tagsByUser.name = tagCloud[theKeys[i]].contributors[j].name;
                        break;
                    }
                }
            }
        }
        return outArray;
    }
    async function mainProcessing() {
        return;
    }
    async function listEditableFields(loginNode) {
        var theURL = loginNode.getServer + "/profiles/admin/atom/profileService.do";
        var __msgText = 'error listing Editable Field';
        var __msgStatus = 'No listEditableFields';
        try {
            ICX.__log(__moduleName, true, 'listEditableFields: executing on ' + theURL);
            let response = await loginNode.rpn(
                {
                    url: theURL,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "listEditableFields OK", response);

            let theService = new JSDOM(response, {contentType: 'application/xml'});
            let editableFields = theService.window.document.querySelectorAll("service > workspace > collection > snx\\:editableFields > snx\\:editableField");
            let theFields = [];
            for (let k=0; k < editableFields.length; k++) {
                theFields.push(editableFields[k].getAttribute('name'));
            }
            return theFields;
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "listEditableFields : " + __msgText, error);
            throw error;
        }
    }
    async function updateProfile(loginNode, theUser, theString, theBody, fullOutput) {
        var theURL;
        if (theString === 'email'){
            theURL = loginNode.getServer + "/profiles/admin/atom/profileEntry.do?mcode=" + ICX.__emailToMCode(theUser);
        } else {
            theURL = loginNode.getServer + "/profiles/admin/atom/profileEntry.do?" + theString + '=' + theUser;
        }
        var __msgText = 'error updating Profile ' + theUser;
        var __msgStatus = 'No updateProfile';
        try {
            ICX.__log(__moduleName, true, 'updateProfile: executing on ' + theURL);
            let response = await loginNode.rpn(
                {
                    url: theURL,
                    method: "PUT",
                    body: theBody,
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "updateProfile OK", response);
            if (fullOutput) {
                response = await loginNode.getUserInfos(theURL, theUser, true, false, false, false);
            }
            return response;
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "updateProfile : " + __msgText, error);
            throw error;
        }
    }
    async function setProfileTagsAdmin(loginNode, sourceName, sourceKey, targetName, targetKey, theTags) {
        var theURL = loginNode.getServer + "/profiles/admin/atom/profileTags.do?targetKey=" + targetKey + '&sourceKey=' + sourceKey;
        var __msgText = 'error setProfileTagsAdmin for ' + targetName + ' (' + sourceName + ')';
        var __msgStatus = 'No setProfileTagsAdmin';
        try {
            ICX.__log(__moduleName, true, 'setProfileTagsAdmin: getting tags set by ' + targetName + ' on ' + sourceName + ' with URL ' + theURL);
            let response = await loginNode.rpn(
                {
                    url: theURL,
                    method: "PUT",
                    body: createTagsUpdateDocument(theTags),
                    headers: {"Content-Type": "application/atom+xml"}
                }                    
            );
            ICX.__logJson(__moduleName, __isDebug, "setProfileTagsAdmin OK", response);
            return response;
        } catch (error) {
            error.message = '{{' + __msgStatus + '}}\n' + error.message;
            ICX.__logJson(__moduleName, true, "setProfileTagsAdmin : " + __msgText, error);
            throw error;
        }
    }

    function ICProfilesGet(config) {      
        RED.nodes.createNode(this,config);                
        //
        //  Global to access the custom HTTP Request object available from the ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		const node = this;

        const mailExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        const server = node.login.getServer;

        this.on(
            'input', 
            function(msg) {
                let myURL = server  + "/profiles";
                if (node.login.authType === "oauth") myURL += '/oauth';
                //
                //  Prepare for callbacks
                //
                switch (config.target) {
                    case "byKeyword" :
                        //
                        //  Check if the KEYWORDS string is specified. It is MANDATORY in this case
                        //
                        let theKeywords = ICX.__getMandatoryInputString(__moduleName, config.mykeywords , msg.IC_keywords, '', 'Keywords', msg, node);
                        if (!theKeywords) return;
                        let tmpKeywords = theKeywords.split(',');
                        for (let k=0; k < tmpKeywords.length; k++) {
                            tmpKeywords[k] = tmpKeywords[k].trim();
                        }
                        theKeywords = tmpKeywords.join();
                        if (!theKeywords) return;
                        //
                        //  Build URL
                        //
                        myURL += "/atom/search.do?sortBy=relevance&search=" + theKeywords + '&format=full&ps=1000&output=hcard&labels=true';
                        //
                        // get Profile By Keywords
                        //
                        mainProcessing().then(async function() {
                            try {
                                node.status({fill:"blue",shape:"dot",text:"Retrieving users by KEYWORD..."});
                                msg.payload = await node.login.getUserInfos(myURL, 'TAGS', false, config.links, config.photoBytes, config.audio);
                                node.status({});
                                node.send(msg);     
                            } catch (error) {
                                ICX.__logError(__moduleName, ICX.__getInfoFromError(error, "ERROR INSIDE mainProcessing"), null, error, msg, node);
                                return;    
                            }
                        })
                        .catch(error => {
                            ICX.__logError(__moduleName, "ERROR getting mainProcessing", null, error, msg, node);
                            return;    
                        });
                        break;
                    case "byTag" :
                        //
                        //  Check if the TAG string is specified. It is MANDATORY in this case
                        //
                        let theTags = ICX.__getMandatoryInputString(__moduleName, config.mytags , msg.IC_tags, '', 'Tags', msg, node);
                        if (!theTags) return;
                        let tmpTags = theTags.split(',');
                        for (let k=0; k < tmpTags.length; k++) {
                            tmpTags[k] = tmpTags[k].trim();
                        }
                        theTags = tmpTags.join();
                        if (!theTags) return;
                        //
                        //  Build URL
                        //
                        myURL += "/atom/search.do?profileTags=" + theTags + '&format=full&ps=1000&output=hcard&labels=true';
                        //
                        // get Profile By Tags
                        //
                        mainProcessing().then(async function() {
                            try {
                                node.status({fill:"blue",shape:"dot",text:"Retrieving users by TAG..."});
                                msg.payload = await node.login.getUserInfos(myURL, 'KEYWORDS', false, config.links, config.photoBytes, config.audio);
                                node.status({});
                                node.send(msg);     
                            } catch (error) {
                                ICX.__logError(__moduleName, ICX.__getInfoFromError(error, "ERROR INSIDE mainProcessing"), null, error, msg, node);
                                return;    
                            }
                        })
                        .catch(error => {
                            ICX.__logError(__moduleName, "ERROR getting mainProcessing", null, error, msg, node);
                            return;    
                        });
                        break;
                    case "syntaxSearch" : 
                        //
                        //  Check if SearchString is specified. It is MANDATORY in this case
                        //
                        let freeSyntax = ICX.__getMandatoryInputString(__moduleName, config.freesyntax , msg.IC_freeSyntax, '', 'Free Syntax', msg, node);
                        if (!freeSyntax) return;
                        //
                        //  Build URL
                        //
                        myURL += '/atom/search.do?' + freeSyntax +'&format=full&output=hcard&labels=true';
                        //
                        // get Profile By Keywords
                        //
                        mainProcessing().then(async function() {
                            try {
                                node.status({fill:"blue",shape:"dot",text:"Retrieving users by SEARCH..."});
                                msg.payload = await node.login.getUserInfos(myURL, 'SEARCH', false, config.links, config.photoBytes, config.audio);
                                node.status({});
                                node.send(msg);     
                            } catch (error) {
                                ICX.__logError(__moduleName, ICX.__getInfoFromError(error, "ERROR INSIDE mainProcessing"), null, error, msg, node);
                                return;    
                            }
                        })
                        .catch(error => {
                            ICX.__logError(__moduleName, "ERROR getting mainProcessing", null, error, msg, node);
                            return;    
                        });
                        break;
                    case "myself" :
                        //
                        // get Profile Informations
                        //
                        mainProcessing().then(async function() {
                            try {
                                node.status({fill:"blue",shape:"dot",text:"Retrieving Current user..."});
                                msg.payload = await node.login.getUserInfosFromId(node.login.userId, config.adminOutput, config.links, config.photoBytes, config.audio);
                                node.status({});
                                node.send(msg);     
                            } catch (error) {
                                ICX.__logError(__moduleName, ICX.__getInfoFromError(error, "ERROR INSIDE mainProcessing"), null, error, msg, node);
                                return;    
                            }
                        })
                        .catch(error => {
                            ICX.__logError(__moduleName, "ERROR getting mainProcessing", null, error, msg, node);
                            return;    
                        });
                        break;
                    case "person" :
                        //
                        //  Check if Target (userId or email) is specified. It is MANDATORY in this case
                        //
                        let mailAddr = ICX.__getMandatoryInputString(__moduleName, config.targetValue , msg.IC_target, '', 'UserId', msg, node);
                        if (!mailAddr) return;
                        //
                        //  Check if the string is a comma-separated list of items
                        //
                        let theItems = mailAddr.split(',');
                        let theUsers = [];
                        for (let i=0; i < theItems.length; i++) {
                            let trimmed = theItems[i].trim();
                            if (trimmed !== '') {
                                theUsers.push(trimmed);
                            }
                        }
                        if (theUsers.length === 0) {
                            ICX.__logError(__moduleName, "Empty target string", null, null, msg, node);
                            return;
                        }
                        mainProcessing().then(async function() {
                            try {
                                msg.payload = [];
                                for (let i=0; i < theUsers.length; i++) {
                                    node.status({fill:"blue",shape:"dot",text:"Retrieving " + theUsers[i] + "..."});
                                    let tmpPayload;
                                    if (mailExp.test(theUsers[i])) {
                                        tmpPayload = await node.login.getUserInfosFromMail(theUsers[i], config.adminOutput, config.links, config.photoBytes, config.audio);
                                    } else {
                                        tmpPayload = await node.login.getUserInfosFromId(theUsers[i], config.adminOutput, config.links, config.photoBytes, config.audio);
                                    }
                                    if (tmpPayload !== null) msg.payload.push(tmpPayload);
                                }
                                node.status({});
                                node.send(msg);     
                            } catch (error) {
                                ICX.__logError(__moduleName, ICX.__getInfoFromError(error, "ERROR INSIDE mainProcessing"), null, error, msg, node);
                                return;    
                            }
                        })
                        .catch(error => {
                            ICX.__logError(__moduleName, "ERROR getting mainProcessing", null, error, msg, node);
                            return;    
                        });
                        break;
                }
             }
        );
    }
    
    RED.nodes.registerType("ICProfilesGet",  ICProfilesGet);

    function ICProfilesSet(config) {      
        RED.nodes.createNode(this,config);                
        //
        //  Global to access the custom HTTP Request object available from the ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		const node = this;

        const server = node.login.getServer;
        
        this.on(
            'input', 
            function(msg) {
                let myURL = server  + "/profiles";
                if (node.login.authType === "oauth") myURL += '/oauth';
                //
                //  Prepare for callbacks
                //
                switch (config.target) {
                    case "person" :
                    case "myself" :
                    case "fromMsg" :
                        {
                            let attributesByUser = [];
                            if (config.target === 'person') {
                                //
                                //  Check if Target (userId or email) is specified. It is MANDATORY in this case
                                //
                                let mailAddr = ICX.__getMandatoryInputString(__moduleName, config.targetValue , msg.IC_target, '', 'UserId', msg, node);
                                if (!mailAddr) return;
                                //
                                //  Check if the string is a comma-separated list of items
                                //
                                let theItems = mailAddr.split(',');
                                for (let i=0; i < theItems.length; i++) {
                                    let trimmed = theItems[i].trim();
                                    if (trimmed !== '') {
                                        attributesByUser.push({user : trimmed});
                                    }
                                }
                                if (attributesByUser.length === 0) {
                                    ICX.__logError(__moduleName, "Empty target string", null, null, msg, node);
                                    return;
                                }
                            } else {
                                if (config.target === 'fromMsg') {
                                    if (!msg.IC_attributesByUser || !Array.isArray(msg.IC_attributesByUser) || (msg.IC_attributesByUser.length === 0)) {
                                        ICX.__logError(__moduleName, "No attributes by User specified", null, null, msg, node);
                                        return;
                                    }
                                    attributesByUser = msg.IC_attributesByUser; 
                                } else {
                                    attributesByUser[0] = {user : node.login.userId};
                                }
                            }
                            if (config.target !== 'fromMsg') {
                                //
                                //  Get the List of Attributes to be modified. 
                                //
                                let tmpAttributes = ICX.__getOptionalInputArray(__moduleName, config.attributes , msg.IC_profileAttributes, 'Attributes', msg, node);
                                //
                                //  Check the Attributes
                                //
                                if (tmpAttributes) {
                                    if (Array.isArray(tmpAttributes)) {
                                        //
                                        //  Coming as an ARRAY from msg.IC_profileAttributes
                                        //
                                        for (let iii=0; iii < attributesByUser.length; iii++) {
                                            attributesByUser[iii].attributes = tmpAttributes;
                                        }
                                    } else {
                                        //
                                        //  Coming from Config Panel.
                                        //  Transform the comma-separated name=value string into an array
                                        //
                                        let tmpAttributesArray = ICX.__getNameValueArray(tmpAttributes);
                                        for (let iii=0; iii < attributesByUser.length; iii++) {
                                            attributesByUser[iii].attributes = tmpAttributesArray;
                                        }
                                    }
                                    if (attributesByUser[0].attributes.length === 0) {
                                        //
                                        //  Empty array. Not a good situation
                                        //
                                        ICX.__logWarning(__moduleName, "Empty Attributes Array", node);
                                    }
                                }
                                //
                                //  Get the List of Tags to be modified. 
                                //
                                let theTagsToAdd = [];
                                let tmpTagsToAdd = ICX.__getOptionalInputString(__moduleName, config.profileTagsAdd , msg.IC_profileTagsToAdd, 'Tags to Add', node);
                                //
                                //  Check the Tags to be added
                                //
                                tmpTagsToAdd = tmpTagsToAdd.trim();
                                if (tmpTagsToAdd !== '') {
                                    theTagsToAdd = ICX.__parseTagsString(tmpTagsToAdd);
                                }
                                ICX.__logJson(__moduleName, __isDebug, 'Tags to be Added :', theTagsToAdd, false);
                                //
                                //  Get the List of Tags to be removed. 
                                //
                                let theTagsToRemove = [];
                                let tmpTagsToRemove = '';
                                if (!config.resetTags) {
                                    tmpTagsToRemove= ICX.__getOptionalInputString(__moduleName, config.profileTagsRemove , msg.IC_profileTagsToRemove, 'Tags to Remove', node);
                                    //
                                    //  Check the Tags to be removed
                                    //
                                    tmpTagsToRemove = tmpTagsToRemove.trim();
                                    if (tmpTagsToRemove !== '') {
                                        theTagsToRemove = ICX.__parseTagsString(tmpTagsToRemove);
                                    }
                                    ICX.__logJson(__moduleName, __isDebug, 'Tags to be Removed :', theTagsToRemove, false);
                                }
                                //
                                //  Now build an array of all the users who are concerned
                                //
                                let tagsByUser = [];
                                if (theTagsToAdd.length > 0) tagsByUser = buildTagsByUser(theTagsToAdd, tagsByUser, __ADD, config.resetTags);
                                if (theTagsToRemove.length > 0) tagsByUser = buildTagsByUser(theTagsToRemove, tagsByUser, __REMOVE, config.resetTags);
                                for (let iii=0; iii < attributesByUser.length; iii++) {
                                    attributesByUser[iii].taggingUsers = tagsByUser;
                                }
                            }
                            //
                            // Set Profile
                            //
                            mainProcessing().then(async function() {
                                try {
                                    let payloadArray = [];
                                    for (let theIndex = 0; theIndex < attributesByUser.length; theIndex++) {
                                        //
                                        //  Do we have all the information ?
                                        //
                                        if (attributesByUser[theIndex].attributes && (attributesByUser[theIndex].attributes.length === 0) && (attributesByUser[theIndex].taggingUsers.length === 0)) {
                                            ICX.__logError(__moduleName, 'Not Enough Information on record ' + theIndex, node);
                                            break;
                                        }
                                        //
                                        //  Announcing
                                        //
                                        if (config.target === 'myself') {
                                            node.status({fill:"blue",shape:"dot",text:"Updating Current user..."});
                                        } else {
                                            node.status({fill:"blue",shape:"dot",text:"Updating user " + attributesByUser[theIndex].user + " ..."});
                                        }
                                        //
                                        //  UPDATE ATTRIBUTES
                                        //  ==================
                                        //
                                        //
                                        //  Build the XML Document associated to each attribute to be modified
                                        //
                                        let targetPayload = null;
                                        let attrDocs = [];
                                        let wholeDoc = '';
                                        if (attributesByUser[theIndex].attributes) {
                                            for (let i=0; i < attributesByUser[theIndex].attributes.length; i++) {
                                                attrDocs[i] = createModifyAttributeDocument(attributesByUser[theIndex].attributes[i].name, attributesByUser[theIndex].attributes[i].value);
                                            }
                                            wholeDoc = createUpdateAttributesDocument(attrDocs);
                                        }
                                        if (wholeDoc !== '') {
                                            //
                                            //  Perform the update of the attributes
                                            //
                                            if (mailExp.test(attributesByUser[theIndex].user)) {
                                                targetPayload = await updateProfile(node.login, attributesByUser[theIndex].user, 'email', wholeDoc, true);
                                            } else {
                                                targetPayload = await updateProfile(node.login, attributesByUser[theIndex].user, 'userid', wholeDoc, true);
                                            }
                                        } else {
                                            //
                                            // Nothing to update. Get the information on the target user (since we are going to need it)
                                            //
                                            if (mailExp.test(theUsers[theIndex])) {
                                                targetPayload = await node.login.getUserInfosFromMail(attributesByUser[theIndex].user, true, false, false, false);
                                            } else {
                                                targetPayload = await node.login.getUserInfosFromId(attributesByUser[theIndex].user, true, false, false, false);
                                            }
                                        }
                                        //
                                        //  UPDATE TAGS
                                        //  ============
                                        //  Now, for each of the users who are tagging the target user retrieve their existing TAGS on the target
                                        //
                                        for (let k=0; k < attributesByUser[theIndex].taggingUsers.length; k++) {
                                            //
                                            //  We need to first get the list of all TAGS from that source user (IN CASE the sourceUser already tagged the targetUser !!!)
                                            //  and, then, amend it according to what we specified in the inputs
                                            //
                                            let allTheExistingTags = getTagsByUser(attributesByUser[theIndex].taggingUsers[k], targetPayload.tagCloud);
                                            if (allTheExistingTags.length > 0) {
                                                //
                                                //  The sourceUser has already tagged the target user
                                                //
                                                if (attributesByUser[theIndex].taggingUsers[k].resetTags) {
                                                    //
                                                    //  In this case, we do not consider existing tags. We suppose that the source user did not tag the target user
                                                    //
                                                    //  NOTE : We performed the "getTagsByUser" call because it, as a side effect, retrievd the name and the key 
                                                    //  of the source user
                                                    //
                                                    allTheExistingTags = [];
                                                }
                                                for (let tt=0; tt < attributesByUser[theIndex].taggingUsers[k].tags.length; tt++) {
                                                    let tmpTag = attributesByUser[theIndex].taggingUsers[k].tags[tt].tagName;
                                                    let tmpOperation = attributesByUser[theIndex].taggingUsers[k].tags[tt].operation;
                                                    let tmpIndex = allTheExistingTags.indexOf(tmpTag);
                                                    if (tmpOperation === __ADD) {
                                                        //
                                                        //  Add the tag to the list
                                                        //
                                                        if (tmpIndex === -1) allTheExistingTags.push(tmpTag);
                                                    } else {
                                                        //
                                                        //  Remove the Tag from the list
                                                        //
                                                        if (tmpIndex !== -1) allTheExistingTags.splice(tmpIndex, 1);
                                                    }
                                                }
                                                //
                                                //  We can trust that getTagsByUser also completed the .key and .name information for the SOURCE USER !!
                                                //
                                            } else {
                                                //
                                                //  The source User NEVER tagged the target user.
                                                //  Add all the tags to be added
                                                //
                                                for (let tt=0; tt < attributesByUser[theIndex].taggingUsers[k].tags.length; tt++) {
                                                    if (attributesByUser[theIndex].taggingUsers[k].tags[tt].operation === __ADD) allTheExistingTags.push(attributesByUser[theIndex].taggingUsers[k].tags[tt].tagName);
                                                }
                                                //
                                                //  Now get the details of the Source User as we do not have them since she never tagged the target before
                                                //
                                                let userPayload;
                                                if (mailExp.test(theSourceUsers[k])) {
                                                    userPayload = await node.login.getUserInfosFromMail(theSourceUsers[k], false, false, false, false);
                                                } else {
                                                    userPayload = await node.login.getUserInfosFromId(theSourceUsers[k], false, false, false, false);
                                                }
                                                if (userPayload !== null) {
                                                    //
                                                    //  User exists
                                                    //
                                                    attributesByUser[theIndex].taggingUsers[k].key = userPayload.key;
                                                    attributesByUser[theIndex].taggingUsers[k].name = userPayload.name;
                                                } else {
                                                    //
                                                    //  apparently this user DOES NOT EXIST
                                                    //
                                                    node.status({fill:"red",shape:"dot",text:"User " + theSourceUsers[k] + " does NOT EXIST !"});
                                                    ICX.__logWarning(__moduleName, "User " + theSourceUsers[k] + " does NOT EXIST !", node);
                                                }
                                            }
                                            //
                                            //  So, now in allTheTags we have the list of Tags to be passed to the PUT operation for that specific SOURCE users
                                            //
                                            if (attributesByUser[theIndex].taggingUsers[k].key !== __QUESTION_MARKS) {
                                                await setProfileTagsAdmin(node.login, attributesByUser[theIndex].taggingUsers[k].name, attributesByUser[theIndex].taggingUsers[k].key, targetPayload.name, targetPayload.key, allTheExistingTags)
                                            }
                                        }
                                        //
                                        //  Get back the TagCloud as it has likely been modified
                                        //
                                        targetPayload.tagCloud = await node.login.getUserTagCloud(targetPayload.name, targetPayload.key);
                                        payloadArray.push(targetPayload);
                                        ICX.__log(__moduleName, true, 'User ' + targetPayload.name + '  succesfully updated !!!');
                                    }
                                    if (config.target === 'myself') {
                                        msg.payload = payloadArray[0];
                                    } else {
                                        if (payloadArray) {
                                            if (payloadArray.length === 1) {
                                                msg.payload = payloadArray[0];
                                            } else {
                                                if (payloadArray.length === 0) {
                                                    msg.payload = null;
                                                } else {
                                                    msg.payload = payloadArray;
                                                }
                                            }
                                        }
                                    }
                                    node.status({});
                                    node.send(msg);     
                                } catch (error) {
                                    ICX.__logError(__moduleName, ICX.__getInfoFromError(error, "ERROR INSIDE mainProcessing"), null, error, msg, node);
                                    return;    
                                }
                            })
                            .catch(error => {
                                ICX.__logError(__moduleName, "ERROR getting mainProcessing", null, error, msg, node);
                                return;    
                            });
                            break;
                        }
                    case "editable":
                        mainProcessing().then(async function() {
                            try {
                                msg.payload = await listEditableFields(node.login);
                                node.status({});
                                node.send(msg);     
                            } catch (error) {
                                ICX.__logError(__moduleName, ICX.__getInfoFromError(error, "ERROR INSIDE mainProcessing"), null, error, msg, node);
                                return;    
                            }
                        })
                        .catch(error => {
                            ICX.__logError(__moduleName, "ERROR getting mainProcessing", null, error, msg, node);
                            return;    
                        });
                        break;
                }
            }
        );
    }
    
    RED.nodes.registerType("ICProfilesSet",  ICProfilesSet);
    
};
