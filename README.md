Node-RED IBM Connections Nodes
=====================================

[![npm-version](https://img.shields.io/npm/v/node-red-node-watson.svg)](https://www.npmjs.com/package/node-red-ibmconnections)
[![npm-downloads](https://img.shields.io/npm/dm/node-red-node-watson.svg)](https://www.npmjs.com/package/node-red-ibmconnections)


This package contains a set of nodes to interact with IBM Connections.

# List of nodes

This package will add 6 new nodes into your node-red palette : 

- The **Get AS** node
- The **Post to AS** node
- The **Get Profiles** node
- The **Get Files** node
- The **New Activity** node
- The **Get Activities** node
- The **Update Activity** node
- The **Get Communities** node
- The **Update Communities** node
- The **Simple Search** node

## The Get AS node
This node retrieves the content of the Activity Stream of yourself, of someone else or of a Community`


## The Post to AS node

This node let you push some text (with or without an embedded experience) into the activity stream of yourself, of someone else or of a Community.


## The Get Profiles node

This node retrieves the information from the profile of an IBM Connections user.
This node now allows retrieving also the photo associated to the user.


## The Get Files node

This node retrieves the files for the current user, for another user, for a community or the public files.
It is possible to retrieve files SharedWith and/or SharedBy


## The New Activity node

This node let you create a new Activity (you can specifiy if the Activity is based on a Template and if it needs to be created inside a Community)


## The Get Activities node

This node let you retrieve the information for one or more Activities based on tags or on ID


## The Update Activity node

This node let you add a Section, a Bookmark or a ToDO to an existing Activity


## The New Activity node

This node let you create a new Activity (you can specifiy if the Activity is based on a Template and if it needs to be created inside a Community)


## The Get Communities node

This node let you retrieve the information for one (specieid by an ID) or more Communities based on tags or on a search string.


## The Update Communities node

This node let you add or remove a Member from a Community


## The Simple Search node

This node performs a Simple Search on IBM Connections, based on flexible and customizable search criteria


# LOGIN configuration node

All the nodes described above require a configuration node in order to work. This is the **ICLogin** node.
The node supports both **Basic Authentication** and **OAuth2.0 Authentication**. 
The same configuration node can be reused across all the instances of the previously described nodes.

# Supported environments

These nodes are intended for **On-prem instances** of IBM Connections >= 4.0 and also for **IBM Connections Cloud**