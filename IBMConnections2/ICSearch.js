/*
Copyright IBM All Rights Reserved.

SPDX-License-Identifier: Apache-2.0
*/

module.exports = function (RED) {
    var __isDebug = process.env.ICDebug || false;
    var __moduleName = 'IC_Search';
  
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

        function _getDate(fromConfig, fromMsg, label, theMsg) {
            var datePattern = /(\d{2})\/(\d{2})\/(\d{4})/;
            if ((fromConfig == '') && ((fromMsg == undefined) || (fromMsg == ''))) {
                //
                //  There is an issue
                //
                console.log("Missing " + label + " Date");
                node.status({fill: "red", shape: "dot", text: "Missing " + label + " Date"});
                node.error("Missing " + label + " Date", theMsg);
                if (label == "Since") {
                    return new Date('01/01/1970');
                } else {
                    return new Date();
                }
            } else {
                var bb;
                if (fromConfig != '') {
                    bb = fromConfig;
                } else {
                    bb = fromMsg;
                }
                bb = bb.replace(datePattern, '$3-$2-$1');
                return new Date(bb);
            }
        }

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
            item['userid'] = record.author[0]['snx:userid'][0];
            item['name'] = record.author[0]['name'][0];
            item['userState'] = record.author[0]['snx:userState'][0];
            if (item['userState'] == 'active') {
                item['mail'] = record.author[0]['email'][0];
            } else {
                item['mail'] = 'noname@noorg.org';
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
                    console.log('_goSearch: executing on ' + theURL + '&page=' + pageNumber);
                    if (error) {
                        console.log("_goSearch: error getting simple Search : " + theURL + '&page=' + pageNumber);
                        node.status({fill: "red", shape: "dot", text: error});
                        node.error(error.toString(), theMsg);
                    } else {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            console.log("SimpleSearch OK (" + response.statusCode + ")");
                            console.log(theURL + '&page=' + pageNumber);
                            //console.log(body);
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
                                                console.log('Simple Search : Date ' + myDate + ' discarded......');
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
                                        node.error('Missing <ENTRY> element', theMsg);
                                        node.status({fill: "red", shape: "dot", text: "No Entry"});
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
                var serverConfig = RED.nodes.getNode(config.server);
                var myURL = "";
                //
                //  Server is a GLOBAL variable
                //
                var server = serverConfig.getServer;

                myURL = server + '/search/atom/mysearch';
                if ((config.query == '') && 
                    ((msg.query == undefined) || (msg.query == ''))) {
                    //
                    //  There is an issue
                    //
                    console.log("Missing Query Information");
                    node.status({fill: "red", shape: "dot", text: "Missing Query"});
                    node.error('Missing Query', msg);
                } else {
                    //
                    //  Get the Max number of results
                    //
                    if (config.limitCB) {                       
                        if ((config.maxResults == '') && 
                            ((msg.maxResults == undefined) || (msg.maxResults == ''))) {
                            //
                            //  There is an issue
                            //
                            console.log("Missing maxResults");
                            node.status({fill: "red", shape: "dot", text: "Missing maxResults"});
                            node.error("Missing maxResults", msg);
                            maxResults = 1000000;
                        } else {
                            if (config.maxResults != '') {
                                maxResults = config.maxResults.trim();
                            } else {
                                maxResults = msg.maxResults.trim();
                            }
                            if (maxResults != parseInt(maxResults, 10)) {
                                console.log('bad conversion of maxResults ' + maxResults);
                                maxResults = 1000000;
                            } else {
                                maxResults = parseInt(maxResults, 10);
                            }
                            console.log('SimpleSearch : maxResults set to ' + maxResults);
                        }
                    }
                    //
                    //  Get the Dates if present
                    //
                    var sinceDate = new Date('01/01/1970');
                    var untilDate = new Date();
                    var constraints = '';
                    if (config.sinceCB) {
                        sinceDate = _getDate(config.sinceDate, msg.sinceDate, 'Since', msg);
                        if (config.untilCB) {
                            untilDate = _getDate(config.untilDate, msg.untilDate, 'Until', msg);
                        } else {
                            //
                            //  No Until DAte .
                            //  So, we consider up to NOW
                            //
                            untilDate = new Date();
                            console.log('Simple Search : no UNTIL date');
                        }
                        constraints = _getDateConstraints(sinceDate, untilDate);
                    } else {
                        console.log('Simple Search : no SINCE date');
                    }
                    console.log('Simple Search - since ' + sinceDate);
                    console.log('Simple Search - until ' + untilDate);
                    var query = '';
                    if (config.query != '') {
                        query = config.query;
                    } else {
                        query = msg.query;
                    }
                    myURL += '?query="' + encodeURIComponent(query) + '"';
                    //
                    // Add the scope
                    //
                    myURL += "&scope=" + config.theScope;
                    //
                    //  Add the Sort
                    //
                    myURL += "&sortKey=" + config.sortKey + "&sortOrder=" + config.sortOrder;
                    //
                    //  Add the Constraints
                    //
                    myURL += constraints;
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
            }
        );
    }

    RED.nodes.registerType("ICSimpleSearch", ICSimpleSearch);

};
