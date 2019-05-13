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
                    case "myself" :
                        {
                            //
                            //  Get the Attributes to be modified. It is MANDATORY in this case
                            //
                            let tmpAttributes = ICX.__getMandatoryInputArray(__moduleName, config.attributes , msg.IC_profileAttributes, '', 'Attributes', msg, node);
                            if (!tmpAttributes) return;
                            let theAttributes = null;
                            if (Array.isArray(tmpAttributes)) {
                                //
                                //  Coming as an ARRAY from msg.IC_profileAttributes
                                //
                                theAttributes = tmpAttributes;
                            } else {
                                //
                                //  Coming from Config Panel.
                                //  Transform the comma-separated name=value string into an array
                                //
                                theAttributes = ICX.__getNameValueArray(tmpAttributes);
                            }
                            if (tmpAttributes.length === 0) {
                                //
                                //  Empty array. Not a good situation
                                //
                                ICX.__logError(__moduleName, "Empty Attributes Array", null, null, msg, node);
                                return;
                            }
                            //
                            //  Build the XML Document associated to each attribute to be modified
                            //
                            let attrDocs = [];
                            for (let i=0; i < theAttributes.length; i++) {
                                attrDocs[i] = createModifyAttributeDocument(theAttributes[i].name, theAttributes[i].value);
                            }
                            let wholeDoc = createUpdateAttributesDocument(attrDocs);
                            //
                            // get Profile Informations
                            //
                            mainProcessing().then(async function() {
                                try {
                                    node.status({fill:"blue",shape:"dot",text:"Retrieving Current user..."});
                                    msg.payload = await updateProfile(node.login, node.login.userId, 'userid', wholeDoc, config.fullOutput);;
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
                    case "person" :
                        {
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
                            //
                            //  Get the Attributes to be modified. It is MANDATORY in this case
                            //
                            let tmpAttributes = ICX.__getMandatoryInputArray(__moduleName, config.attributes , msg.IC_profileAttributes, '', 'Attributes', msg, node);
                            if (!tmpAttributes) return;
                            let theAttributes = null;
                            if (Array.isArray(tmpAttributes)) {
                                //
                                //  Coming as an ARRAY from msg.IC_profileAttributes
                                //
                                theAttributes = tmpAttributes;
                            } else {
                                //
                                //  Coming from Config Panel.
                                //  Transform the comma-separated name=value string into an array
                                //
                                theAttributes = ICX.__getNameValueArray(tmpAttributes);
                            }
                            if (tmpAttributes.length === 0) {
                                //
                                //  Empty array. Not a good situation
                                //
                                ICX.__logError(__moduleName, "Empty Attributes Array", null, null, msg, node);
                                return;
                            }
                            //
                            //  Build the XML Document associated to each attribute to be modified
                            //
                            let attrDocs = [];
                            for (let i=0; i < theAttributes.length; i++) {
                                attrDocs[i] = createModifyAttributeDocument(theAttributes[i].name, theAttributes[i].value);
                            }
                            let wholeDoc = createUpdateAttributesDocument(attrDocs);
                            mainProcessing().then(async function() {
                                try {
                                    msg.payload = [];
                                    for (let i=0; i < theUsers.length; i++) {
                                        node.status({fill:"blue",shape:"dot",text:"Updating " + theUsers[i] + "..."});
                                        let tmpPayload;
                                        if (mailExp.test(theUsers[i])) {
                                            tmpPayload = await updateProfile(node.login, theUsers[i], 'email', wholeDoc, config.fullOutput);
                                        } else {
                                            tmpPayload = await updateProfile(node.login, theUsers[i], 'userid', wholeDoc, config.fullOutput);
                                        }
                                        if (tmpPayload !== null) msg.payload.push(tmpPayload);
                                        ICX.__log(__moduleName, true, 'User ' + theUsers[i] + '  succesfully updated !!!');
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
                    case "fromMsg":
                        {
                            //
                            //  Get the Users/Attributes to be modified. It is MANDATORY in this case
                            //
                            let attributesByUser = null;
                            if (!msg.IC_attributesByUser || !Array.isArray(msg.IC_attributesByUser) || (msg.IC_attributesByUser.length === 0)) {
                                __logError(__moduleName, "No attributes by User specified", null, null, msg, node);
                                return;
                            } else {
                                //
                                //  Processing
                                //  We assume that the input Array is already in the right format
                                //
                                for (let i=0; i < msg.IC_attributesByUser.length; i++) {
                                    if (!msg.IC_attributesByUser[i].user) {
                                        //
                                        //  User is NOT specified. This is an error
                                        //
                                        __logError(__moduleName, "No user specified at position " + i, null, null, msg, node);
                                        return;
                                    }
                                }
                                attributesByUser = msg.IC_attributesByUser;
                            }
                            mainProcessing().then(async function() {
                                try {
                                    msg.payload = [];
                                    for (let i=0; i < attributesByUser.length; i++) {
                                        node.status({fill:"blue",shape:"dot",text:"Updating " + attributesByUser[i].user + "..."});
                                        //
                                        //  Build the update XML dcoument
                                        //
                                        let attrDocs = [];
                                        for (let j=0; j < attributesByUser[i].attributes.length; j++) {
                                            attrDocs[j] = createModifyAttributeDocument(attributesByUser[i].attributes[j].name, attributesByUser[i].attributes[j].value);
                                        }
                                        let wholeDoc = createUpdateAttributesDocument(attrDocs);
                                        let tmpPayload;
                                        if (mailExp.test(attributesByUser[i].user)) {
                                            tmpPayload = await updateProfile(node.login, attributesByUser[i].user, 'email', wholeDoc, config.fullOutput);
                                        } else {
                                            tmpPayload = await updateProfile(node.login, attributesByUser[i].user, 'userid', wholeDoc, config.fullOutput);
                                        }
                                        if (tmpPayload !== null) msg.payload.push(tmpPayload);
                                        ICX.__log(__moduleName, true, 'User ' + attributesByUser[i].user + '  succesfully updated !!!');
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
