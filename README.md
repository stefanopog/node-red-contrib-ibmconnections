Node-RED IBM Connections Nodes
=====================================

[![npm-version](https://img.shields.io/npm/v/node-red-node-watson.svg)](https://www.npmjs.com/package/node-red-ibmconnections)
[![npm-downloads](https://img.shields.io/npm/dm/node-red-node-watson.svg)](https://www.npmjs.com/package/node-red-ibmconnections)


This package contains a set of nodes to interact with IBM Connections.

# *Changes*

## Changes in V1.6.0
* A new **Set Profiles** node has been created which allows you to modify any editable attriibute (and/or tag) of any user within the same organization.  
<strong style="color:red">This node requires to be associated with a LOGIN node attached to a user who has the Profile Administrator role for the organization.</strong>
    * If <strong>on premises</strong>, this means that the user attached to the LOGIN node is in the <code>admin role</code> for the Profile application.
    * If <strong>in cloud</strong>, this means that the user has the <code>Administrator role</code> for the Organization <strong style="color:red">AND</strong> the organization itself has been granted the <strong>delegation flag</strong>
* The **Get Profiles** node can also return the profile attributes as they are returned by the **Profiles Administration API**.

## Changes in V1.5.0
* The **Get Community** node has been completely redesigned to return full details of the Community/ies. <br />See the node help for more details.<br /> <b style="color:red">Note</b> that some of the incoming input attributes may have been renamed. 
* A new **Create/Update Community** node has been created which allows you to either **create** or **modify** a new/existing Community (or Sub-Community). This node allows you to manage the Community Membership, as well as the list of **widgets/applications** that are part of the Community. It is also possible to set/update the Community Logo image. <br />See the node help for more details.
* The **Get Profiles** node has been completely redesigned to return full details of the retrieved profiles. <br />See the node help for more details.<br /> <b style="color:red">Note</b> that some of the incoming input attributes may have been renamed. 
* The previously mentioned nodes, **Get Profile**, **Get Community** and **Create/Update Community**, introduce <b style="color:red">a new Error Handling</b> approach that makes use of the standard NodeRed **Catch Node**. <br />See the node help for more details.
* Support for **Delegation** (*X_LCONN_RUNAS*) for Cloud POST and PUT operations. This is an <b style="color:red">experimental feature</b>. In order to enable it, you need to set a global context variable (*X_CONN_RUNAS*) in the following way: <code>global.set("X_CONN_RUNAS", "node_id:user_id") </code> where *node_id* is the id of the Login node which performs the delegation and *user_id* is the id of the user who gets delegated

## Changes in V1.4.1
* The **Get Files** node now returns also **folders** (optionally in a recursive way)
* We added an **Upload File node** that enables uploading files to IBM Connections. The node supports uploading a file into the user's library and into a community's library.
* The **Get AS node** has been limited to returning 20 entries by default. For this reason we added the parameter *count* for specifying the maximum number of returned entries.

# List of nodes

This package will add the following nodes into your node-red palette : 

- The **New Activity** node
- The **Get Activities** node
- The **Update Activity** node
- The **Get Forum** node
- The **Get Communities** node
- The **Create/Update Communities** node
- The **Get AS** node
- The **Post to AS** node
- The **Get Profiles** node
- The **Set Profiles** node
- The **Get Files** node
- The **Upload File** node
- The **Simple Search** node


## The Get AS node
This node retrieves the content of the Activity Stream of yourself, of someone else or of a Community. The number of returned entries from an activity stream has been limited to 20 by default. If you want to get more or less entries, you can set the *Count* value to an integer.


## The Post to AS node
This node let you push some text (with or without an embedded experience) into the activity stream of yourself, of someone else or of a Community.


## The Get Profiles node
This node retrieves the complete information from the profile of an IBM Connections user.


## The Set Profiles node
This node updates any editable attribute and/or profile for any user within the same organization.


## The Get Files node
This node retrieves the files for the current user, for another user, for a community or the public files.
It is possible to retrieve files SharedWith and/or SharedBy


## The Upload File node
Uploads a file to the file library of a user or a community in IBM Connections. The incoming payload has to be a stream of buffers or a single buffer object.


## The New Activity node
This node let you create a new Activity (you can specifiy if the Activity is based on a Template and if it needs to be created inside a Community)


## The Get Activities node
This node let you retrieve the information for one or more Activities based on tags or on ID


## The Update Activity node
This node let you add a Section, a Bookmark or a ToDO to an existing Activity.
It also allows you to move an entry from one section to another.


## The New Activity node
This node let you create a new Activity (you can specifiy if the Activity is based on a Template and if it needs to be created inside a Community)


## The Get Communities node
This node let you retrieve all the information for one (specieid by an ID) or more Communities based on tags or on a search string.


## The Create/Update Communities node
This node let you create a new Community (or Subcommunity) or modify an existing one. It supports full membership management, Community widget/application Management and setting/updating the Community Logo


## The Simple Search node
This node performs a Simple Search on IBM Connections, based on flexible and customizable search criteria


# LOGIN configuration node
All the nodes described above require a configuration node in order to work. This is the **ICLogin** node.
The node supports both **Basic Authentication** and **OAuth2.0 Authentication**. 
The same configuration node can be reused across all the instances of the previously described nodes.

# Supported environments
These nodes are intended for **On-prem instances** of IBM Connections >= 4.0 and also for **IBM Connections Cloud**
