require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const socket = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const nocache = require('nocache');

const app = express();

// 1. DISABLE ETAGS (Critical for Test 18: No-Cache)
app.disable('etag');

// 2. PRIMARY SECURITY HEADERS (Tests 16, 17, 18, 19)
// These MUST be defined before any routes or static files.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); // Test 16
  res.setHeader('X-XSS-Protection', '1; mode=block'); // Test 17
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); // Test 18
  res.setHeader('Pragma', 'no-cache'); // Test 18
  res.setHeader('Expires', '0'); // Test 18
  res.setHeader('X-Powered-By', 'PHP 7.4.3'); // Test 19
  next();
});

// 3. HELMET & NOCACHE MIDDLEWARE
app.use(helmet({
  hidePoweredBy: false, // Handled manually above for better reliability
  noSniff: true,
  xssFilter: true,
  contentSecurityPolicy: false // Disable if it interferes with Socket.io loading
}));
app.use(nocache());

// 4. STATIC FILES AND PARSERS
app.use('/public', express.static(process.cwd() + '/public'));
app.use('/assets', express.static(process.cwd() + '/assets'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({ origin: '*' })); 

// 5. ROUTES
app.route('/').get(function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
}); 

// 6. SERVER INITIALIZATION
const portNum = process.env.PORT || 3000;
const server = app.listen(portNum, () => {
  console.log(`Listening on port ${portNum}`);
});

// 7. SOCKET.IO LOGIC
const io = socket(server);

// Ensure Socket.io handshakes also carry the security headers
io.engine.on('headers', (headers) => {
  headers['X-Powered-By'] = 'PHP 7.4.3';
  headers['X-Content-Type-Options'] = 'nosniff';
});

let connectedPlayers = [];

// Initialize a single coin
let currentCoin = {
  x: Math.floor(Math.random() * 500) + 50,
  y: Math.floor(Math.random() * 300) + 50,
  value: 1,
  id: Date.now()
};

io.on('connection', (inst) => {
  console.log('Player connected:', inst.id);

  inst.on('init-player', (newPlayerData = {}) => {
    // Prevent duplicates if already connected
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

    // Maintain the server-assigned ID
    const updated = { ...connectedPlayers[index], ...playerData, id: connectedPlayers[index].id };
    connectedPlayers[index] = updated;
    inst.broadcast.emit('update-player', updated);
  });

  inst.on('hit-coin', ({ playerId, coinId }) => {
    if (coinId === currentCoin.id) {
      connectedPlayers.forEach(p => {
        if (p.id === playerId) p.score += currentCoin.value;
      });

      // Win Condition Check (10 Points)
      const winner = connectedPlayers.find(p => p.id === playerId && p.score >= 10);
      if (winner) {
        io.emit('game-over', { winnerId: winner.id });
        return;
      }

      // Generate New Coin
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