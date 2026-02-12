import Player from './Player.mjs';
import Collectible from './Collectible.mjs';

const socket = io();
const canvas = document.getElementById('game-window');
const ctx = canvas.getContext('2d');

let player;
let players = [];
let coin;
let connected = false;
let initSent = false;
let animationFrameId = null;
let finished = false;
let winnerId = null;

const requestInitOnce = () => {
  if (initSent) return;
  initSent = true;
  socket.emit('init-player', { score: 0 });
};

socket.on('connect', () => {
  connected = false;
  requestInitOnce();
});

// In case we loaded after the socket was already connected
if (socket.connected) {
  requestInitOnce();
}

socket.on('init', ({ id, players: initialPlayers, coin: initialCoin }) => {
  if (connected) return;

  connected = true;
  const mySnapshot = initialPlayers.find(p => p.id === id);

  // Use the server-authoritative spawn if available, otherwise fall back.
  if (mySnapshot) {
    player = new Player(mySnapshot);
  } else {
    const startX = Math.floor(Math.random() * 600) + 20;
    const startY = Math.floor(Math.random() * 400) + 20;
    player = new Player({ x: startX, y: startY, score: 0, id });
    players.push(new Player(player));
    socket.emit('update', player);
  }

  players = initialPlayers.map(p => new Player(p));
  coin = new Collectible(initialCoin);

  startDrawing();
});

socket.on('new-player', (p) => {
  if (!players.find(item => item.id === p.id)) {
    players.push(new Player(p));
  }
});

socket.on('update-player', (p) => {
  const index = players.findIndex(item => item.id === p.id);
  if (index !== -1) {
    players[index] = new Player(p);
  } else {
    players.push(new Player(p));
  }
});

socket.on('remove-player', (id) => {
  players = players.filter(p => p.id !== id);
});

socket.on('new-coin', ({ coin: newCoin, playerId, players: updatedPlayers }) => {
  coin = new Collectible(newCoin);
  players = updatedPlayers.map(p => new Player(p));

  const me = updatedPlayers.find(p => p.id === player?.id);
  if (me) player.score = me.score;
});

socket.on('game-over', ({ winnerId: id }) => {
  finished = true;
  winnerId = id;
});

window.addEventListener('keydown', (e) => {
  if (!player || !connected || finished) return;

  const dirMap = {
    ArrowUp: 'up', w: 'up',
    ArrowDown: 'down', s: 'down',
    ArrowLeft: 'left', a: 'left',
    ArrowRight: 'right', d: 'right'
  };

  const key = e.key.toLowerCase();
  const dir = dirMap[e.key] || dirMap[key];
  if (!dir) return;

  player.movePlayer(dir, 10);

  const idx = players.findIndex(p => p.id === player.id);
  if (idx >= 0) {
    players[idx] = new Player(player);
  } else {
    players.push(new Player(player));
  }

  socket.emit('update', player);

  if (coin && player.collision(coin)) {
    socket.emit('hit-coin', { playerId: player.id, coinId: coin.id });
  }
});

function startDrawing() {
  if (animationFrameId) return;

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (finished) {
      ctx.fillStyle = 'black';
      ctx.font = '28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Game Over! ${winnerId || 'Unknown'} Wins!`, canvas.width / 2, canvas.height / 2);
      animationFrameId = null;
      return;
    }

    if (!player || !coin) {
      ctx.fillStyle = 'black';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for server data...', canvas.width / 2, canvas.height / 2);
      animationFrameId = window.requestAnimationFrame(draw);
      return;
    }

    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(player.calculateRank(players), canvas.width - 20, 30);
    ctx.textAlign = 'left';
    ctx.fillText('WASD/Arrows to move', 20, 30);

    // Leaderboard on the right side
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    ctx.textAlign = 'right';
    ctx.font = '14px Arial';
    ctx.fillText('Leaderboard', canvas.width - 20, 60);
    sortedPlayers.forEach((p, idx) => {
      const label = `${idx + 1}. ${p.id.substring(0, 6)} - ${p.score}`;
      ctx.fillStyle = p.id === player.id ? 'blue' : 'black';
      ctx.fillText(label, canvas.width - 20, 80 + idx * 18);
    });

    ctx.fillStyle = 'gold';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 10, 0, Math.PI * 2);
    ctx.fill();

    players.forEach(p => {
      ctx.fillStyle = p.id === player.id ? 'blue' : 'red';
      ctx.fillRect(p.x, p.y, 30, 30);
    });

    animationFrameId = window.requestAnimationFrame(draw);
  };

  animationFrameId = window.requestAnimationFrame(draw);
}