/*
Copyright IBM All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

module.exports = function (RED) {
    const ICX = require('./common.js');
    const __isDebug = ICX.__getDebugFlag();
    const __moduleName = 'IC_Search';
  
    console.log("*****************************************");
    console.log("* Debug mode is " + (__isDebug ? "enabled" : "disabled") + ' for module ' + __moduleName);
    console.log("*****************************************");

    function ICSimpleSearch(config) {
        RED.nodes.createNode(this, config);
        //
        //  Global to access the custom HTTP Request object available from the
        //  ICLogin node
        //
        this.login = RED.nodes.getNode(config.server);
		var node = this;

        var xml2js = require("xml2js");
        var parser = new xml2js.Parser();
        //var builder = new xml2js.Builder({rootName: "content"});
        //var target = "";
        var totalResults = 0;
        var pageSize = 100;
        var maxResults = 1000000;

        function _getDateConstraints(sinceDate, untilDate) {
            var ora = new Date();
            var constraint = new Array();
            for (var kk = sinceDate.getFullYear(); kk <= untilDate.getFullYear(); kk++) {
                var firstMonth, lastMonth = 0;
                if (kk == sinceDate.getFullYear()) {
                    //
                    //  This is the "since year"
                    //  So we start counting from the "since month"
                    //
                    firstMonth = sinceDate.getMonth() + 1;
                } else {
                    //
                    //  This is NOT the "since year".
                    //  So we count from January
                    //
                    firstMonth = 1;
                }
                if (kk == untilDate.getFullYear()) {
                    //
                    //  This is the "until year"
                    //  we count until the "until month"
                    //
                    lastMonth = untilDate.getMonth() + 1;
                } else {
                    //
                    //  This is NOT the "until year"
                    //  So we count until December
                    //
                    lastMonth = 12;
                }
                if ((firstMonth == 1) && (lastMonth == 12)) {
                    //
                    //  This is a "full 12 months year".
                    //  So, we do not count the months for the Category
                    //
                    constraint.push('"Date/' + kk + '"');
                } else {
                    //
                    //  Not a full year
                    //  
                    if ((ora.getFullYear() == untilDate.getFullYear()) &&
                        (ora.getMonth() == untilDate.getMonth())) {
                        //
                        //  "Until" fals in the same month as today
                        //
                        if (firstMonth == 1) {
                            //
                            //  we do not have to count month by month, it is enough to 
                            //  count the whole current year :-)
                            //
                            constraint.push('"Date/' + kk + '"');
                        } else {
                            //
                            //  Since is earlier in the current year
                            //
                            for (let jj = firstMonth; jj <= lastMonth; jj++) {
                                let jj2 = (jj <= 9 ? "0" + jj : jj + '');
                                constraint.push('"Date/' + kk + '/' + jj2 + '"');
                            }
                        }
                    } else {
                        //
                        //  We need to count the months for the Category
                        //
                        for (let jj = firstMonth; jj <= lastMonth; jj++) {
                            let jj2 = (jj <= 9 ? "0" + jj : jj + '');
                            constraint.push('"Date/' + kk + '/' + jj2 + '"');
                        }
                    }
                }
            }
            return '&constraint={"type":"category","values":[' + constraint.join() + ']}';
        }

        function _getItemDetail(record) {
            var item = {};

            item['id'] = record.id[0];
            item['date'] = record.updated[0];
            item['title'] = record.title[0]['_'];
            if (record.summary) item['summary'] = record.summary[0]['_'];
            item['userid'] = record.author[0]['snx:userid'][0];
            item['name'] = record.author[0]['name'][0];
            item['userState'] = record.author[0]['snx:userState'][0];
            if (item['userState'] == 'active') {
                if (record.author[0]['email']) {
                    item['mail'] = record.author[0]['email'][0];
                } else {
                    item['mail'] = 'noname@noorg.org';
                }
            } else {
                item['mail'] = 'noname@noorg.org';
            }
            if (record["snx:communityUuid"]) {
                item.communityUuid = record["snx:communityUuid"][0]['_'];
            } else {
                item.communityUuid = null;
            }
            if (record["snx:membercount"]) {
                item.memberCount = record["snx:membercount"][0]['_'];
            }
            item.ranks = [];
            if (record["snx:rank"]) {
                for (let k=0; k < record["snx:rank"].length; k++) {
                    let tmp = {};
                    tmp.value = record["snx:rank"][k]['_'];
                    tmp.name = record["snx:rank"][k]['$'].scheme;
                    if (tmp.name === "http://www.ibm.com/xmlns/prod/sn/comment") {
                        item.comments = tmp.value;
                    } else {
                        if (tmp.name === "http://www.ibm.com/xmlns/prod/sn/recommendations") {
                            item.recommendations = tmp.value;
                        } else {
                            item.ranks.push(tmp);
                        }
                    }
                }
            } else {
                //
            }
            if (item.ranks.length === 0) delete item.ranks;
            item.fields = [];
            if (record["ibmsc:field"]) {
                for (let k=0; k < record["ibmsc:field"].length; k++) {
                    let tmp = {};
                    tmp.value = record["ibmsc:field"][k]['_'];
                    tmp.id = record["ibmsc:field"][k]['$'].id;
                    item.fields.push(tmp);
                }
            } else {
                //
            }
            item.tags = [];
            item.components = [];
            for (let k=0; k < record.category.length; k++) {
                let tmp = {};
                tmp.term = record.category[k]['$'].term;
                if (record.category[k]['$'].scheme) {
                    tmp.scheme = record.category[k]['$'].scheme;
                }
                if (record.category[k]['$'].label) {
                    tmp.label = record.category[k]['$'].label;
                }
                if (record.category[k]['ibmsc:field']) {
                    let tmp1 = record.category[k]['ibmsc:field'][0];
                    tmp[tmp1['$'].id] = tmp1['_'];
                }
                if (tmp.scheme === "http://www.ibm.com/xmlns/prod/sn/component") {
                    if (tmp.primaryComponent) {
                        item.primaryComponent = tmp.term;
                        item.components.push(tmp);
                    }
                } else {
                    if (tmp.scheme === "http://www.ibm.com/xmlns/prod/sn/doctype") {
                        item.docType = tmp.term;
                    } else {
                        if (tmp.scheme === "http://www.ibm.com/xmlns/prod/sn/accesscontrolled") {
                            item.accessControlled = tmp.term;
                        } else {
                            if (tmp.scheme === "http://www.ibm.com/xmlns/prod/sn/type") {
                                //
                                //  No Op
                                //  
                            } else {
                                item.tags.push(tmp.term);
                            }
                        }
                    }
                }
            }
            item.links = [];
            for (let k=0; k < record.link.length; k++) {
                let tmp = {};
                tmp.rel = record.link[k]['$'].rel;
                tmp.type = record.link[k]['$'].type;
                tmp.href = record.link[k]['$'].href;
                if (record.link[k]['$'].title) {
                    tmp.title = record.link[k]['$'].title;
                } else {
                    tmp.title = null;
                }
                item.links.push(tmp);
                if (tmp.rel === 'self') item.ref = tmp.href;
                if (tmp.rel === 'replies') {
                    item.topics = tmp.href;
                    item.replies = tmp.href.replace('/topics?', '/entries?')
                }
            }
            if (record.contributor) {
                item.contributors = [];
                for (let k=0; k < record.contributor.length; k++) {
                    let tmp = {};
                    tmp.userid = record.contributor[k]['snx:userid'][0];
                    tmp.name = record.contributor[k]['name'][0];
                    tmp.mail = record.contributor[k]['email'][0];
                    item.contributors.push(tmp);
                }
                if (item.contributors.length === 0) delete item.contributors;
            }
            return item;
        }

        function _goSearch(theMsg, theURL, pageNumber, myData, sinceDate, untilDate) {
            node.status({fill: "blue", shape: "dot", text: "Retrieving page " + pageNumber + "/" + Math.floor(totalResults / pageSize) + " ..."});
            node.login.request({
                    url: theURL + '&page=' + pageNumber,
                    method: "GET",
                    headers: {"Content-Type": "application/atom+xml"}
                },
                function (error, response, body) {
                    ICX.__log(__moduleName, __isDebug, '_goSearch: executing on ' + theURL + '&page=' + pageNumber);
                    if (error) {
                        console.log("_goSearch: error getting simple Search : " + theURL + '&page=' + pageNumber);
                        node.status({fill: "red", shape: "dot", text: error});
                        node.error(error.toString(), theMsg);
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            ICX.__log(__moduleName, __isDebug, "SimpleSearch OK (" + response.statusCode + ")");
                            ICX.__log(__moduleName, __isDebug, theURL + '&page=' + pageNumber);
                            //
                            //	Have the node to emit the URL of the newly created event
                            //
                            parser.parseString(body, function (err, result) {
                                if (err) {
                                    console.log(err);
                                    node.status({fill: "red", shape: "dot", text: err.message});
                                    _goSearch(theMsg, theURL, pageNumber + 1, myData, sinceDate, untilDate);
                                } else {
                                    totalResults = result.feed["openSearch:totalResults"][0];
                                    if (result.feed.entry) {
                                        //
                                        //  Collect the results from this round
                                        //
                                        var myItem;
                                        var myDate;
                                        for (let i = 0; i < result.feed.entry.length; i++) {
                                            myItem = _getItemDetail(result.feed.entry[i]);
                                            myDate = new Date(myItem.date);
                                            if ((myDate >= sinceDate) && (myDate <= untilDate)) {
                                                myData.push(myItem);
                                            } else {
                                                ICX.__log(__moduleName, __isDebug, 'Simple Search : Date ' + myDate + ' discarded......');
                                            }
                                        }
                                        //
                                        //  Are there more results to fetch ?
                                        //
                                        if ((pageSize * pageNumber) < totalResults) {
                                            //
                                            //  We need to fetch more
                                            //
                                            if (myData.length < maxResults) {
                                                _goSearch(theMsg, theURL, pageNumber + 1, myData, sinceDate, untilDate); 
                                            } else {
                                                //
                                                //  Nothing more to fetch, it is time to wrap-up
                                                //
                                                theMsg.totalResults = totalResults;
                                                theMsg.payload = myData;
                                                node.status({});
                                                node.send(theMsg);     
                                            }
                                        } else {
                                            //
                                            //  Nothing more to fetch, it is time to wrap-up
                                            //
                                            theMsg.totalResults = totalResults;
                                            theMsg.payload = myData;
                                            node.status({});
                                            node.send(theMsg);
                                        }
                                    } else {
                                        //
                                        //  no results
                                        //
                                        console.log('Missing <ENTRY> element');
                                        node.status({fill: "yellow", shape: "dot", text: "No Result"});
                                        theMsg.totalResults = 0;
                                        theMsg.payload = [];
                                        node.send(theMsg);
                                     }
                                }
                            });
                        } else {
                            console.log("SimpleSearch NOT OK (" + response.statusCode + ")");
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
                node.status({});
                //
                //  Server is a GLOBAL variable
                //
                var myURL  = node.login.getServer + "/search/atom/mysearch";
                //
                //  Get the Query
                //
                let query = ICX.__getMandatoryInputString(__moduleName, config.query, msg.IC_query, '', 'Query', msg, node);
                if (!query) return;
                //
                //  Get the Tags Constraint
                //
                let theTags = ICX.__getOptionalInputString(__moduleName, config.myTags, msg.IC_tags, 'Tag', node);
                if (theTags) {
                    let tagString = '';
                    let tmpTags = theTags.split(',');
                    for (let k=0; k < tmpTags.length; k++) {
                        tagString += '&social={"type":"tag","id":"' + tmpTags[k].trim() + '"}';
                    }
                    theTags = tagString;
                    ICX.__log(__moduleName, __isDebug, 'SimpleSearch : tag constraint set to : ' + theTags);
                }
                //
                //  Get the CommmunityId Constraint
                //
                let communityId = ICX.__getOptionalInputString(__moduleName, config.communityId, msg.IC_communityId, 'CommunityId', node);
                if (communityId) {
                    communityId = '&social={"type":"communityId","id":"' + communityId.trim() + '"}';
                    ICX.__log(__moduleName, __isDebug, 'SimpleSearch : CommunityId constraint set to : ' + communityId);
                }
                //
                //  Get the personId Constraint
                //
                let personId = ICX.__getOptionalInputString(__moduleName, config.personId, msg.IC_userId, 'userId', node);
                if (personId) {
                    personId = personId.trim();
                    if (ICX.__isEmail(personId)) {
                        personId = '&social={"type":"personEmail","id":"' + personId + '"}';
                    } else {
                        personId = '&social={"type":"personUserId","id":"' + personId + '"}';
                    }
                    ICX.__log(__moduleName, __isDebug, 'SimpleSearch : userId constraint set to : ' + personId);
                }
                //
                //  Get the Max number of results
                //
                maxResults = 1000000;
                if (config.limitCB) {      
                    maxResults = __getOptionalInputInteger(__moduleName, config.maxResults, msg.IC_maxResults, 'MaxResults', node);
                    if (maxResults === 0) maxResults =  1000000;
                    ICX.__log(__moduleName, __isDebug, 'SimpleSearch : maxResults set to ' + maxResults);
                }
                //
                //  Get Date Constraints
                //
                let sinceDate = new Date('01/01/1970');
                let untilDate = new Date();
                let dateConstraints = '';
                if (config.sinceCB) {
                    sinceDate = ICX.__getOptionalInputDate(__moduleName, config.sinceDate, msg.sinceDate, msg.IC_sinceDate, true, node);
                    ICX.__log(__moduleName, __isDebug, 'Simple Search - since ' + sinceDate);
                    if (config.untilCB) {
                        untilDate = ICX.__getOptionalInputDate(__moduleName, config.untilDate, msg.untilDate, msg.IC_untilDate, false, node);
                        ICX.__log(__moduleName, __isDebug, 'Simple Search - until ' + untilDate);
                    }
                    dateConstraints = _getDateConstraints(sinceDate, untilDate);
                }
                //
                //  Build the Request
                //
                myURL += '?query=' + encodeURIComponent(query);
                //
                // Add the scope
                //
                myURL += "&scope=" + config.theScope;
                //
                //  Add the dateConstraints
                //
                myURL += dateConstraints;
                //
                //  Add the tag Constraints
                //
                myURL += theTags;
                //
                //  Add the  people Constraints
                //
                myURL += personId;
                //
                //  Add the  Community Constraints
                //
                myURL += communityId;
                //
                //  Add the Sort
                //
                myURL += "&sortKey=" + config.sortKey + "&sortOrder=" + config.sortOrder;
                //
                //  Force PageSize and PersonalContentBoost
                //
                myURL += '&ps=' + pageSize + '&personalization={"type":"personalContentBoost","value":"on"}';
                //
                //  Now we have the query and we can deliver it
                //
                var myData = new Array();
                _goSearch(msg, myURL, 1, myData, sinceDate, untilDate);
            }
        );
    }

    RED.nodes.registerType("ICSimpleSearch", ICSimpleSearch);

};
