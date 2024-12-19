console.log('Game script loaded');

function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class GameMode {
    constructor(name, description) {
        this.name = name;
        this.description = description;
    }
}

class Snake {
    constructor(gameWidth, gameHeight) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.tileSize = 20;
        this.length = 1;
        this.body = [new Point(gameWidth/2, gameHeight/2)];
        this.direction = new Point(this.tileSize, 0);
        this.lastMove = 0;
        this.moveDelay = 100; // milliseconds between moves
        this.hue = 0.3; // Green hue
        this.glowIntensity = 0;
        this.lastGrowth = Date.now();
        this.powerUps = {
            speed: false,
            shield: false,
            slow: false,
            double: false
        };
        this.baseSpeed = 100; // Base move delay
        this.moveDelay = this.baseSpeed;
    }

    getHeadPosition() {
        return this.body[0];
    }

    move() {
        const now = Date.now();
        if (now - this.lastMove < this.moveDelay) {
            return;
        }
        this.lastMove = now;

        const head = this.getHeadPosition();
        const newHead = new Point(
            head.x + this.direction.x,
            head.y + this.direction.y
        );

        // Handle wrapping in Unbounded mode
        if (currentGameMode === 'Unbounded') {
            if (newHead.x < 0) newHead.x = this.gameWidth - this.tileSize;
            if (newHead.x >= this.gameWidth) newHead.x = 0;
            if (newHead.y < 0) newHead.y = this.gameHeight - this.tileSize;
            if (newHead.y >= this.gameHeight) newHead.y = 0;
        }

        this.body.unshift(newHead);
        while (this.body.length > this.length) {
            this.body.pop();
        }

        if (this.body.length > this.length) {
            this.lastGrowth = Date.now();
        }
    }

    checkCollision() {
        const head = this.getHeadPosition();
        
        // Check self collision
        const selfCollision = this.body.slice(1).some(point => 
            point.x === head.x && point.y === head.y
        );
        
        // Check mongoose collision if in Mongoose Infested mode
        const mongooseCollision = currentGameMode === 'Mongoose Infested' && mongoose && 
            Math.abs(mongoose.position.x - head.x) < this.tileSize &&
            Math.abs(mongoose.position.y - head.y) < this.tileSize;
        
        // Check obstacle collision if in Obstacle Course mode
        const obstacleCollision = currentGameMode === 'Obstacle Course' &&
            obstacles.some(obstacle => 
                head.x < obstacle.x + obstacle.width &&
                head.x + this.tileSize > obstacle.x &&
                head.y < obstacle.y + obstacle.height &&
                head.y + this.tileSize > obstacle.y
            );
        
        return selfCollision || mongooseCollision || obstacleCollision;
    }

    checkBounds() {
        const head = this.getHeadPosition();
        if (currentGameMode === 'Unbounded') {
            return false; // Never die from bounds in Unbounded mode
        }
        return head.x < 0 || head.x >= this.gameWidth ||
               head.y < 0 || head.y >= this.gameHeight;
    }

    handleKeys(key) {
        switch(key) {
            case 'ArrowUp':
                if (this.direction.y === 0) {
                    this.direction = new Point(0, -this.tileSize);
                }
                break;
            case 'ArrowDown':
                if (this.direction.y === 0) {
                    this.direction = new Point(0, this.tileSize);
                }
                break;
            case 'ArrowLeft':
                if (this.direction.x === 0) {
                    this.direction = new Point(-this.tileSize, 0);
                }
                break;
            case 'ArrowRight':
                if (this.direction.x === 0) {
                    this.direction = new Point(this.tileSize, 0);
                }
                break;
        }
    }

    draw(ctx) {
        const now = Date.now();
        // Pulse glow effect when snake grows
        if (now - this.lastGrowth < 500) {
            this.glowIntensity = Math.max(0, 1 - (now - this.lastGrowth) / 500);
        }

        ctx.save();
        // Draw snake body with gradient and glow
        this.body.forEach((point, index) => {
            const segmentHue = (this.hue + index * 0.01) % 1;
            ctx.shadowBlur = 10 + this.glowIntensity * 10;
            ctx.shadowColor = hslToRgb(segmentHue, 1, 0.5);
            ctx.fillStyle = hslToRgb(segmentHue, 0.8, 0.5);
            
            // Add subtle movement to each segment
            const wobble = Math.sin(now / 200 + index * 0.5) * 0.5;
            ctx.fillRect(
                point.x + wobble, 
                point.y + wobble, 
                this.tileSize - 2, 
                this.tileSize - 2
            );
        });
        ctx.restore();
    }

    applyPowerUp(type) {
        this.powerUps[type] = true;
        setTimeout(() => {
            this.powerUps[type] = false;
            this.updateSpeed();
        }, 5000);

        switch(type) {
            case 'speed':
                this.moveDelay = this.baseSpeed * 0.5;
                break;
            case 'shield':
                // Immunity to collisions
                break;
            case 'slow':
                if (mongoose) mongoose.speed *= 0.5;
                break;
            case 'double':
                // Double points
                break;
        }
    }
}

