import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors  from 'cors';

// https://webrtc-pocs.azurewebsites.net/
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.get('/', (req, res) => {
  res.send('Hello World');
});

io.on('connection', (socket) => {
  console.log('A user connected');

  // Forward signaling messages between peers
  socket.on('message', (message) => {
    console.log('Received message:', message);
    socket.broadcast.emit('message', message);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

const PORT =  3030;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
