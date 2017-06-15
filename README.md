Node-RED IBM Connections Nodes
=====================================

[![npm-version](https://img.shields.io/npm/v/node-red-node-watson.svg)](https://www.npmjs.com/package/node-red-ibmconnections)
[![npm-downloads](https://img.shields.io/npm/dm/node-red-node-watson.svg)](https://www.npmjs.com/package/node-red-ibmconnections)


This package contains a set of nodes to interact with IBM Connections.

## List of nodes

This package will add 6 new nodes into your node-red palette : 

- The profile OUT node
- The embedded experience node
- The GetProfiles node
- The GetActivities node
- The Udate Activity node
- The CreateActivity node

### The profile OUT node

This node let you write something on your wall or someonelse's wall.

### The embedded experience node

This node let you push an event and its embedded experience into the activity stream of yourself or of someone else.

### The GetProfiles node

This node let you retrieve the profile information for one or more profiles based on tags or on ID

### The GetActivities node

This node let you retrieve the information for one or more Activities based on tags or on ID

### The UpdateActivity node

This node let you add a Section, a Bookmark or a ToDO to an existing Activity

### The CreateActivity node

This node let you create a new Activity (you can specifiy if the Activity is based on a Template and if it needs to be created inside a Community)

## Server configuration node

All nodes above require a configuration node in order to work. Simply edit the node to access this configuration node. 
The same configuration node can be reused to share credentials across nodes.

## Supported environments

These nodes are intended for **On-prem instances** of IBM Connections >= 4.0 and also for **IBM Connections Cloud**