class Food {
    constructor(gameWidth, gameHeight) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.tileSize = 20;
        this.position = new Point(0, 0);
        this.sprites = [];
        this.currentFrame = 0;
        this.loadSprites();
        this.randomizePosition();
        this.pulsePhase = 0;
        this.scale = 1;
    }

    loadSprites() {
        // Create food animation frames
        const colors = ['#ff0000', '#ff3333', '#ff6666', '#ff9999'];
        this.sprites = colors.map(color => {
            const canvas = document.createElement('canvas');
            canvas.width = this.tileSize;
            canvas.height = this.tileSize;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(this.tileSize/2, this.tileSize/2, this.tileSize/2, 0, Math.PI * 2);
            ctx.fill();
            return canvas;
        });
    }

    randomizePosition() {
        this.position.x = Math.floor(Math.random() * (this.gameWidth/this.tileSize)) * this.tileSize;
        this.position.y = Math.floor(Math.random() * (this.gameHeight/this.tileSize)) * this.tileSize;
    }

    update() {
        this.currentFrame = (this.currentFrame + 1) % this.sprites.length;
        this.pulsePhase += 0.1;
        this.scale = 1 + Math.sin(this.pulsePhase) * 0.1;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(
            this.position.x + this.tileSize/2,
            this.position.y + this.tileSize/2
        );
        ctx.scale(this.scale, this.scale);
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff6666';
        ctx.drawImage(
            this.sprites[this.currentFrame],
            -this.tileSize/2,
            -this.tileSize/2
        );
        
        // Add sparkle effect
        const sparkleTime = Date.now() / 1000;
        for (let i = 0; i < 4; i++) {
            const angle = sparkleTime + i * Math.PI / 2;
            const distance = 5 + Math.sin(sparkleTime * 2) * 2;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(
                Math.cos(angle) * distance,
                Math.sin(angle) * distance,
                1,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
        ctx.restore();
    }
}

class GameMenu {
    constructor(gameWidth, gameHeight) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.mainOptions = ['Play Game', 'High Scores', 'Quit'];
        this.gameModes = [
            new GameMode('Prison Yard', 'Classic mode with walls - Don\'t crash!'),
            new GameMode('Unbounded', 'No walls - Only yourself to fear'),
            new GameMode('Obstacle Course', 'Navigate through obstacles'),
            new GameMode('Mongoose Infested', 'Beware of the hungry mongoose!')
        ];
        this.selected = 0;
        this.state = 'MAIN'; // MAIN or MODE_SELECT
    }

    draw(ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Snake Game', this.gameWidth/2, 100);

        ctx.font = '24px Arial';
        
        if (this.state === 'MAIN') {
            this.mainOptions.forEach((option, i) => {
                ctx.fillStyle = i === this.selected ? '#ffff00' : '#ffffff';
                ctx.fillText(option, this.gameWidth/2, 250 + i*50);
            });
        } else if (this.state === 'MODE_SELECT') {
            this.gameModes.forEach((mode, i) => {
                ctx.fillStyle = i === this.selected ? '#ffff00' : '#ffffff';
                ctx.fillText(mode.name, this.gameWidth/2, 250 + i*50);
                
                // Draw description in smaller font
                if (i === this.selected) {
                    ctx.font = '16px Arial';
                    ctx.fillStyle = '#cccccc';
                    ctx.fillText(mode.description, this.gameWidth/2, 270 + i*50);
                    ctx.font = '24px Arial';
                }
            });
        }

        // Instructions
        ctx.font = '16px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Use arrow keys to select', this.gameWidth/2, this.gameHeight - 100);
        ctx.fillText('Press Enter to confirm', this.gameWidth/2, this.gameHeight - 80);
    }

    handleInput(key) {
        const options = this.state === 'MAIN' ? this.mainOptions : this.gameModes;
        
        switch(key) {
            case 'ArrowUp':
                this.selected = (this.selected - 1 + options.length) % options.length;
                break;
            case 'ArrowDown':
                this.selected = (this.selected + 1) % options.length;
                break;
            case 'Enter':
                if (this.state === 'MAIN') {
                    if (this.mainOptions[this.selected] === 'Play Game') {
                        this.state = 'MODE_SELECT';
                        this.selected = 0;
                        return null;
                    }
                    return this.mainOptions[this.selected];
                } else {
                    return this.gameModes[this.selected];
                }
            case 'Escape':
                if (this.state === 'MODE_SELECT') {
                    this.state = 'MAIN';
                    this.selected = 0;
                }
                break;
        }
        return null;
    }
}

