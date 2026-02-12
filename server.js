require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const socket = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const nocache = require('nocache');

const app = express();

// 1. SECURITY MIDDLEWARE (Required for FCC)
app.use(helmet.hidePoweredBy({ setTo: 'PHP 7.4.3' }));
app.use(helmet.noSniff());
app.use(helmet.xssFilter());
app.use(nocache());

app.use('/public', express.static(process.cwd() + '/public'));
app.use('/assets', express.static(process.cwd() + '/assets'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({origin: '*'})); 

app.route('/').get(function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
}); 

const portNum = process.env.PORT || 3000;
const server = app.listen(portNum, () => {
  console.log(`Listening on port ${portNum}`);
});

// 2. SOCKET.IO SERVER-SIDE LOGIC
const io = socket(server);
let connectedPlayers = [];

let currentCoin = {
  x: Math.floor(Math.random() * 500) + 50,
  y: Math.floor(Math.random() * 300) + 50,
  value: 1,
  id: Date.now()
};

io.on('connection', (inst) => {
  console.log('Player connected:', inst.id);

  inst.on('init-player', (newPlayerData = {}) => {
    if (connectedPlayers.some(p => p.id === inst.id)) {
      inst.emit('init', { id: inst.id, players: connectedPlayers, coin: currentCoin });
      return;
    }

    const player = {
      id: inst.id,
      x: Number(newPlayerData.x) || Math.floor(Math.random() * 500) + 50,
      y: Number(newPlayerData.y) || Math.floor(Math.random() * 300) + 50,
      score: Number(newPlayerData.score) || 0
    };

    connectedPlayers.push(player);
    inst.emit('init', { id: inst.id, players: connectedPlayers, coin: currentCoin });
    inst.broadcast.emit('new-player', player);
  });

  inst.on('update', (playerData) => {
    const index = connectedPlayers.findIndex(p => p.id === playerData.id);
    if (index === -1) return;

    const updated = { ...connectedPlayers[index], ...playerData, id: connectedPlayers[index].id };
    connectedPlayers[index] = updated;
    inst.broadcast.emit('update-player', updated);
  });

  inst.on('hit-coin', ({ playerId, coinId }) => {
    if (coinId === currentCoin.id) {
      connectedPlayers.forEach(p => {
        if (p.id === playerId) p.score += currentCoin.value;
      });

      const winner = connectedPlayers.find(p => p.id === playerId && p.score >= 10);
      if (winner) {
        io.emit('game-over', { winnerId: winner.id });
        return;
      }

      currentCoin = {
        x: Math.floor(Math.random() * 500) + 50,
        y: Math.floor(Math.random() * 300) + 50,
        value: 1,
        id: Date.now()
      };

      io.emit('new-coin', { coin: currentCoin, playerId, players: connectedPlayers });
    }
  });

  inst.on('disconnect', () => {
    connectedPlayers = connectedPlayers.filter(p => p.id !== inst.id);
    io.emit('remove-player', inst.id);
    console.log('Player disconnected:', inst.id);
  });
});

module.exports = app;