import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

// start the server
// TODO: handle proper CORS
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket events
io.on('connection', (socket) => {
  console.log('A user connected');
  numUsersConnected++;

  // Forward signaling messages between peers
  socket.on('message', (message) => {
    console.log('Received message:', message);
    socket.broadcast.emit('message', message);
    addMessage(numMessagesProcessed++, message);
  });

  socket.on('error', (error) => {
    console.error('Error with the socket connection:', error);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
    numUsersConnected--;
  });
});

// !!!!!!!!!! Start the server !!!!!!!!!!
// TODO: configure the port from env
const PORT = 3030;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// ---------------------------------------------------------------
// get API
app.get('/', (req, res) => {
  var HTML = '<h1>WebRTC Signaling Service is Running!</h1>';
  HTML += '<h2>Number of users connected: ' + numUsersConnected + '</h2>';

  HTML += '<h3>' + numMessagesProcessed +  ' Messages Processed</h3>';
  HTML += '<h3>Recent ' + recentMessages.length +  ' Messages:</h3>';
  
  HTML += createHTMLTable();

  HTML += "<style>th, td { padding: 5px;vertical-align:top}</style>";

  res.send(HTML);
});


// HTML display on get
// few variabls to display on get
let numUsersConnected = 0;
let numMessagesProcessed = 0;
const numMessagesToKeep = 25;
let recentMessages = [];

function addMessage (msgNo, message) {
  recentMessages.push({msgNo: msgNo, message: message});
  if (recentMessages.length > numMessagesToKeep) {
    recentMessages.shift();
  }
}

function createHTMLTable() {
  let table = '<table border="1" style="border-collapse:collapse;">';
  table += '<thead style="background-color:lightgray"><th>Message No.</th><th width="10%">Message Type</th><th width="10%">Tenant</th><th width="20%">Data Channel Name</th>' + 
  '<th width="10%">Channel Type</th><th width="15%">From User</th><th width="15%">To User</th><th width="20%">Message</th></thead>';
  
  recentMessages.forEach((msg) => {
    let message = msg.message;
    let msgNo = msg.msgNo;

    table += '<tr>';
  
    table += '<td>' + msgNo + '</td>';
    table += '<td>' + message.type + '</td>';
  
    let tenantId = 'Not Found';
    if (message.dataChannelLabel.tenantId != null && message.dataChannelLabel.tenantId != undefined) {
      tenantId = message.dataChannelLabel.tenantId;
    }

    table += '<td>' + tenantId + '</td>';

    let channelName = 'Not known';
    if (message.dataChannelLabel.dataChannelName != null && message.dataChannelLabel.dataChannelName != undefined) {
      channelName = message.dataChannelLabel.dataChannelName;
    }

    table += '<td>' + channelName +'</td>';

    let channelType = 'Not Known';
    if (message.dataChannelLabel.channelType != null && message.dataChannelLabel.channelType != null)
      channelType = message.dataChannelLabel.channelType;
      
      table += '<td>' + channelType  + '</td>';


    if (message.dataChannelLabel.fromChannel != null && message.dataChannelLabel.fromChannel != undefined) {
      table += '<td>' + message.dataChannelLabel.fromChannel.name + '</td>';
    } 
    else {
      table += '<td>N/A</td>';
    }

    if (message.dataChannelLabel.toChannel != null && message.dataChannelLabel.toChannel != undefined) {
      table += '<td>' + message.dataChannelLabel.toChannel.name + '</td>';
    } 
    else {
      table += '<td>N/A</td>';
    }

    table += '<td>' + JSON.stringify(message.data) + '</td>';
    table += '</tr>';
  });

  table += '</table>';
  return table;
}