class HighScoreSystem {
    constructor() {
        this.scores = this.loadScores();
    }

    loadScores() {
        const scores = localStorage.getItem('snakeHighScores');
        return scores ? JSON.parse(scores) : [];
    }

    saveScores() {
        localStorage.setItem('snakeHighScores', JSON.stringify(this.scores));
    }

    addScore(score) {
        this.scores.push(score);
        this.scores.sort((a, b) => b - a);
        this.scores = this.scores.slice(0, 5); // Keep top 5
        this.saveScores();
    }

    draw(ctx, gameWidth, gameHeight) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('High Scores', gameWidth/2, 100);

        ctx.font = '24px Arial';
        this.scores.forEach((score, i) => {
            ctx.fillText(`${i + 1}. ${score}`, gameWidth/2, 200 + i*40);
        });
    }
}

class Mongoose {
    constructor(gameWidth, gameHeight) {
        this.position = new Point(0, 0);
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.speed = 1.5; // Reduced speed
        this.tileSize = 20;
        this.image = document.createElement('canvas');
        this.image.width = this.tileSize;
        this.image.height = this.tileSize;
        const ctx = this.image.getContext('2d');
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(0, 0, this.tileSize, this.tileSize);
        this.lastDirectionChange = 0;
        this.directionChangeInterval = 1000; // Increased time between direction changes
        this.currentDirection = { x: 0, y: 0 };
        this.trailPoints = [];
        this.lastPosition = { ...this.position };
        this.scatterMode = true; // Start in scatter mode
        this.modeChangeTime = Date.now();
        this.modeDuration = 7000; // Duration of each mode in milliseconds
        this.randomizePosition();
    }

    randomizePosition() {
        const corners = [
            {x: 0, y: 0},
            {x: this.gameWidth - this.tileSize, y: 0},
            {x: 0, y: this.gameHeight - this.tileSize},
            {x: this.gameWidth - this.tileSize, y: this.gameHeight - this.tileSize}
        ];
        const corner = corners[Math.floor(Math.random() * corners.length)];
        this.position.x = corner.x;
        this.position.y = corner.y;
    }

    move_towards(snakeHead) {
        const now = Date.now();

        // Switch between scatter and chase modes
        if (now - this.modeChangeTime > this.modeDuration) {
            this.scatterMode = !this.scatterMode;
            this.modeChangeTime = now;
            this.directionChangeInterval = this.scatterMode ? 1000 : 1500;
        }

        // Update direction periodically
        if (now - this.lastDirectionChange > this.directionChangeInterval) {
            this.lastDirectionChange = now;
            
            let targetX, targetY;
            
            if (this.scatterMode) {
                // In scatter mode, move towards corners
                const corner = {
                    x: Math.random() < 0.5 ? 0 : this.gameWidth,
                    y: Math.random() < 0.5 ? 0 : this.gameHeight
                };
                targetX = corner.x;
                targetY = corner.y;
            } else {
                // In chase mode, move towards snake but less aggressively
                if (Math.random() < 0.7) { // 70% chance to chase
                    targetX = snakeHead.x;
                    targetY = snakeHead.y;
                } else {
                    // Sometimes move randomly even in chase mode
                    targetX = this.position.x + (Math.random() - 0.5) * 200;
                    targetY = this.position.y + (Math.random() - 0.5) * 200;
                }
            }

            // Determine primary direction (horizontal or vertical)
            const dx = targetX - this.position.x;
            const dy = targetY - this.position.y;
            
            // Choose either horizontal or vertical movement, not both
            if (Math.abs(dx) > Math.abs(dy)) {
                this.currentDirection = {
                    x: dx > 0 ? this.speed : -this.speed,
                    y: 0
                };
            } else {
                this.currentDirection = {
                    x: 0,
                    y: dy > 0 ? this.speed : -this.speed
                };
            }
        }

        // Move in the current direction
        this.position.x += this.currentDirection.x;
        this.position.y += this.currentDirection.y;

        // Keep mongoose within bounds
        this.position.x = Math.max(0, Math.min(this.gameWidth - this.tileSize, this.position.x));
        this.position.y = Math.max(0, Math.min(this.gameHeight - this.tileSize, this.position.y));
    }

