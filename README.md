Node-RED IBM Connections Nodes
=====================================

This package is a fork of the [GitHub-Repo](https://github.com/stefanopog/node-red-contrib-ibmconnections) from [Stefano Pogliani](https://github.com/stefanopog).

# *Changes*
## Changes in comparison to V1.4.1
* We added an **Upload File node** that enables uploading files to IBM Connections. The node supports uploading a file into the user's library and into a community's library.
* The **Get AS node** has been limited to returning 20 entries by default. For this reason we added the parameter *count* for specifying the maximum number of returned entries.

# List of nodes

This package contains the following nodes: 

- The **New Activity** node
- The **Get Activities** node
- The **Update Activity** node
- The **Get Forum** node
- The **Get Communities** node
- The **Update Communities** node
- The **Get AS** node
- The **Post to AS** node
- The **Get Profiles** node
- The **Get Files** node
- The **Upload File** node
- The **Simple Search** node

The documentation for each of the existing nodes can be found in the original [repository](https://github.com/stefanopog/node-red-contrib-ibmconnections) from Stefano Pogliani.

## The Upload File node
Uploads a file to the file library of a user or a community in IBM Connections. The incoming payload has to be a stream of buffers or a single buffer object. 

## The Get AS node
The number of returned entries from an activity stream is limited to 20 by default. If you want to get more or less entries, you can set the *Count* value to an integer. 

