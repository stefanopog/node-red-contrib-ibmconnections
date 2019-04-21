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

    function ICProfilesGet(config) {      
        RED.nodes.createNode(this,config);                
        //
        //  Global to access the custom HTTP Request object available from the
        //  ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		var node = this;

        const mailExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        const server = node.login.getServer;

        
        async function mainProcessing() {
            return;
        }

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
                                msg.payload = await node.login.getUserInfos(myURL, 'TAGS', config.links, config.photoBytes);
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
                                msg.payload = await node.login.getUserInfos(myURL, 'KEYWORDS', config.links, config.photoBytes);
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
                        let freeSyntax = ICX.__getMandatoryInputString(__moduleName, config.freesyntax , msg.IC_freesyntax, '', 'Free Syntax', msg, node);
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
                                msg.payload = await node.login.getUserInfos(myURL, 'SEARCH', config.links, config.photoBytes);
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
                                msg.payload = await node.login.getUserInfosFromId(node.login.userId, config.links, config.photoBytes);
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
                        //  Check if Target (userId or email)  is specified. It is MANDATORY in this case
                        //
                        let mailAddr = ICX.__getMandatoryInputString(__moduleName, config.targetValue , msg.IC_target, '', 'UserId', msg, node);
                        if (!mailAddr) return;
                        mainProcessing().then(async function() {
                            try {
                                node.status({fill:"blue",shape:"dot",text:"Retrieving " + mailAddr + "..."});
                                if (mailExp.test(mailAddr)) {
                                    msg.payload = await node.login.fromMailToId(mailAddr, config.links, config.photoBytes);
                                } else {
                                    msg.payload = await node.login.getUserInfosFromId(mailAddr, config.links, config.photoBytes);
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
    
};