    draw(ctx) {
        ctx.save();
        
        // Draw motion trail
        this.trailPoints.forEach((point, index) => {
            const alpha = (this.trailPoints.length - index) / this.trailPoints.length;
            ctx.fillStyle = this.scatterMode ? 
                `rgba(100, 149, 237, ${alpha * 0.3})` : // Blue in scatter mode
                `rgba(139, 69, 19, ${alpha * 0.3})`; // Brown in chase mode
            ctx.beginPath();
            ctx.arc(
                point.x + this.tileSize/2,
                point.y + this.tileSize/2,
                this.tileSize/2 * alpha,
                0,
                Math.PI * 2
            );
            ctx.fill();
        });

        // Draw mongoose with mode-dependent glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.scatterMode ? '#4169E1' : '#ff4444';
        ctx.fillStyle = this.scatterMode ? '#4169E1' : '#8B4513';
        ctx.fillRect(this.position.x, this.position.y, this.tileSize, this.tileSize);

        // Update trail
        if (Math.abs(this.position.x - this.lastPosition.x) > 0.1 ||
            Math.abs(this.position.y - this.lastPosition.y) > 0.1) {
            this.trailPoints.unshift({ ...this.position });
            if (this.trailPoints.length > 5) {
                this.trailPoints.pop();
            }
            this.lastPosition = { ...this.position };
        }

        ctx.restore();
    }
}

// Add Obstacle class after Point class
class Obstacle {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    draw(ctx) {
        ctx.fillStyle = '#666666';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

// Add PortalEffect class after Obstacle class
class PortalEffect {
    constructor(gameWidth, gameHeight) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.particleSize = 2;
        this.particles = [];
        this.generateParticles();
    }

    generateParticles() {
        // Generate particles for all four edges
        // Top and bottom edges
        for (let x = 0; x < this.gameWidth; x += 10) {
            this.particles.push({
                x: x,
                y: 0,
                baseY: 0,
                speed: 1 + Math.random(),
                amplitude: 5 + Math.random() * 5
            });
            this.particles.push({
                x: x,
                y: this.gameHeight,
                baseY: this.gameHeight,
                speed: 1 + Math.random(),
                amplitude: 5 + Math.random() * 5
            });
        }
        // Left and right edges
        for (let y = 0; y < this.gameHeight; y += 10) {
            this.particles.push({
                x: 0,
                baseX: 0,
                y: y,
                speed: 1 + Math.random(),
                amplitude: 5 + Math.random() * 5
            });
            this.particles.push({
                x: this.gameWidth,
                baseX: this.gameWidth,
                y: y,
                speed: 1 + Math.random(),
                amplitude: 5 + Math.random() * 5
            });
        }
    }

    update() {
        const time = Date.now() / 1000;
        this.particles.forEach(particle => {
            if (particle.baseX !== undefined) {
                // Horizontal edges
                particle.x = particle.baseX + Math.sin(time * particle.speed) * particle.amplitude;
            } else {
                // Vertical edges
                particle.y = particle.baseY + Math.sin(time * particle.speed) * particle.amplitude;
            }
        });
    }

    draw(ctx) {
        ctx.save();
        
        // Create gradient for particles
        const gradient = ctx.createLinearGradient(0, 0, this.gameWidth, this.gameHeight);
        gradient.addColorStop(0, '#4400ff');
        gradient.addColorStop(0.5, '#0088ff');
        gradient.addColorStop(1, '#00ffff');

        // Draw particles with glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';
        ctx.fillStyle = gradient;

        this.particles.forEach(particle => {
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, this.particleSize, 0, Math.PI * 2);
            ctx.fill();
        });

