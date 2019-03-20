/*
Copyright IBM All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

module.exports = function(RED) {
    var __isDebug = process.env.ICDebug || false;
    var __moduleName = 'IC_Activities';
  
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

    function ICparseActivityAtomEntry(entry, isAtom) {
        var xml2js = require("xml2js");
        //var parser = new xml2js.Parser();
        var builder  = new xml2js.Builder({rootName: "entry"});
        var activity = {};
        var isActivity = true;

        //console.log(JSON.stringify(entry, ' ', 2));
        function __checkSchemeValue(entry, scheme, value) {
            var result = false;
            for (let j=0; j < entry.category.length; j++) {
                let tmp = entry.category[j];
                if (tmp['$'].scheme === scheme) {
                    if (tmp['$'].term === value) {
                        result = true;
                        break;
                    }
                }
            }
            return result;
        }
        //
        //  Check if this ENTRY is an ACTIVITY or a TODO
        //
        isActivity = !__checkSchemeValue(entry, "http://www.ibm.com/xmlns/prod/sn/type", "todo");
        //
        //  Start Processing 
        //
        activity.title = entry.title[0]['_'];
        activity.id = entry.id[0].replace('urn:lsid:ibm.com:oa:', '');
        activity.updated = entry.updated[0];
        //activity.published = entry.published[0];
        if (isActivity) {
            //
            //  This is an Activity
            //
            activity.authors = [];
            for (let k=0; k < entry.author.length; k++) {
                let tmp = {};
                tmp.name = entry.author[k].name[0];
                tmp.id = entry.author[k]['snx:userid'][0];
                activity.authors.push(tmp);
            }
            activity.contributors = [];
            for (let k=0; k < entry.contributor.length; k++) {
                let tmp = {};
                tmp.name = entry.contributor[k].name[0];
                tmp.id = entry.contributor[k]['snx:userid'][0];
                activity.contributors.push(tmp);
            }
            if (entry["snx:communityUuid"]) {
                activity.communityUuid = entry["snx:communityUuid"][0];
            } else {
                activity.communityUuid = null;
            }
            activity.links = [];
            for (let k=0; k < entry.link.length; k++) {
                let tmp = {};
                tmp.rel = entry.link[k]['$'].rel;
                tmp.type = entry.link[k]['$'].type;
                tmp.href = entry.link[k]['$'].href;
                if (entry.link[k]['$'].title) {
                    tmp.title = entry.link[k]['$'].title;
                } else {
                    tmp.title = null;
                }
                activity.links.push(tmp);
            }
            //
            //  Now split the categories
            //
            activity.entries = [];
            activity.todos = [];
            activity.sections = [];
            if (entry.entry) {
                for (let k=0; k < entry.entry.length; k++){
                    for (let x=0; x < entry.entry[k].category.length; x++) {
                        if ((entry.entry[k].category[x]['$'].scheme === 'http://www.ibm.com/xmlns/prod/sn/type') && (entry.entry[k].category[x]['$'].term === 'entry')) {
                            let tmp = ICparseActivityAtomEntry2(entry.entry[k], isAtom);
                            activity.entries.push(tmp);                            
                        }
                        if ((entry.entry[k].category[x]['$'].scheme === 'http://www.ibm.com/xmlns/prod/sn/type') && (entry.entry[k].category[x]['$'].term === 'section')) {
                            let tmp = {};
                            tmp.activityId    = entry.entry[k]['snx:activity'][0].replace('urn:lsid:ibm.com:oa:', '');
                            tmp.sectionId     = entry.entry[k].id[0].replace('urn:lsid:ibm.com:oa:', '');
                            tmp.published     = entry.entry[k].published[0];
                            tmp.updated       = entry.entry[k].updated[0];
                            tmp.title         = entry.entry[k].title[0]['_'];
                            tmp.content       = entry.entry[k].content[0]['_'];
                            tmp.author        = {};
                            tmp.author.name   = entry.entry[k].author[0].name[0];
                            tmp.author.userId = entry.entry[k].author[0]['snx:userid'][0];
                            tmp.contributors = [];
                            for (let y= 0; y < entry.entry[k].contributor.length; y++) {
                                tmp.contributors[y] = {};
                                tmp.contributors[y].name = entry.entry[k].contributor[y].name[0];
                                tmp.contributors[y].userId = entry.entry[k].contributor[y]['snx:userid'][0];
                            }
                            tmp.categories = [];
                            for (let y = 0; y < entry.entry[k].category.length; y++) {
                                tmp.categories[y] = {};
                                tmp.categories[y].term = entry.entry[k].category[y]['$'].term;
                                tmp.categories[y].label = entry.entry[k].category[y]['$'].label;
                                tmp.categories[y].scheme = entry.entry[k].category[y]['$'].scheme;
                            }
                            tmp.links = [];
                            for (let y = 0; y < entry.entry[k].link.length; y++) {
                                tmp.links[y] = {};
                                tmp.links[y].rel = entry.entry[k].link[y]['$'].rel;
                                tmp.links[y].type = entry.entry[k].link[y]['$'].type;
                                tmp.links[y].href = entry.entry[k].link[y]['$'].href;
                            }
                            tmp.position = entry.entry[k]['snx:position'][0];
                            activity.sections.push(tmp);
                        }
                        if ((entry.entry[k].category[x]['$'].scheme === 'http://www.ibm.com/xmlns/prod/sn/type') && (entry.entry[k].category[x]['$'].term === 'todo')) {
                            let tmp = {};
                            tmp.activityId = entry.entry[k]['snx:activity'][0].replace('urn:lsid:ibm.com:oa:', '');
                            tmp.completed  = __checkSchemeValue(entry.entry[k], "http://www.ibm.com/xmlns/prod/sn/flags", "completed");
                            if (entry.entry[k].author[0] !== undefined) {
                                tmp.author = {};
                                tmp.author.id = entry.entry[k].author[0]['snx:userid'][0];
                                tmp.author.name = entry.entry[k].author[0].name[0];
                            }
                            if (entry.entry[k]['snx:assignedto'] !== undefined) {
                                tmp.assignedTo = {};
                                tmp.assignedTo.id = entry.entry[k]['snx:assignedto'][0]['$'].userid;
                                tmp.assignedTo.name = entry.entry[k]['snx:assignedto'][0]['$'].name;
                            }
                            if (entry.entry[k]['snx:duedate'] !== undefined) {
                                tmp.dueDate = entry.entry[k]['snx:duedate'][0];
                            }
                            tmp.position = entry.entry[k]['snx:position'][0];
                            activity.todos.push(tmp);
                        }
                    }    
                }
            }
        } else {
            //
            //  this is a TO DO
            //
            activity.activityId = entry['snx:activity'][0].replace('urn:lsid:ibm.com:oa:', '');
            activity.completed  = __checkSchemeValue(entry, "http://www.ibm.com/xmlns/prod/sn/flags", "completed");
            if (entry.author[0] !== undefined) {
                activity.author = {};
                activity.author.id = entry.author[0]['snx:userid'][0];
                activity.author.name = entry.author[0].name[0];
            }
            if (entry['snx:assignedto'] !== undefined) {
                activity.assignedTo = {};
                activity.assignedTo.id = entry['snx:assignedto'][0]['$'].userid;
                activity.assignedTo.name = entry['snx:assignedto'][0]['$'].name;
            }
            if (entry['snx:duedate'] !== undefined) {
                activity.dueDate = entry['snx:duedate'][0];
            }
            if (entry['snx:position']) entry.position = entry['snx:position'][0];
        }
        for (let j=0; j < entry.link.length; j++ ) {
            var tmp = entry.link[j];
            if (tmp['$'].rel === "self") {
                activity.ref =  tmp['$'].href; 
                break;
            }
        }
        if (isAtom) {
            activity.entry = builder.buildObject(entry);
        }
        return activity;
    }

    function ICparseActivityAtomEntry2(entry, isAtom) {
        var xml2js = require("xml2js");
        //var parser = new xml2js.Parser();
        var builder  = new xml2js.Builder({rootName: "entry"});
        var result = {};

        console.log(JSON.stringify(entry, ' ', 2));
        //
        //  Start Processing
        //
        result.activityId    = entry['snx:activity'][0].replace('urn:lsid:ibm.com:oa:', '');
        result.entryId       = entry.id[0].replace('urn:lsid:ibm.com:oa:', '');
        result.published     = entry.published[0];
        result.updated       = entry.updated[0];
        result.title         = entry.title[0]['_'];
        if (entry.content) {
            result.content   = entry.content[0]['_'];
        } else {
            result.content   = '';
        }
        result.author        = {};
        result.author.name   = entry.author[0].name[0];
        result.author.userId = entry.author[0]['snx:userid'][0];
        result.contributors = [];
        for (let k= 0; k < entry.contributor.length; k++) {
            result.contributors[k] = {};
            result.contributors[k].name = entry.contributor[k].name[0];
            result.contributors[k].userId = entry.contributor[k]['snx:userid'][0];
        }
        result.categories = [];
        for (let k = 0; k < entry.category.length; k++) {
            result.categories[k] = {};
            result.categories[k].term = entry.category[k]['$'].term;
            result.categories[k].label = entry.category[k]['$'].label;
            result.categories[k].scheme = entry.category[k]['$'].scheme;
        }
        result.links = [];
        for (let k = 0; k < entry.link.length; k++) {
            result.links[k] = {};
            result.links[k].rel = entry.link[k]['$'].rel;
            result.links[k].type = entry.link[k]['$'].type;
            result.links[k].href = entry.link[k]['$'].href;
        }
        if (entry['thr:in-reply-to']) {
            result.inReplyTo = {};
            result.inReplyTo.ref = entry['thr:in-reply-to'][0]['$'].ref;
            result.inReplyTo.href = entry['thr:in-reply-to'][0]['$'].href;
            result.inReplyTo.type = entry['thr:in-reply-to'][0]['$'].type;
            result.inReplyTo.source = entry['thr:in-reply-to'][0]['$'].source;
        }
        if (entry['snx:field']) {
            result.fields = [];
            for (let k = 0; k < entry['snx:field'].length; k++) {
                let field = entry['snx:field'][k];
                result.fields[k] = {};
                result.fields[k].name = field['$'].name;
                result.fields[k].type = field['$'].type;
                result.fields[k].fieldId   = field['$'].fid;
                switch (result.fields[k].type) {
                    case 'file':
                        result.fields[k].links = [];
                        for (let j=0; j < field.link.length; j++) {
                            result.fields[k].links[j] = {};
                            result.fields[k].links[j].rel = field.link[j]['$'].rel;
                            result.fields[k].links[j].type = field.link[j]['$'].type;
                            result.fields[k].links[j].href = field.link[j]['$'].href;
                            result.fields[k].links[j].length = field.link[j]['$'].length;
                            result.fields[k].links[j].size = field.link[j]['$'].size;
                        }
                        break;
                    case 'text':
                        result.fields[k].summary = field.summary[0]['_'].trim();
                        break;
                    case 'date':
                        result.fields[k].date = field['_'].trim();
                        break;
                    case 'person':
                        result.fields[k].personName = field.name[0];
                        result.fields[k].userId = field['snx:userid'][0];
                        break;
                }
            }    
        } else {
            result.fields = null;
        }
        if (entry['snx:position']) result.position = entry['snx:position'][0];
        if (isAtom) {
            result.entry = builder.buildObject(entry);
        }
        return result;
    }

    function getActivity(node, parser, theMsg, theURL, isAtom, callback, params) {
        node.login.request(
           {
               url: theURL, 
               method: "GET",
               headers:{"Content-Type" : "application/atom+xml; charset=UTF-8"}
           },
           function(error,response,body) {
               console.log('getActivity: executing on ' + theURL);
               if (error) {
                   console.log("getActivity : error getting information for Actvity !");
                   node.status({fill:"red",shape:"dot",text:"No Activity"});
                   node.error(error.toString(), theMsg);
                   return;
               } else {
                   if (response.statusCode >= 200 && response.statusCode < 300) {
                       //
                       //	Have the node to emit the URL of the newly created event
                       //
                       parser.parseString(body, function (err, result) {
                           if (err) {
                               console.log(err);
                               node.status({fill:"red",shape:"dot",text:"Parser Error"});
                               node.error("Parser Error getActivity", theMsg);
                               return;
                           }
                           var myData = new Array();
                           if (result.feed) {
                               myData.push(ICparseActivityAtomEntry(result.feed, isAtom));
                               node.status({fill:"green", shape:"dot", text:"Activity Retrieved"});
                               theMsg.payload = myData;
                               if (callback) {
                                   callback(node, theMsg, result.feed, params);
                               } else {
                                   //
                                   //  The processing ends here.
                                   //
                                   node.send(theMsg);
                               }
                           } else {
                               console.log('No ENTRY found for URL : ' + theURL);
                               node.status({ fill: "red", shape: "dot", text: "No Entry " });
                               node.error('No ENTRY found for URL : ' + theURL, theMsg);
                           }
                       });
                   } else {
                       console.log("GET ACTIVITY  NOT OK (" + response.statusCode + ")");
                       console.log(body);
                       node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                       node.error(response.statusCode + ' : ' + response.body, theMsg);
                   }
               }
           }
       );           
    }

    function getEntry(node, parser, theMsg, theURL, isAtom, callback, params) {
        node.login.request(
            {
                url: theURL, 
                method: "GET",
                headers:{"Content-Type" : "application/atom+xml; charset=UTF-8"}
            },
            function(error,response,body) {
                console.log('getEntry: executing on ' + theURL);
                if (error) {
                    console.log("getEntry : error getting information for Actvity Entry!");
                    node.status({fill:"red",shape:"dot",text:"No Activity"});
                    node.error(error.toString(), theMsg);
                    return;
                } else {
                    if (response.statusCode >= 200 && response.statusCode < 300) {
                        //
                        //	Have the node to emit the URL of the newly created event
                        //
                        parser.parseString(body, function (err, result) {
                            if (err) {
                                console.log(err);
                                node.status({fill:"red", shape:"dot", text:"Parser Error"});
                                return;
                            }
                            if (result.entry) {
                                theMsg.payload = ICparseActivityAtomEntry2(result.entry, isAtom);
                                node.status({fill:"green", shape:"dot", text:"Entry found"});
                                if (callback) {
                                    callback(theMsg, params);
                                } else {
                                    //
                                    //  The processing ends here.
                                    //
                                    node.send(theMsg);
                                }
                            } else {
                                console.log('getEntry : No ENTRY found for URL : ' + theURL);
                                theMsg.payload = {};
                                node.status({fill:"red",shape:"dot",text:"No Entry "});
                                node.error('getEntry : No ENTRY found for URL : ' + theURL, theMsg);
                                return;
                            }
                        });
                    } else {
                        console.log("GET ENTRY : NOT OK (" + response.statusCode + ")");
                        console.log(body);
                        node.status({fill:"red", shape:"dot", text:"Err3 " + response.statusMessage});
                        node.error(response.statusCode + ' : ' + response.body, theMsg);
                        return;
                    }
                }
            }
        );           
    }
        
    function updateActivity(node, parser, theMsg, theURL, payload, isAtom, isPut) {
        var method = "POST";

        if (isPut) method = "PUT";
        node.status({fill:"blue", shape:"dot", text:"Updating..."});
        node.login.request(
           {
               url: theURL, 
               method: method,
               body : payload,
               headers:{"Content-Type" : "application/atom+xml; charset=UTF-8"}
           },
           function(error, response, body) {
               console.log('updateActivity: executing on ' + theURL);
               console.log('updateActivity: posting body ' + payload);
               if (error) {
                   console.log("updateActivity : error updating the Actvity !");
                   node.status({fill:"red",shape:"dot",text:"No Activity"});
                   node.error(error.toString(), theMsg);
                   return;
               } else {
                   if (response.statusCode >= 200 && response.statusCode < 300) {
                       //
                       //	Have the node to emit the URL of the newly created event
                       //
                       parser.parseString(body, function (err, result) {
                           if (err) {
                               console.log(err);
                               node.status({fill:"red",shape:"dot",text:"Parser Error"});
                               node.error("updateActivity: Parser Error", theMsg);
                               return;
                           }
                           if (result.entry) {
                               var myData = new Array();
                               myData.push(ICparseActivityAtomEntry2(result.entry, isAtom));
                               theMsg.payload = myData;
                               node.status({fill:"green", shape:"dot", text:"Activity Succesfully updated"});
                               node.send(theMsg);
                           } else {
                               console.log('updateActivity: No ENTRY found for URL : ' + theURL);
                               node.status({fill:"red",shape:"dot",text:"No Entry "});
                               node.error('updateActivity: Missing <ENTRY>', theMsg);
                          }
                       });
                   } else {
                       console.log("UPDATE ACTIVITY  NOT OK (" + response.statusCode + ")");
                       console.log(body);
                       node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                       node.error(response.statusCode + ' : ' + response.body, theMsg);
                   }
               }
           }
       );           
    }
    
    function _moveEntry(node, theMsg, feed, params) {
        var xml2js = require("xml2js");
        var parser = new xml2js.Parser();
        var builder  = new xml2js.Builder({rootName: "entry"});
            //
        //  is the Entry inside the Activity ?
        //
        var activity = theMsg.payload[0];
        var entryPosition = -1;
        var sectionPosition = - 1;
        if (activity.entries) {
            for (let k = 0; k < activity.entries.length; k++) {
                if (params.entry === activity.entries[k].entryId) {
                    entryPosition = k;
                    break;
                }
            }
            if (entryPosition === -1) {
                //
                //  Entry not part of the Activity
                //
                console.log("Move Entry  NOT OK. Entry " + params.entry + " not part of Activity !" );
                node.status({fill:"red",shape:"dot",text:"Move Entry  NOT OK. Entry " + params.entry + " not part of Activity !"});
                node.error("Move Entry  NOT OK. Entry " + params.entry + " not part of Activity !", theMsg);
            } else {
                //
                //  Check if the Section is in the activity
                //
                if (activity.sections) {
                    for (let k=0; k < activity.sections.length; k++) {
                        if ((params.section === activity.sections[k].sectionId) || (params.section === activity.sections[k].title)) {
                            sectionPosition = k;
                            break;
                        }
                    }
                    if (sectionPosition === -1) {
                        //
                        //  Section not part of the Activity
                        //
                        console.log("Move Entry NOT OK. Section " + params.section + " not part of Acctivity !" );
                        node.status({fill:"red",shape:"dot",text:"Move Entry  NOT OK. Section " + params.section + " not part of Acctivity !"});
                        node.error("Move Entry  NOT OK. Section " + params.section + " not part of Acctivity !", theMsg);
                    } else {
                        //
                        //  everything seems OK.
                        //  We need to build the target XML document
                        //
                        feed.entry[entryPosition]['thr:in-reply-to'][0]['$'].ref = 'urn:lsid:ibm.com:oa:' + activity.sections[sectionPosition].sectionId;
                        for (let j=0; j < activity.sections[sectionPosition].links.length; j++) {
                            if (activity.sections[sectionPosition].links[j].rel === "edit") {
                                feed.entry[entryPosition]['thr:in-reply-to'][0]['$'].href = activity.sections[sectionPosition].links[j].href;
                                break;
                            }
                        }
                        var myURL = params.server + "/activities/service/atom2/activitynode?activityNodeUuid=" + params.entry;
                        var newEntry = builder.buildObject(feed.entry[entryPosition]);
                        newEntry = newEntry.replace('<entry>', '<entry xmlns="http://www.w3.org/2005/Atom" xmlns:app="http://www.w3.org/2007/app" xmlns:snx="http://www.ibm.com/xmlns/prod/sn" xmlns:os="http://a9.com/-/spec/opensearch/1.1/" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:thr="http://purl.org/syndication/thread/1.0">');
                        updateActivity(node, parser, theMsg, myURL, newEntry, params.isAtom, true);
                    }
                } else {
                    //
                    //  There must be some SECTIONS !!!
                    //
                    console.log("Move Entry NOT OK. Section " + params.section + " not part of Acctivity !" );
                    node.status({fill:"red",shape:"dot",text:"Move Entry  NOT OK. Section " + params.section + " not part of Acctivity !"});
                    node.error("Move Entry  NOT OK. Section " + params.section + " not part of Acctivity !", theMsg);
            }
            }
        } else {
            //
            //  There must be some ENTRIES !!!
            //
            console.log("Move Entry  NOT OK. Entry " + params.entry + " not part of Acctivity !" );
            node.status({fill:"red",shape:"dot",text:"Move Entry  NOT OK. Entry " + params.entry + " not part of Acctivity !"});
            node.error("Move Entry  NOT OK. Entry " + params.entry + " not part of Acctivity !", theMsg);
        }
    }

    function ICActivitiesNew(config) {      
        RED.nodes.createNode(this,config);        
        //
        //  Global to access the custom HTTP Request object available from the
        //  ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		var node = this;

        var xml2js = require("xml2js");
        var parser = new xml2js.Parser();
        var builder  = new xml2js.Builder({rootName: "entry"});

        
        function _createActivityFromTemplate(theMsg, templateURL, createURL, communityId, activityName) {
             node.login.request(
                {
                    url: templateURL, 
                    method: "GET",
                    headers:{"Content-Type" : "application/atom+xml; charset=UTF-8"}
                },
                function(error,response,body) {
                    if (error) {
                        console.log("_createActivityFromTemplate : error getting information for Actvity !");
                        node.status({fill:"red",shape:"dot",text:"No Activity"});
                        node.error(error.toString(), theMsg);
                        return;
                    } else {
                        console.log('_getTemplate: executing on ' + templateURL);
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                    node.error("Parser Error _createActivityFromTemplate", theMsg);
                                    return;
                                }
                                if (result.feed) {
                                    //
                                    //  We have succesfully fetched the template
                                    //  Now we have to modify it and pass to the creation function
                                    //
                                    var feedJson = result.feed;
                                    //
                                    //  removing the "template" flag
                                    //
                                    var k = -1;
                                    for (let i=0; i < feedJson.category.length; i++) {
                                        let tmp = feedJson.category[i];
                                        if (tmp["$"].term === "template") {
                                            k = i;
                                            break;
                                        }
                                    }
                                    if (k != -1) feedJson.category.splice(k, 1);
                                    //
                                    //  Changing the flag Activty to CommunityActivity in case
                                    //
                                    if (communityId !== null) {
                                        k = -1;
                                        for (let i=0; i < feedJson.category.length; i++) {
                                            let tmp = feedJson.category[i];
                                            if (tmp["$"].term === "activity") {
                                                tmp["$"].term = "explicit_membership_community_activity";
                                                tmp["$"].label = "Explicit Membership Community Activity";
                                                break;
                                            }
                                        }
                                    }
                                    //
                                    //  Remove unnecessary things
                                    //
                                    //delete(feedJson.id);
                                    //delete(feedJson.link);
                                    delete(feedJson.contributor);
                                    delete(feedJson.author);
                                    delete(feedJson.generator);
                                    delete(feedJson.updated);
                                    delete(feedJson.entry);
                                    //
                                    //  Set the name
                                    //
                                    feedJson.title[0]["_"] = activityName;
                                    //
                                    //  Finally create the activity from template
                                    //
                                    console.log(builder.buildObject(feedJson));
                                    _createActivity(theMsg, createURL, builder.buildObject(feedJson));
                                } else {
                                    console.log('No TEMPLATE found for URL : ' + templateURL);
                                    node.status({fill:"red",shape:"dot",text:"No Entry "});
                                    node.error("Missing <ENTRY>", theMsg);
                                    return;                               
                                }
                            });
                        } else {
                            console.log("_createActivityFromTemplate: GET TEMPLATE NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + " : " + response.body, theMsg);
                            return;                        
                        }
                    }
                }
            );           
        }
        
        function _createActivity(theMsg, theURL, payload) {
            node.login.request(
                {
                    url: theURL, 
                    method: "POST",
                    body : payload,
                    headers:{"Content-Type" : "application/atom+xml; charset=UTF-8"}
                },
                function(error, response, body) {
                    if (error) {
                        console.log("_createActivity: error creating Actvity !");
                        node.status({fill:"red",shape:"dot",text:"Err Create"});
                        node.error(error.toString(), theMsg);
                        return;
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            console.log("_createActivity: POST OK (" + response.statusCode + ")");
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                    node.error("Parser Error _createActivity", theMsg);
                                    return;
                                }
                                var myData = new Array();
                                myData.push(ICparseActivityAtomEntry(result.entry, true));
                                if (result.entry) {
                                    console.log(JSON.stringify(myData, null, 2));
                                    theMsg.payload = myData;
                                    node.status({});
                                    node.send(theMsg);
                                } else {
                                    console.log('_createActivity: No ENTRY found for URL : ' + theURL);
                                    node.status({fill:"red",shape:"dot",text:"No Entry "});
                                    node.error("Missing <ENTRY>", theMsg);
                                }
                            });
                        } else {
                            console.log("_createActivity: Create Activity NOT OK (" + response.statusCode + ")");
                            console.log(body);
                            node.status({fill:"red",shape:"dot",text:"Err3 " + response.statusMessage});
                            node.error(response.statusCode + ' : ' + response.body, theMsg);
                        }
                    }
                }
            );
        }
    
        function createActivity(theMsg, server, theURL, activityName, communityId, templateId) {
            node.status({fill:"blue",shape:"dot",text:"Creating..."});
            if (templateId !== null) {
                //
                //  We need to create an activity from a Template.
                //  Thus we first need to FETCH the template
                //
                var templateURL = server + "/activities/service/atom2/activity?activityUuid=" + templateId;
                _createActivityFromTemplate(theMsg, templateURL, theURL, communityId, activityName);
            } else {
                //
                //  Just create an EMPTY activity
                //
                var body = '';
                body += "<entry";
                body += '    xmlns="http://www.w3.org/2005/Atom"';
                body += '    xmlns:app="http://www.w3.org/2007/app"';
                body += '    xmlns:snx="http://www.ibm.com/xmlns/prod/sn"';
                body += '    xmlns:xhtml="http://www.w3.org/1999/xhtml"';
                body += '    xmlns:thr="http://purl.org/syndication/thread/1.0">';
                body += '    <title type="text">' + activityName + '</title>';
                if (communityId === null) {                   
                    body += '    <category scheme="http://www.ibm.com/xmlns/prod/sn/type" term="activity" label="Activity"/>';
                } else {
                    body += '    <category scheme="http://www.ibm.com/xmlns/prod/sn/type" term="explicit_membership_community_activity" label="Explicit Membership Community Activity"/>';
                }
                body += '    <category scheme="http://www.ibm.com/xmlns/prod/sn/priority" term="1" label="Normal"/>';
                body += '    <content type="html"></content>';
                body += '</entry>';
                _createActivity(theMsg, theURL, body);
            }
        }
        
        this.on(
            'input', 
            function(msg) {
                var serverConfig = RED.nodes.getNode(config.server);
                var myURL        = "";
                //
                //  Server is a GLOBAL variable
                //
                var server = serverConfig.getServer;
                
                //
                //  Activity MUST have a name
                //
                if ((config.activityName === '') && 
                    ((msg.activityName === undefined) || (msg.activityName === ''))) {
                    //
                    //  There is an issue
                    //
                    console.log("createActivity: Missing Activity Name");
                    node.status({fill:"red",shape:"dot",text:"Missing Name"});
                    node.error('Missing Name', msg);
                    return;
                } else {
                    let activityName = '';
                    if (config.activityName !== '') {
                        activityName = config.activityName.trim();
                    } else {
                        activityName = msg.activityName.trim();
                    }
                    let templateId = null;
                    if (config.isTemplate) {
                        if ((config.templateId !== '') || 
                            ((msg.templateId !== undefined) && (msg.templateId !== ''))) {
                            //
                            //  a template has been specified
                            //
                            if (config.templateId !== '') {
                                templateId = config.templateId.trim();
                            } else {
                                templateId = msg.templateId.trim();
                            }
                        }                        
                    }
                    myURL = server + "/activities/service/atom2/activities";
                    let prefix = "?";
                    let communityId = null;
                    if (config.isCommunity) {
                        communityId = __getOptionalInputString('ICActivitiesGet', config.communityId, msg.communityId, 'communityId', msg, node);
                        if (communityId) {
                            myURL += prefix + "commUuid=" + communityId;
                            prefix = "&";
                        }                        
                    }
                    myURL += prefix + "public=yes&authenticate=no";
                    createActivity(msg, server, myURL, activityName, communityId, templateId);
                }
            }
        );
    }
    
    RED.nodes.registerType("ICActivitiesNew", ICActivitiesNew);

    
    function ICActivitiesGet(config) {      
        RED.nodes.createNode(this,config);   
        //
        //  Global to access the custom HTTP Request object available from the
        //  ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		var node = this;
 
        var xml2js   = require("xml2js");
        var parser   = new xml2js.Parser();

        function getActivityList(theMsg, theURL, isAtom, isCommunity) {
             node.login.request(
                {
                    url: theURL, 
                    method: "GET",
                    headers:{"Content-Type" : "application/atom+xml; charset=UTF-8" }
                },
                function(error,response,body) {
                    console.log('getActivityList: executing on ' + theURL);
                    if (error) {
                        console.log("getActivityList : error getting information for ActvityList !");
                        node.status({fill:"red",shape:"dot",text:"No ActivityList"});
                        node.error(error.toString(), theMsg);
                        return;
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill:"red",shape:"dot",text:"Parser Error"});
                                    node.error("Parser Error getActivitiyList", theMsg);
                                    return;
                                }
                                var myData = new Array();
                                if (result.feed.entry) {
                                   //
                                    for (let i=0; i < result.feed.entry.length; i++) {
                                        var processIt = false;
                                        if (isCommunity) {
                                            for (let j=0; j < result.feed.entry[i].category.length; j++) {
                                                var tmp = result.feed.entry[i].category[j]["$"];
                                                if (tmp.scheme == "http://www.ibm.com/xmlns/prod/sn/type") {
                                                    if (tmp.term.indexOf("community_activity") > -1) processIt = true; // see https://github.com/stefanopog/node-red-contrib-ibmconnections/issues/16
                                                }
                                            }
                                        } else {
                                            processIt = true;
                                        }
                                        if (processIt) {
                                            myData.push(ICparseActivityAtomEntry(result.feed.entry[i], isAtom));   
                                        }
                                    }
                                    node.status({fill:"green",shape:"dot",text:"Activities retrieved"});
                                } else {
                                    console.log('getActivityList: No ENTRY found for URL : ' + theURL);
                                    node.status({fill:"red",shape:"dot",text:"No Entry "});
                                }
                                theMsg.payload = myData;
                                node.send(theMsg);
                            });
                        } else {
                            console.log("GET ACTIVITYLIST  NOT OK (" + response.statusCode + ")");
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
                var myURL        = "";
                //
                //  Server is a GLOBAL variable
                //
                var server = serverConfig.getServer;
                
                var theTags = '';
                if (config.activityTags !== '') {
                    theTags = "tag=" + config.activityTags.trim();
                } else {
                    if ((msg.activityTags !== undefined) && (msg.activityTags !== '')) {
                        theTags = "tag=" + msg.activityTags.trim();
                    }
                }
                
                node.status({fill:"blue",shape:"dot",text:"Retrieving..."});
                switch (config.target) {
                    case "AllActivities" :
                        myURL = server + "/activities/service/atom2/activities?public=yes&organization=yes";
                        if (config.isTemplate) myURL += "&templates=only";
                        if (theTags !== '') myURL += '&' + theTags;
                        getActivityList(msg, myURL, config.isAtom, false);
                        break;
                    case "MyActivities" :
                        myURL = server + "/activities/service/atom2/activities?userid=" + serverConfig.userId;
                        if (theTags !== '') myURL += '&' + theTags;
                        getActivityList(msg, myURL, config.isAtom, false);
                        break;
                    case "CommActivities" : {
                        //
                        //  Check if there is a communityId coming from config or from message
                        //
                        let communityId = __getOptionalInputString('ICActivitiesGet', config.communityId, msg.communityId, 'communityId', msg, node);
                        if (communityId) {
                            myURL = server + '/activities/service/atom2/activities?commUuid=' + communityId;
                        } else {
                            myURL = server + "/activities/service/atom2/activities?includeCommunityActivities=only";
                        }
                        if (theTags !== '') myURL += '&' + theTags;
                        getActivityList(msg, myURL, config.isAtom, true);
                        break;
                    }
                    case "byId" :
                        myURL = server + "/activities/service/atom2/activity?activityUuid=";
                        //myURL = server + "/activities/service/atom2/activitynode?activityNodeUuid=";
                        if ((config.activityId === '') && 
                            ((msg.activityId === undefined) || (msg.activityId === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing Activity UUid Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Activity UUid"});
                            node.error('Missing Activity Uuid', msg);
                            return;
                        } else {
                            let theId = '';
                            if (config.activityId !== '') {
                                theId = config.activityId.trim();
                            } else {
                                theId = msg.activityId.trim();
                            }
                            myURL += theId;
                            getActivity(node, parser, msg, myURL, config.isAtom, null, null);
                        }
                        break;
                    case "byEntry" :
                        myURL = server + "/activities/service/atom2/activitynode?activityNodeUuid=";
                        if ((config.entryId === '') && 
                            ((msg.entryId === undefined) || (msg.entryId === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing Entry UUid Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Activity UUid"});
                            node.error('Missing Entry Uuid', msg);
                            return;
                        } else {
                            let theId = '';
                            if (config.entryId !== '') {
                                theId = config.entryId.trim();
                            } else {
                                theId = msg.entryId.trim();
                            }
                            myURL += theId;
                            getEntry(node, parser, msg, myURL, config.isAtom, null, null);
                        }
                        break;
                    case "ToDos" :
                        myURL = server + "/activities/service/atom2/todos?" + config.todos + "=";
                        if (config.meOrOther === "me") {
                            myURL += serverConfig.userId;
                        } else {
                            if ((config.otherPersonId === '') &&
                                ((msg.otherPersonId === undefined) || (msg.otherPersonId === ''))) {
                                //
                                //  There is an issue
                                //
                                console.log("Missing Person ID Information");
                                node.status({ fill: "red", shape: "dot", text: "Missing Person ID" });
                                node.error('Missing Person ID', msg);
                                return;
                            } else {
                                let theId = '';
                                if (config.otherPersonId !== '') {
                                    theId = config.otherPersonId.trim();
                                } else {
                                    theId = msg.otherPersonId.trim();
                                }
                                myURL += theId;
                            }
                        }
                        //
                        //  Adding SORTING and COmpletedToDos
                        //
                        myURL += "&sortfields=duedate&sortorder=0&completedTodos=" + config.completedToDo;
                        getActivityList(msg, myURL, config.isAtom, false);
                        break;
                }
            }
        );
    }
    
    RED.nodes.registerType("ICActivitiesGet", ICActivitiesGet); 
    
    function ICActivitiesUpdate(config) {      
        RED.nodes.createNode(this,config);        
        //
        //  Global to access the custom HTTP Request object available from the
        //  ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		var node = this;

        var xml2js   = require("xml2js");
        var parser   = new xml2js.Parser();

        this.on(
            'input', 
            function(msg) {
                var serverConfig = RED.nodes.getNode(config.server);
                var myURL        = "";
                //
                //  Server is a GLOBAL variable
                //
                var server = serverConfig.getServer;

                var activityId = '';
                if ((config.activityId === '') && 
                    ((msg.activityId === undefined) || (msg.activityId === ''))) {
                    //
                    //  There is an issue
                    //
                    console.log("updateActivity: Missing ActivityID Information");
                    node.status({fill:"red",shape:"dot",text:"updateActivity: Missing ActivityId"});
                    node.error('updateActivity: Missing ActivityID', msg);
                    return;
                }
                if (config.activityId !== '') {
                    activityId = config.activityId.trim();
                } else {
                    activityId = msg.activityId.trim();
                }
                switch (config.target) {
                    case "Reparent" : {
                        //
                        //  Getting Title of the Section (this is a Mandatory argument)
                        //
                        var sectionId2 = '';
                        if ((config.sectionId2 === '') && 
                            ((msg.sectionId2 === undefined) || (msg.sectionId2 === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("updateActivity: Missing Section Name/ID Information");
                            node.status({fill:"red", shape:"dot", text:"updateActivity: Missing Section Name/ID"});
                            node.error('updateActivity: Missing Section Name/ID', msg);
                            return;
                        } else {
                            if (config.sectionId2 !== '') {
                                sectionId2 = config.sectionId2.trim();
                            } else {
                                sectionId2 = msg.sectionId2.trim();
                            }
                        }
                        //
                        //  Getting Entry Id (this is a Mandatory argument)
                        //
                        var entryId2 = '';
                        if ((config.entryId2 === '') && 
                            ((msg.entryId2 === undefined) || (msg.entryId2 === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("updateActivity: Missing Entry ID Information");
                            node.status({fill:"red", shape:"dot", text:"updateActivity: Missing Entry ID"});
                            node.error('updateActivity: Missing Entry ID', msg);
                            return;
                        } else {
                            if (config.entryId2 !== '') {
                                entryId2 = config.entryId2.trim();
                            } else {
                                entryId2 = msg.entryId2.trim();
                            }
                        }
                        myURL = server + "/activities/service/atom2/activity?activityUuid=" + activityId;
                        let params = {
                            section: sectionId2,
                            activity : activityId,
                            entry : entryId2,
                            server : server,
                            isAtom : config.isAtom
                        };
                        getActivity(node, parser, msg, myURL, config.isAtom, _moveEntry, params); 
                        break;
                    }
                    case "Section" :
                        //
                        //  Getting Title of the Section (this is a Mandatory argument)
                        //
                        var sectionTitle = '';
                        if ((config.sectionTitle === '') && 
                            ((msg.sectionTitle === undefined) || (msg.sectionTitle === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing Section Name Information");
                            node.status({fill:"red",shape:"dot",text:"Missing SectionName"});
                            node.error('Missing SectionName', msg);
                            return;
                        } else {
                            if (config.sectionTitle !== '') {
                                sectionTitle = config.sectionTitle;
                            } else {
                                sectionTitle = msg.sectionTitle;
                            }
                        }
                        //
                        //  Getting the Description of the Section
                        //
                        var sectionDesc = '';
                        if (config.sectionDesc !== '') {
                            sectionDesc = config.sectionDesc;
                        } else if ((msg.sectionDesc !== undefined) && (msg.sectionDesc !== '')) {
                            sectionDesc = msg.sectionDesc;
                        }
                        //
                        //  Creating the ATOM Entry document associated to the Section
                        //
                        var newEntry = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
                        newEntry += '<entry xmlns="http://www.w3.org/2005/Atom" ';
                        newEntry += 'xmlns:app="http://www.w3.org/2007/app" ';
                        newEntry += 'xmlns:snx="http://www.ibm.com/xmlns/prod/sn" ';
                        newEntry += 'xmlns:os="http://a9.com/-/spec/opensearch/1.1/" ';
                        newEntry += 'xmlns:xhtml="http://www.w3.org/1999/xhtml" ';
                        newEntry += 'xmlns:thr="http://purl.org/syndication/thread/1.0">';
                        newEntry += '<title type="text">' + sectionTitle + '</title>';
                        newEntry += '<category scheme="http://www.ibm.com/xmlns/prod/sn/type" term="section" label="Section" />';
                        newEntry += '<content type="html">' + sectionDesc + '</content>';
                        newEntry += '<snx:position>0</snx:position>';
                        newEntry += '</entry>';
                        //
                        //  create the Section
                        //
                        myURL = server + "/activities/service/atom2/activity?activityUuid=" + activityId;
                        updateActivity(node, parser, msg, myURL, newEntry, config.isAtom, false);
                        break;
                    case "Bookmark" :
                        var containerId = '';
                        //
                        //  Getting the SectionId in which bookmark needs to be created
                        //  defaults to the ActivityID in case it is missing
                        //
                        if (config.inSection) {
                            if ((config.sectionId === '') && 
                                ((msg.sectionId === undefined) || (msg.sectionId === ''))) {
                                //
                                //  There is an issue
                                //
                                console.log("Missing Section Id Information");
                                node.status({fill:"red",shape:"dot",text:"Missing SectionId"});
                                node.error('Missing SectionID', msg);
                                return;
                            } else {
                                if (config.sectionId !== '') {
                                    containerId = config.sectionId.trim();
                                } else {
                                    containerId = msg.sectionId.trim();
                                }
                            }
                        } else {
                            containerId = activityId ;
                        }
                        //
                        //  Getting the URL for the bookmark (this is a Mandatory argument)
                        //
                        var linkURL = '';
                        if ((config.linkURL === '') && 
                            ((msg.linkURL === undefined) || (msg.linkURL === ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing Bookmark URL Information");
                            node.status({fill:"red",shape:"dot",text:"Missing Bookmark URL"});
                            node.error('Missing Bookmark URL', msg);
                            return;
                        } else {
                            if (config.linkURL !== '') {
                                linkURL = config.linkURL.trim();
                            } else {
                                linkURL = msg.linkURL.trim();
                            }
                        }
                        //
                        //  Getting the String associated to the URL for the bookmark 
                        //  Defaults to the URL value
                        //
                        var linkName = '';
                        if (config.linkName !== '') {
                            linkName = config.linkName;
                        } else if ((msg.linkName !== undefined) && (msg.linkName !== '')) {
                            linkName = msg.linkName;
                        } else {
                            linkName = linkURL;
                        }
                        //
                        //  Getting Titlte and Description for the Link
                        //
                        var linkDesc = '';
                        if (config.linkDesc !== '') {
                            linkDesc = config.linkDesc;
                        } else if ((msg.linkDesc !== undefined) && (msg.linkDesc !== '')) {
                            linkDesc = msg.linkDesc;
                        }                        
                        var linkTitle = '';
                        if (config.linkTitle !== '') {
                            linkTitle = config.linkTitle;
                        } else if ((msg.linkTitle !== undefined) && (msg.linkTitle !== '')) {
                            linkTitle = msg.linkTitle;
                        }                        
                        //
                        //  Creating the ATOM Entry document associated to the Section
                        //
                        newEntry = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
                        newEntry += '<entry xmlns="http://www.w3.org/2005/Atom" ';
                        newEntry += 'xmlns:app="http://www.w3.org/2007/app" ';
                        newEntry += 'xmlns:snx="http://www.ibm.com/xmlns/prod/sn" ';
                        newEntry += 'xmlns:os="http://a9.com/-/spec/opensearch/1.1/" ';
                        newEntry += 'xmlns:xhtml="http://www.w3.org/1999/xhtml" ';
                        newEntry += 'xmlns:thr="http://purl.org/syndication/thread/1.0">';
                        newEntry += '<title type="text">' + linkTitle + '</title>';
                        newEntry += '<category scheme="http://www.ibm.com/xmlns/prod/sn/type" term="entry" label="Entry" />';
                        newEntry += '<content type="html">' + linkDesc + '</content>';
                        newEntry += '<snx:position>0</snx:position>';
                        newEntry += '<snx:field name="Bookmark" type="link">';
                        newEntry += '<link href= "' + linkURL + '" title="' + linkName + '"/>';
                        newEntry += '</snx:field>';
                        newEntry += '<thr:in-reply-to type="application/atom+xml" ';
                        newEntry += 'ref="urn:lsid:ibm.com:oa:' + containerId;
                        newEntry += '" source="snx:activity-id"/></entry>';
                        //
                        //  create the Section
                        //
                        myURL = server + "/activities/service/atom2/activity?activityUuid=" + activityId;
                        updateActivity(node, parser, msg, myURL, newEntry, config.isAtom, false);
                        break;
                    case "ToDo" :
                        containerId = '';
                        //
                        //  Getting the SectionId in which bookmark needs to be created
                        //  defaults to the ActivityID in case it is missing
                        //
                        if (config.inSection) {
                            if ((config.sectionId === '') && 
                                ((msg.sectionId === undefined) || (msg.sectionId === ''))) {
                                //
                                //  There is an issue
                                //
                                console.log("Missing Section Id Information");
                                node.status({fill:"red",shape:"dot",text:"Missing SectionId"});
                                node.error('Missing SectionID', msg);
                                return;
                            } else {
                                if (config.sectionId !== '') {
                                    containerId = config.sectionId.trim();
                                } else {
                                    containerId = msg.sectionId.trim();
                                }
                            }
                        } else {
                            containerId = activityId ;
                        }
                        var toDoDate = '';
                        //
                        //  Getting TODO date and format it properly
                        //
                        if (config.toDoDate !== '') {
                            toDoDate = config.toDoDate;
                        } else if ((msg.toDoDate !== undefined) && (msg.toDoDate !== '')) {
                            toDoDate = msg.toDoDate;
                        }
                        if (toDoDate !== '') {                               
                            var pattern = /(\d{2})\/(\d{2})\/(\d{4})/;
                            toDoDate = toDoDate.replace(pattern,'$3-$2-$1');
                        }
                        //
                        //  Getting TODO userID and username
                        //
                        var toDoUserId = '';
                        if (config.toDoUserId !== '') {
                            toDoUserId = config.toDoUserId.trim();
                        } else if ((msg.toDoUserId !== undefined) && (msg.toDoUserId !== '')) {
                            toDoUserId = msg.toDoUserId.trim();
                        }                        
                        var toDoUserName = '';
                        if (config.toDoUserName !== '') {
                            toDoUserName = config.toDoUserName.trim();
                        } else if ((msg.toDoUserName !== undefined) && (msg.toDoUserName !== '')) {
                            toDoUserName = msg.toDoUserName.trim();
                        }
                        //
                        //  Getting TODO Description
                        //
                        var toDoDesc = '';
                        if (config.toDoDesc !== '') {
                            toDoDesc = config.toDoDesc;
                        } else if ((msg.toDoDesc !== undefined) && (msg.toDoDesc !== '')) {
                            toDoDesc = msg.toDoDesc;
                        }
                        //
                        //  Getting TODO Title
                        //
                        var toDoTitle = '';
                        if (config.toDoTitle !== '') {
                            toDoTitle = config.toDoTitle;
                        } else if ((msg.toDoTitle !== undefined) && (msg.toDoTitle !== '')) {
                            toDoTitle = msg.toDoTitle;
                        }                        
                        //
                        //  Creating the ATOM Entry document associated to the Section
                        //
                        newEntry = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
                        newEntry += '<entry xmlns="http://www.w3.org/2005/Atom" ';
                        newEntry += 'xmlns:app="http://www.w3.org/2007/app" ';
                        newEntry += 'xmlns:snx="http://www.ibm.com/xmlns/prod/sn" ';
                        newEntry += 'xmlns:os="http://a9.com/-/spec/opensearch/1.1/" ';
                        newEntry += 'xmlns:xhtml="http://www.w3.org/1999/xhtml" ';
                        newEntry += 'xmlns:thr="http://purl.org/syndication/thread/1.0">';
                        newEntry += '<title type="text">' + toDoTitle + '</title>';
                        newEntry += '<category scheme="http://www.ibm.com/xmlns/prod/sn/type" term="todo" label="To Do" />';
                        newEntry += '<content type="html">' + toDoDesc + '</content>';
                        newEntry += '<snx:position>0</snx:position>';
                        if (toDoUserId !== '') {
                            newEntry += '<snx:assignedto name="' + toDoUserName + '" userid="' + toDoUserId + '"/>';                                
                        }
                        if (toDoDate !== '') {
                            newEntry += '<snx:duedate>' + toDoDate + '</snx:duedate>';    
                        }
                        newEntry += '<thr:in-reply-to type="application/atom+xml" ';
                        newEntry += 'ref="urn:lsid:ibm.com:oa:' + containerId;
                        newEntry += '" source="snx:activity-id"/></entry>';
                        //
                        //  create the Section
                        //
                        myURL = server + "/activities/service/atom2/activity?activityUuid=" + activityId;
                        updateActivity(node, parser, msg, myURL, newEntry, config.isAtom, false);
                        break;
                }                    
            }
        );
    }
    
    RED.nodes.registerType("ICActivitiesUpdate", ICActivitiesUpdate);

};
