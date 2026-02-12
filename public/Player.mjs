class Player {
  constructor({x, y, score = 0, id}) {
    this.x = x;
    this.y = y;
    this.score = score;
    this.id = id;
  }

  movePlayer(dir, speed) {
    if (dir === 'up') this.y -= speed;
    if (dir === 'down') this.y += speed;
    if (dir === 'left') this.x -= speed;
    if (dir === 'right') this.x += speed;
  }

  collision(item) {
    if (!item) return false;
    const playerSize = 30;
    const itemSize = 20;
    return (
      this.x < item.x + itemSize &&
      this.x + playerSize > item.x &&
      this.y < item.y + itemSize &&
      this.y + playerSize > item.y
    );
  }

  calculateRank(arr) {
    if (!arr.length) return 'Rank: 0/0';

    const sorted = [...arr].sort((a, b) => b.score - a.score);
    const currentRanking = sorted.findIndex(p => p.id === this.id) + 1;
    return `Rank: ${currentRanking}/${arr.length}`;
  }
}

export default Player;