        // Draw edge lines with glow
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.rect(0, 0, this.gameWidth, this.gameHeight);
        ctx.stroke();

        ctx.restore();
    }
}

// Add Wall class after PortalEffect class
class Wall {
    constructor(gameWidth, gameHeight) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.thickness = 10;
        this.color = '#444444';
        this.glowColor = '#666666';
    }

    draw(ctx) {
        ctx.save();
        
        const time = Date.now() / 1000;
        const glowIntensity = (Math.sin(time) + 1) / 2;
        
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 5 + glowIntensity * 5;
        ctx.fillStyle = this.color;

        // Draw walls with pulsing effect
        ['top', 'bottom', 'left', 'right'].forEach((side, index) => {
            const phase = time + index * Math.PI / 2;
            const glow = 5 + Math.sin(phase) * 3;
            ctx.shadowBlur = glow;
            
            switch(side) {
                case 'top':
                    ctx.fillRect(0, 0, this.gameWidth, this.thickness);
                    break;
                case 'bottom':
                    ctx.fillRect(0, this.gameHeight - this.thickness, this.gameWidth, this.thickness);
                    break;
                case 'left':
                    ctx.fillRect(0, 0, this.thickness, this.gameHeight);
                    break;
                case 'right':
                    ctx.fillRect(this.gameWidth - this.thickness, 0, this.thickness, this.gameHeight);
                    break;
            }
        });

        // Enhanced metallic effect
        const gradient = ctx.createLinearGradient(0, 0, this.gameWidth, this.gameHeight);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${0.1 + glowIntensity * 0.1})`);
        gradient.addColorStop(0.5, `rgba(128, 128, 128, ${0.1 + glowIntensity * 0.05})`);
        gradient.addColorStop(1, `rgba(0, 0, 0, ${0.1 + glowIntensity * 0.1})`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.gameWidth, this.thickness);
        ctx.fillRect(0, this.gameHeight - this.thickness, this.gameWidth, this.thickness);
        ctx.fillRect(0, 0, this.thickness, this.gameHeight);
        ctx.fillRect(this.gameWidth - this.thickness, 0, this.thickness, this.gameHeight);

        ctx.restore();
    }
}

// Add game over animation properties to global variables
let gameOverAnimation = {
    alpha: 0,
    scale: 0.1,
    rotation: 0,
    maxRotation: Math.PI / 12  // Limit rotation to 15 degrees
};

// Add PowerUp class
class PowerUp {
    constructor(gameWidth, gameHeight) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.tileSize = 20;
        this.position = new Point(0, 0);
        this.type = this.randomType();
        this.active = false;
        this.duration = 5000; // 5 seconds
        this.startTime = 0;
        this.glowColor = this.getGlowColor();
    }

    randomType() {
        const types = ['speed', 'shield', 'slow', 'double'];
        return types[Math.floor(Math.random() * types.length)];
    }

    getGlowColor() {
        switch(this.type) {
            case 'speed': return '#ffff00'; // Yellow
            case 'shield': return '#00ff00'; // Green
            case 'slow': return '#0000ff'; // Blue
            case 'double': return '#ff00ff'; // Purple
            default: return '#ffffff';
        }
    }

    randomizePosition() {
        this.position.x = Math.floor(Math.random() * (this.gameWidth/this.tileSize)) * this.tileSize;
        this.position.y = Math.floor(Math.random() * (this.gameHeight/this.tileSize)) * this.tileSize;
        this.type = this.randomType();
        this.glowColor = this.getGlowColor();
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.glowColor;
        ctx.fillStyle = this.glowColor;
        
        // Draw power-up symbol based on type
        switch(this.type) {
            case 'speed':
                this.drawLightning(ctx);
                break;
            case 'shield':
                this.drawShield(ctx);
                break;
            case 'slow':
                this.drawClock(ctx);
                break;
            case 'double':
                this.drawStar(ctx);
                break;
        }
        ctx.restore();
    }

    // Add drawing methods for each power-up type...
}

// Add Level class
class Level {
    constructor(number) {
        this.number = number;
        this.requiredScore = number * 100;
        this.obstacles = [];
        this.generateLevel();
    }

    generateLevel() {
        // Generate level-specific obstacles and challenges
        switch(this.number) {
            case 1:
                // Basic level
                break;
            case 2:
                // Add moving obstacles
                break;
            case 3:
                // Add multiple mongooses
                break;
            // ... more levels
        }
    }
}

// Add level transition animation
function showLevelTransition(ctx, level) {
    // Animate level number
    // Show level objectives
    // Display bonus points
}

// Add ParticleSystem class
class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    emit(x, y, color, count) {
        for(let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    update() {
        this.particles = this.particles.filter(p => p.life > 0);
        this.particles.forEach(p => p.update());
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.life = 1;
        this.velocity = {
            x: (Math.random() - 0.5) * 5,
            y: (Math.random() - 0.5) * 5
        };
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.life -= 0.02;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life;
        ctx.fillRect(this.x, this.y, 2, 2);
    }
}

// Add SoundManager class
class SoundManager {
    constructor() {
        this.sounds = {
            eat: new Audio('eat.wav'),
            die: new Audio('die.wav'),
            powerup: new Audio('powerup.wav'),
            levelUp: new Audio('levelup.wav')
        };
        this.music = new Audio('background.mp3');
        this.music.loop = true;
    }

    play(soundName) {
        this.sounds[soundName].currentTime = 0;
        this.sounds[soundName].play();
    }

    startMusic() {
        this.music.play();
    }

    stopMusic() {
        this.music.pause();
        this.music.currentTime = 0;
    }
}

// Game initialization and main loop
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let gameState = 'MENU';
let snake, food, menu, highScores, score, mongoose, currentGameMode, obstacles, portalEffect, wall;

function checkCanvas() {
    if (!canvas) {
        console.error('Canvas element not found!');
        return false;
    }
    if (!ctx) {
        console.error('Canvas context not found!');
        return false;
    }
    return true;
}

function init() {
    if (!checkCanvas()) return;
    
    snake = new Snake(canvas.width, canvas.height);
    food = new Food(canvas.width, canvas.height);
    score = 0;
    obstacles = [];
    
    // Initialize game mode specific elements
    switch(currentGameMode) {
        case 'Unbounded':
            portalEffect = new PortalEffect(canvas.width, canvas.height);
            mongoose = null;
            wall = null;
            break;
        case 'Prison Yard':
            portalEffect = null;
            mongoose = null;
            wall = new Wall(canvas.width, canvas.height);
            break;
        case 'Obstacle Course':
            portalEffect = null;
            generateObstacles();
            mongoose = null;
            wall = new Wall(canvas.width, canvas.height);
            break;
        case 'Mongoose Infested':
            portalEffect = null;
            mongoose = new Mongoose(canvas.width, canvas.height);
            wall = new Wall(canvas.width, canvas.height);
            break;
        default:
            portalEffect = null;
            mongoose = null;
            wall = null;
            break;
    }
    
    menu = new GameMenu(canvas.width, canvas.height);
    highScores = new HighScoreSystem();
    console.log('Game initialized with mode:', currentGameMode);
}

// Add function to generate obstacles
function generateObstacles() {
    // Create some random obstacles
    const numObstacles = 5;
    for (let i = 0; i < numObstacles; i++) {
        const width = 40;
        const height = 40;
        const x = Math.floor(Math.random() * (canvas.width - width) / 20) * 20;
        const y = Math.floor(Math.random() * (canvas.height - height) / 20) * 20;
        
        // Ensure obstacles don't spawn on snake's starting position
        if (Math.abs(x - canvas.width/2) > 60 || Math.abs(y - canvas.height/2) > 60) {
            obstacles.push(new Obstacle(x, y, width, height));
        }
    }
}

function gameLoop() {
    if (!checkCanvas()) return;
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    switch(gameState) {
        case 'MENU':
            menu.draw(ctx);
            break;

        case 'PLAYING':
            snake.move();
            food.update();
            
            if (currentGameMode === 'Unbounded' && portalEffect) {
                portalEffect.update();
            }

            // Update mongoose in Mongoose Infested mode
            if (currentGameMode === 'Mongoose Infested' && mongoose) {
                mongoose.move_towards(snake.getHeadPosition());
            }

            if (snake.getHeadPosition().x === food.position.x && 
                snake.getHeadPosition().y === food.position.y) {
                snake.length++;
                score += 10;
                food.randomizePosition();
                
                // Ensure food doesn't spawn in obstacles
                while (currentGameMode === 'Obstacle Course' && 
                       obstacles.some(obstacle => 
                           food.position.x >= obstacle.x && 
                           food.position.x < obstacle.x + obstacle.width &&
                           food.position.y >= obstacle.y && 
                           food.position.y < obstacle.y + obstacle.height)) {
                    food.randomizePosition();
                }
            }

            // Check for collisions based on game mode
            const collision = snake.checkCollision();
            const bounds = currentGameMode !== 'Unbounded' && snake.checkBounds();
            
            if (collision || bounds) {
                gameState = 'GAME_OVER';
                gameOverAnimation = {
                    alpha: 0,
                    scale: 0.1,
                    rotation: 0,
                    maxRotation: Math.PI / 12  // Limit rotation to 15 degrees
                };
                highScores.addScore(score);
            }

            // Draw game elements
            if (currentGameMode === 'Unbounded' && portalEffect) {
                portalEffect.draw(ctx);
            } else if (wall) {
                wall.draw(ctx);
            }
            
            if (currentGameMode === 'Obstacle Course') {
                obstacles.forEach(obstacle => obstacle.draw(ctx));
            }
            
            snake.draw(ctx);
            food.draw(ctx);
            
            if (currentGameMode === 'Mongoose Infested' && mongoose) {
                mongoose.draw(ctx);
            }

            // Draw score
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`Score: ${score}`, 10, 30);
            break;

        case 'HIGH_SCORES':
            highScores.draw(ctx, canvas.width, canvas.height);
            break;

        case 'GAME_OVER':
            // Continue drawing the game state in the background
            if (wall && currentGameMode !== 'Unbounded') {
                wall.draw(ctx);
            }
            if (currentGameMode === 'Obstacle Course') {
                obstacles.forEach(obstacle => obstacle.draw(ctx));
            }
            snake.draw(ctx);
            food.draw(ctx);
            if (currentGameMode === 'Mongoose Infested' && mongoose) {
                mongoose.draw(ctx);
            }

            // Animate game over screen with smoother transitions
            gameOverAnimation.alpha = Math.min(gameOverAnimation.alpha + 0.03, 1);
            gameOverAnimation.scale = Math.min(gameOverAnimation.scale + 0.04, 1);
            
            // Smooth rotation with damping
            const targetRotation = Math.sin(Date.now() / 500) * gameOverAnimation.maxRotation;
            gameOverAnimation.rotation += (targetRotation - gameOverAnimation.rotation) * 0.1;

            // Apply semi-transparent overlay
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw game over screen
            ctx.save();
            ctx.globalAlpha = gameOverAnimation.alpha;
            ctx.translate(canvas.width/2, canvas.height/2);
            ctx.rotate(gameOverAnimation.rotation);
            ctx.scale(gameOverAnimation.scale, gameOverAnimation.scale);
            
            // Draw game over text with shadow for better visibility
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            // Draw game over text
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Game Over!', 0, -40);
            
            // Draw score
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px Arial';
            ctx.fillText(`Score: ${score}`, 0, 10);
            
            // Draw restart instructions
            ctx.font = '24px Arial';
            ctx.fillText('Press Enter to restart', 0, 50);
            ctx.font = '20px Arial';
            ctx.fillText('Press Escape for menu', 0, 80);
            
            ctx.restore();
            break;
    }

    requestAnimationFrame(gameLoop);
}

// Event listeners
document.addEventListener('keydown', (event) => {
    switch(gameState) {
        case 'MENU':
            const selection = menu.handleInput(event.key);
            if (selection instanceof GameMode) {
                gameState = 'PLAYING';
                currentGameMode = selection.name;
                init();
            } else if (selection === 'High Scores') {
                gameState = 'HIGH_SCORES';
            } else if (selection === 'Quit') {
                // Handle quit
            }
            break;

        case 'PLAYING':
            snake.handleKeys(event.key);
            break;

        case 'HIGH_SCORES':
            if (event.key === 'Escape') {
                gameState = 'MENU';
            }
            break;

        case 'GAME_OVER':
            if (event.key === 'Enter') {
                gameState = 'PLAYING';
                init(); // Restart the game with the same mode
            } else if (event.key === 'Escape') {
                gameState = 'MENU';
            }
            break;
    }
});

// Start the game
init();
gameLoop(); 