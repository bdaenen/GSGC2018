(function() {
    'use strict';
    var DEBUG = true;
    var canvas = d.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var bgCanvas = d.createElement('canvas');
    var bgCtx = bgCanvas.getContext('2d');
    var textureCanvas  = d.createElement('canvas');
    var textureCtx = textureCanvas.getContext('2d');
    var noAlphaCanvas = d.createElement('canvas');
    var noAlphaCtx = noAlphaCanvas.getContext('2d');

    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    bgCtx.imageSmoothingEnabled = false;
    bgCtx.webkitImageSmoothingEnabled = false;
    textureCtx.imageSmoothingEnabled = false;
    textureCtx.webkitImageSmoothingEnabled = false;
    noAlphaCtx.imageSmoothingEnabled = false;
    noAlphaCtx.webkitImageSmoothingEnabled = false;
    window.onload = function(){
        noAlphaCtx.filter = 'url(#remove-alpha)';
        //ctx.filter = 'url(#remove-alpha)';
    };

    var currentLevel = null;
    var jumpCooldown = 0.2;
    var timeSinceJump = 0.2;
    var bgPattern = null;
    var playerAnimationTimerValue = 100;
    var playerAnimationTimer = playerAnimationTimerValue;
    var mapRows = 4;
    var mapColumns = 7;
    var buttonPrompt = null;
    var buttonPromptUpdate = null;
    var markedSprites = [];

    canvas.width = 360;
    canvas.height = 400;
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    noAlphaCanvas.width = canvas.width;
    noAlphaCanvas.height = canvas.height;

    w.tileWidth = 10;
    w.tileHeight = 20;

    var tileWidth = w.tileWidth;
    var tileHeight = w.tileHeight;

    textureCanvas.width = tileWidth;
    textureCanvas.height = tileHeight;

    //var intro = true;
    d.getElementById('img_bg').onload = function(){
        bgPattern = ctx.createPattern(d.getElementById('img_bg'), 'repeat');
        bgCtx.fillStyle = bgPattern;
        bgCtx.rect(0, 0, canvas.width, canvas.height);
        bgCtx.fill();
    };
    var worldCoord = {
        _x: 2,
        _y: 0,
        prevX: 2,
        prevY: 0,
        get x() {
            return this._x;
        },
        set x(value) {
            this.prevY = this._y;
            this.prevX = this._x;
            this._x = value;
        },
        get y() {
            return this._y;
        },
        set y(value) {
            this.prevX = this._x;
            this.prevY = this._y;
            this._y = value;
        }
    };

    var scale = {
        x: w.innerWidth / canvas.width,
        y: w.innerHeight / canvas.height
    };

    var pointer = {
        x: 0,
        y: 0
    };

    var bulletPool = kontra.pool({
        create: kontra.sprite,
        maxSize: 1
    });

    var tilePool = kontra.pool({
        create: kontra.sprite,
        maxSize: w.level3_0.width * w.level3_0.height
    });

    $('.c').appendChild(canvas);

    kontra.init();

    var minimap = kontra.sprite({
       x: 290,
       y: 32,
       color: 'rgba(66, 66, 66, 1)',
        width: 51,
        height: 62
    });

    var minimap_levels = [];

    var x;
    var y;
    for (y = 0; y < mapRows; y++) {
        var cols = mapColumns - y;

        for (x = y; x < cols; x++) {
            minimap_levels[y] = minimap_levels[y] || [];
            minimap_levels[y][x] = kontra.sprite({
                x: minimap.x+2 + (x*7+x-4),
                y: minimap.y+minimap.height-20 - (y*18+y),
                width: 7,
                height: 18,
                color: 'rgba(44, 44, 44, 1)',
                properties: {
                    visited: false,
                    originalColor: 'rgba(44, 44, 44, 1)',
                    currentLevel: false
                },
                render: function(){
                    if (this.properties.currentLevel) {
                        this.color = '#1d86df'
                    }
                    else if (this.properties.visited) {
                        this.color = '#dfab1d'
                    }
                    this._draw();
                }
            });
        }
    }

    var player = kontra.sprite({
        x: 100,
        y: 120,
        image: d.getElementById('img_player'),
        //color: 'red',
        //width: tileWidth,
        //height: tileHeight,
        dx: 0,
        properties: {
            mirror: false,
            grounded: false,
            canLink: DEBUG,
            canPush: DEBUG,
            canSprint: DEBUG
        },
        render: function(){
            var deltaY = 0;
            if (this.properties.grounded) {
                if (playerAnimationTimer <= 0 && playerAnimationTimer >= -playerAnimationTimerValue) {
                    deltaY = -2
                }
                else if (playerAnimationTimer <= -playerAnimationTimerValue) {
                    deltaY = 0;
                    playerAnimationTimer = playerAnimationTimerValue;
                }
            }
            this.context.save();
            this.context.translate(this.x, this.y);
            if (this.properties.mirror) {
                this.context.scale(-1, 1);
            }
            else {
                this.context.scale(1, 1);
            }
            this.context.drawImage(this.image, this.properties.mirror ? -7: 0, deltaY);
            this.context.restore();
        }
    });


    var bullet = null;

    d.body.addEventListener('contextmenu', function(e){
        e.preventDefault();
    });

    kontra.pointer.onDown(function(e) {
        var angle = Math.atan2(pointer.y - (player.y+player.height/2), pointer.x - (player.x+player.width/2));
        var dist = 5;

        if (e.button !== 0 && player.properties.canLink) {
            if (markedSprites.length < 2) {
                bulletPool.get({
                    x: player.x,
                    y: player.y,
                    dx: Math.cos(angle)*dist,
                    dy: Math.sin(angle)*dist,
                    image: d.getElementById('img_shot'),
                    ttl: 60,
                    properties: {
                        type: 1
                    },
                    render: function() {
                        var x = this.x;
                        var y = this.y;
                        this.x = Math.round(this.x);
                        this.y = Math.round(this.y);
                        // Draw on rounded pixels to avoid anti-aliasing introducing more colors.
                        this.draw();
                        this.x = x;
                        this.y = y;
                    }
                });
            }
        }
        else if (e.button === 0 && player.properties.canPush) {
            bulletPool.get({
                x: player.x,
                y: player.y,
                dx: Math.cos(angle)*dist,
                dy: Math.sin(angle)*dist,
                image: d.getElementById('img_shot2'),
                ttl: 60,
                properties: {
                    type: 2
                },
                render: function() {
                    var x = this.x;
                    var y = this.y;
                    this.x = Math.round(this.x);
                    this.y = Math.round(this.y);
                    // Draw on rounded pixels to avoid anti-aliasing introducing more colors.
                    this.draw();
                    this.x = x;
                    this.y = y;
                }
            });
        }
    });

    var loop = kontra.gameLoop({
        update: function(dt) {
            updatePointer(dt);
            updatePlayer(dt);
            updateBullets(dt);

            updateLevel(dt);
            updateLinkedSprites(dt);
            minimap.update();
            buttonPrompt && buttonPromptUpdate && buttonPromptUpdate();
        },
        render: function() {
            /*if (intro) {
                return renderIntro();
            }*/
            // BG
            ctx.drawImage(bgCanvas, 0, 0);
            tilePool.render();
            renderMarkedSprites();
            player.render();
            bulletPool.render();
            for (y = 0; y < mapRows; y++) {
                var cols = mapColumns - y;
                if (cols === y) {
                    cols++;
                }
                for (x = y; x < cols; x++) {
                    minimap_levels[y][x].render();
                }
            }

            renderButtonPrompt();

            //postProcess();
        }
    });

    loadLevel();

    loop.start();


    function renderIntro() {
        ctx.strokeText('Archeologists have uncovered the pyramid you were enjoying your ')
    }

    /**
     * Renders the marked sprites with a green border and a line connecting them.
     */
    function renderMarkedSprites() {
        if (markedSprites.length) {
            for (y=0; y < markedSprites.length; y++) {
                textureCtx.save();
                textureCtx.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
                textureCtx.fillStyle = '#04dc27';
                textureCtx.fillRect(0, 0, tileWidth, tileHeight);
                textureCtx.drawImage(markedSprites[y].image, 1, 1, tileWidth-2, tileHeight-2, 1, 1, tileWidth-2, tileHeight-2);
                textureCtx.restore();
                ctx.drawImage(textureCanvas, markedSprites[y].x, markedSprites[y].y);
            }
        }

        if (markedSprites.length === 2) {
            noAlphaCtx.clearRect(0, 0, noAlphaCanvas.width, noAlphaCanvas.height);
            noAlphaCtx.beginPath();
            noAlphaCtx.strokeStyle = 'rgba(4, 220, 39, 1)';
            noAlphaCtx.lineWidth = 2;
            noAlphaCtx.moveTo(
                Math.round(markedSprites[0].x + tileWidth/2),
                Math.round(markedSprites[0].y + tileHeight/2)
            );
            noAlphaCtx.lineTo(
                Math.round(markedSprites[1].x + tileWidth/2),
                Math.round(markedSprites[1].y + tileHeight/2)
            );
            noAlphaCtx.stroke();
            noAlphaCtx.stroke();


            ctx.drawImage(noAlphaCanvas, 0, 0, noAlphaCanvas.width, noAlphaCanvas.height);
        }
    }

    /*canvas.onclick = function() {
      if (!document.pointerLockElement) {
        canvas.requestPointerLock();
      }
    };*/

    /**
     * @param dt
     */
    function updatePlayer(dt) {
        player.update();
        if (kontra.keys.pressed('left') || kontra.keys.pressed('q') || kontra.keys.pressed('a')) {
            playerAnimationTimer -= dt*1000;
            player.properties.mirror = true;
            if (player.properties.canSprint && kontra.keys.pressed('shift')) {
                player.x -= 2;
            }
            else {
                player.x -= 1;
            }
        }
        else if (kontra.keys.pressed('right') || kontra.keys.pressed('d')) {
            playerAnimationTimer -= dt*1000;
            player.properties.mirror = false;

            if (player.properties.canSprint && kontra.keys.pressed('shift')) {
                player.x += 2;
            }
            else {
                player.x += 1;
            }
        }

        updateGrounded(player);

        if (!player.properties.grounded) {
            player.acceleration.y = 0.3;
        }
        else {
            player.acceleration.y = 0;
        }

        if ((kontra.keys.pressed('up') || kontra.keys.pressed('z') || kontra.keys.pressed('w')) && timeSinceJump >= jumpCooldown && player.properties.grounded) {
            player.velocity.y = -6.5;
            timeSinceJump = 0;
        }
        else {
            timeSinceJump += dt;
        }

        if (kontra.keys.pressed('space')) {
            unlinkMarkedSprites();
        }

        if (kontra.keys.pressed('r')) {
            loadLevel(true);
        }

        if (player.x > currentLevel.width * tileWidth - (player.width/2)) {
            debugger;
            if (w['level' + (worldCoord.x+1) + '_' + worldCoord.y]) {
                worldCoord.x++;
                loadLevel();
            }
            else {
                player.x -= tileWidth;
            }
        }
        else if (player.x < (player.width/2)) {
            if (w['level' + (worldCoord.x-1) + '_' + worldCoord.y]) {
                worldCoord.x--;
                loadLevel();
            }
            else {
                player.x += tileWidth;
            }
        }
        else if (player.y < (player.height/2)) {
            if (w['level' + worldCoord.x + '_' + (worldCoord.y+1)]) {
                worldCoord.y++;
                loadLevel();
            }
            else {
                player.dy = 1;
                player.properties.grounded = false;
            }
        }
        else if (player.y > currentLevel.height * tileHeight - (player.width/2)) {
            if (w['level' + worldCoord.x + '_' + (worldCoord.y-1)]) {
                worldCoord.y--;
                loadLevel();
            }
            else {
                player.velocity.y = -6.5;
            }
        }

        player.x = Math.round(player.x);
        player.y = Math.round(player.y);
    }

    /**
     * @param dt
     */
    function updatePointer(dt) {
        pointer.x = kontra.pointer.x/scale.x;
        pointer.y = kontra.pointer.y/scale.y;
    }

    /**
     * @param dt
     */
    function updateBullets(dt) {
        bulletPool.update();
    }

    /**
     * @param dt
     */
    function updateLevel(dt) {
        var levelSprite;
        var bullet = bulletPool.getAliveObjects().length ? bulletPool.getAliveObjects()[0] : null;
        tilePool.update();

        var tiles = tilePool.getAliveObjects();

        for (var i = 0; i < tiles.length; i++) {
            levelSprite = tiles[i];
            if (levelSprite.y > currentLevel.height*tileHeight || levelSprite.x < -tileWidth || levelSprite.x > (currentLevel.width*tileWidth) || levelSprite.y < -tileHeight) {
                if (levelSprite.properties.marked) {
                    unlinkMarkedSprites();
                }
                levelSprite.ttl = 0;

                continue;
            }
            if (player.collidesWith(levelSprite)) {
                if (levelSprite.properties.collides) {
                    resolveCollision(player, levelSprite);
                    player.render();
                }
            }

            if (bullet && bullet.collidesWith(levelSprite)) {
                if (bullet.properties.type === 1) {
                    // Don't handle the same sprite twice
                    if (!markedSprites.length || markedSprites[0] !== levelSprite && levelSprite.properties.canLink) {
                        markedSprites.push(levelSprite);
                        levelSprite.properties.marked = 1;
                        levelSprite.properties.originalColor = levelSprite.color;
                        levelSprite.color = 'green';
                    }
                    // We got 2, link em up.
                    if (markedSprites.length > 1) {
                        linkMarkedSprites();
                    }
                }
                else if (bullet.properties.type === 2) {
                    if (levelSprite.properties.movable) {
                        levelSprite.dx = bullet.dx;
                        levelSprite.dy = bullet.dy;
                        levelSprite.ddx = -bullet.dx/10;
                        levelSprite.ddy = -bullet.dy/10;
                    }
                }
                if (levelSprite.properties.index <= 5) {
                    bulletPool.clear();
                    bullet = null;
                }
            }

            if (levelSprite.dx || levelSprite.dy) {
                if (Math.abs(levelSprite.dx) < 1) {
                    levelSprite.dx = 0;
                    levelSprite.ddx = 0;
                    levelSprite.x = Math.round(levelSprite.x);
                }
                if (Math.abs(levelSprite.dy) < 1) {
                    levelSprite.dy = 0;
                    levelSprite.ddy = 0;
                    levelSprite.y = Math.round(levelSprite.y)
                }
            }


            if (levelSprite.properties.destroys) {
                for (var j = 0; j < currentLevel.destructables.length; j++) {
                    var item = currentLevel.destructables[j];
                    if (!item.ttl) {
                        continue;
                    }
                    if (levelSprite.collidesWith(item)) {
                        if (item.properties.marked || levelSprite.properties.marked) {
                            unlinkMarkedSprites();
                        }
                        item.ttl = 0;
                        levelSprite.ttl = 0;
                        j = currentLevel.destructables.length;
                    }
                }
            }
        }
    }

    /**
     * @param sprite
     * @param penDepth
     */
    function separateX(sprite, penDepth) {
        while (penDepth) {
            if (penDepth > 0) {
                sprite.position.x--;
                penDepth--;
            }
            else if (penDepth < 0) {
                sprite.position.x++;
                penDepth++;
            }
        }
    }

    /**
     * @param sprite
     * @param penDepth
     */
    function separateY(sprite, penDepth) {
        while (penDepth) {
            if (penDepth > 0) {
                sprite.position.y--;
                penDepth--;
            }
            else if (penDepth < 0) {
                sprite.position.y++;
                penDepth++;
            }
        }
    }

    /**
     * @param sprite
     * @param wall
     */
    function resolveCollision(sprite, wall) {
        var xPen = 0;
        var yPen = 0;

        sprite.velocity.x = 0;
        sprite.velocity.y = 0;

        var spriteEdges = {
            top: sprite.position.y,
            right: sprite.position.x + sprite.width,
            bottom: sprite.position.y + sprite.height,
            left: sprite.position.x
        };
        var wallEdges = {
            top: wall.position.y,
            right: wall.position.x + wall.width,
            bottom: wall.position.y + wall.height,
            left: wall.position.x
        };

        var distanceRight = Math.abs(spriteEdges.right - wallEdges.left);
        var distanceLeft = Math.abs(spriteEdges.left - wallEdges.right);
        var distanceTop = Math.abs(spriteEdges.top - wallEdges.bottom);
        var distanceBottom = Math.abs(spriteEdges.bottom - wallEdges.top);
        var minDist = Math.min(distanceBottom, distanceLeft, distanceTop, distanceRight);

        if (spriteEdges.top > wallEdges.top) {
            yPen = -Math.ceil(wallEdges.bottom - spriteEdges.top);
        }
        else if (spriteEdges.top < wallEdges.top) {
            yPen = Math.ceil(spriteEdges.bottom - wallEdges.top);
        }

        if (spriteEdges.left > wallEdges.left) {
            xPen = -Math.ceil(wallEdges.right - spriteEdges.left);
        }
        else if (spriteEdges.left < wallEdges.left) {
            xPen = Math.ceil(spriteEdges.right - wallEdges.left);
        }

        if (minDist === distanceBottom || minDist === distanceTop) {
            separateY(sprite, yPen);
            if (sprite.collidesWith(wall)) {
                separateX(sprite, xPen);
            }
            if (minDist === distanceBottom) {
                timeSinceJump = jumpCooldown;
            }
        }
        else {
            separateX(sprite, xPen);
            if (sprite.collidesWith(wall)) {
                separateY(sprite, yPen);
            }
        }
    }

    /**
     *
     */
    function loadLevel(previousPosition) {
        var transitionPosition;
        var levelIndex = worldCoord.x + '_' + worldCoord.y;

        if (!previousPosition) {
            if (currentLevel) {
                transitionPosition = findTransitionPosition(currentLevel, w['level'+levelIndex]);
            }
            else {
                transitionPosition = {
                    x: 80,
                    //++y: 0
                    y: 57
                };
            }
        }
        else {
            transitionPosition = JSON.parse(localStorage.getItem('previousPosition'));
            player.properties = JSON.parse(localStorage.getItem('previousSkills'));
            removeButtonPrompt();
        }
        localStorage.setItem('previousSkills', JSON.stringify(player.properties));
        localStorage.setItem('previousPosition', JSON.stringify(transitionPosition));
        currentLevel = w['level' + levelIndex];
        initLevel(currentLevel);
        player.x = transitionPosition.x;
        player.y = transitionPosition.y;

        minimap_levels[worldCoord.y][worldCoord.x].properties.visited = true;
        minimap_levels[worldCoord.y][worldCoord.x].properties.currentLevel = true;
        minimap_levels[worldCoord.prevY][worldCoord.prevX].properties.currentLevel = false;
        // Spawn player at proper position in level. This can be found by looking for the previous level's index as a negative "tile" index.
    }

    /**
     * @param level
     */
    function initLevel(level) {
        if (level.destructables) {
            level.destructables = [];
        }

        unlinkMarkedSprites();
        tilePool.clear();
        for (var i = 0; i < level.map.length; i++) {
            if (level.map[i] === 1) {
                tilePool.get({
                    x: tileWidth*(i%level.width),
                    y: tileHeight*Math.floor(i/level.width),
                    //color: 'midnightblue',
                    image: d.getElementById('img_wall'),
                    //width: tileWidth,
                    //height: tileHeight,
                    dx: 0,
                    ttl: Infinity,
                    properties: {
                        index: level.map[i],
                        collides: true,
                        movable: true,
                        destroys: true,
                        canLink: true
                    }
                });
            }
            else if (level.map[i] === 2) {
                tilePool.get({
                    x: tileWidth*(i%level.width),
                    y: tileHeight*Math.floor(i/level.width),
                    //color: 'midnightblue',
                    image: d.getElementById('img_wall_hard'),
                    //width: tileWidth,
                    //height: tileHeight,
                    dx: 0,
                    ttl: Infinity,
                    properties: {
                        index: level.map[i],
                        collides: true,
                        movable: false,
                        destroys: false,
                        canLink: true
                    }
                });
            }
            else if (level.map[i] === 3) {
                currentLevel.destructables.push(tilePool.get({
                    x: tileWidth*(i%level.width),
                    y: tileHeight*Math.floor(i/level.width),
                    //color: 'midnightblue',
                    image: d.getElementById('img_destruct'),
                    //width: tileWidth,
                    //height: tileHeight,
                    dx: 0,
                    ttl: Infinity,
                    properties: {
                        index: level.map[i],
                        collides: true,
                        movable: false,
                        destroys: false,
                        canLink: true
                    }
                }));
            }
            else if (level.map[i] === 4) {
                currentLevel.destructables.push(tilePool.get({
                    x: tileWidth*(i%level.width),
                    y: tileHeight*Math.floor(i/level.width),
                    //color: 'midnightblue',
                    image: d.getElementById('img_spike'),
                    //width: tileWidth,
                    //height: tileHeight,
                    dx: 0,
                    ttl: Infinity,
                    properties: {
                        index: level.map[i],
                        collides: false,
                        movable: false,
                        destroys: false,
                        canLink: false
                    },
                    update: function() {
                        if (player.collidesWith(this) && (player.y > this.y)) {
                            loadLevel(true);
                        }
                    }
                }));
            }
            else if (level.map[i] === 9 && !player.properties.canPush) {
                tilePool.get({
                    x: tileWidth*(i%level.width),
                    y: tileHeight*Math.floor(i/level.width),
                    //color: 'midnightblue',
                    image: d.getElementById('img_shot2'),
                    //width: tileWidth,
                    //height: tileHeight,
                    dx: 0,
                    ttl: Infinity,
                    update: function(){
                        if (player.collidesWith(this)) {
                            this.ttl = 0;
                            player.properties.canPush = true;
                            setButtonPrompt('click', function(){
                                if (kontra.pointer.pressed('left')) {
                                    removeButtonPrompt();
                                }
                            })
                        }
                    },
                    properties: {
                        index: level.map[i],
                        collides: false,
                        movable: false,
                        destroys: false
                    }
                });
            }
            else if (level.map[i] === 10 && !player.properties.canLink) {
                tilePool.get({
                    x: tileWidth*(i%level.width),
                    y: tileHeight*Math.floor(i/level.width),
                    //color: 'midnightblue',
                    image: d.getElementById('img_shot'),
                    //width: tileWidth,
                    //height: tileHeight,
                    dx: 0,
                    ttl: Infinity,
                    update: function(){
                        if (player.collidesWith(this)) {
                            this.ttl = 0;
                            player.properties.canLink = true;
                            setButtonPrompt('rightclick', function(){
                                if (kontra.pointer.pressed('right')) {
                                    removeButtonPrompt();
                                }
                            })
                        }
                    },
                    properties: {
                        index: level.map[i],
                        collides: false,
                        movable: false,
                        destroys: false
                    }
                });
            }
        }
    }

    /**
     * @param sprite
     */
    function updateGrounded(sprite) {
        var fakeSprite = {
            x: sprite.x,
            y: sprite.y + 1,
            width: sprite.width,
            height: sprite.height
        };

        var tiles = tilePool.getAliveObjects();
        var tile;
        sprite.properties.grounded = false;
        sprite.properties.groundedTile = null;

        for (var i = 0; i < tiles.length; i++) {
            tile = tiles[i];
            if (!tile.properties.collides || !tile.collidesWith(fakeSprite)) {
                continue;
            }
            sprite.properties.grounded = true;
            sprite.properties.groundedTile = tile;
            break;
        }
    }

    /**
     * @param levelFrom
     * @param levelTo
     */
    function findTransitionPosition(levelFrom, levelTo) {
        var position = {
            x: null,
            y: null
        };

        if (worldCoord.prevX < worldCoord.x) {
            position.y = player.y;
            position.x = player.width/2;
        }
        else if (worldCoord.prevX > worldCoord.x) {
            position.y = player.y;
            position.x = levelTo.width * tileWidth - tileWidth;
        }
        else if (worldCoord.prevY < worldCoord.y) {
            position.x = player.x;
            position.y = levelTo.height * tileHeight - (tileHeight*2);
        }
        else if (worldCoord.prevY > worldCoord.y) {
            position.x = player.x;
            position.y = player.height/2+1;
        }

        return position;
    }

    /**
     * Links two sprites' position changes together.
     */
    function linkMarkedSprites() {
        var sprite1 = markedSprites[0];
        var sprite2 = markedSprites[1];

        sprite1.properties.linkedDelta = {
            x: 0,
            y: 0
        };
        sprite2.properties.linkedDelta = {
            x: 0,
            y: 0
        };
        sprite1.properties.linkStartPosition = {
            x: sprite1.x,
            y: sprite1.y
        };
        sprite2.properties.linkStartPosition = {
            x: sprite2.x,
            y: sprite2.y
        };

        sprite1.originalRender = sprite1.render;
        sprite2.originalRender = sprite2.render;
        sprite1.render = linkedSpriteRender;
        sprite2.render = linkedSpriteRender;
    }

    /**
     * Unlinks sprites.
     */
    function unlinkMarkedSprites() {
        var sprite1 = markedSprites[0];
        var sprite2 = markedSprites[1];

        if (sprite1) {
            sprite1.color = sprite1.properties.originalColor;
            delete sprite1.properties.marked;
            delete sprite1.properties.linkedDelta;
            delete sprite1.properties.linkStartPosition;
            sprite1.render = sprite1.originalRender ? sprite1.originalRender : sprite1.render;
            delete sprite1.originalRender;
        }

        if (sprite2) {
            sprite2.color = sprite2.properties.originalColor;
            delete sprite2.properties.marked;
            delete sprite2.properties.linkedDelta;
            delete sprite2.properties.linkStartPosition;
            sprite2.render = sprite2.originalRender ? sprite2.originalRender : sprite2.render;
            delete sprite2.originalRender;
        }

        markedSprites.length = 0;
    }

    /**
     *
     */
    function updateLinkedSprites() {
        if (markedSprites.length < 2) {
            return;
        }
        var sprite1 = markedSprites[0];
        var sprite2 = markedSprites[1];

        sprite2.properties.linkedDelta.x = sprite1.x - sprite1.properties.linkStartPosition.x;
        sprite2.properties.linkedDelta.y = sprite1.y - sprite1.properties.linkStartPosition.y;
        sprite1.properties.linkedDelta.x = sprite2.x - sprite2.properties.linkStartPosition.x;
        sprite1.properties.linkedDelta.y = sprite2.y - sprite2.properties.linkStartPosition.y;
    }

    /**
     *
     */
    function linkedSpriteRender() {
        this.x = Math.round(this.x + this.properties.linkedDelta.x);
        this.y = Math.round(this.y + this.properties.linkedDelta.y);
        this.draw();

        if (player.properties.groundedTile === this) {
            player.x = Math.round(player.x + this.properties.linkedDelta.x);
            player.y = Math.round(player.y + this.properties.linkedDelta.y);
        }

        this.properties.linkStartPosition.x = Math.round(this.x);
        this.properties.linkStartPosition.y = Math.round(this.y);
    }

    /**
     *
     */
    function renderButtonPrompt() {
        if (buttonPrompt) {
            ctx.drawImage(d.getElementById('img_button_' + buttonPrompt), canvas.width/2, canvas.height/2);
        }
    }

    /**
     * @param button
     * @param update
     */
    function setButtonPrompt(button, update) {
        buttonPrompt = button;
        buttonPromptUpdate = update;
    }

    /**
     * @param button
     */
    function removeButtonPrompt() {
        buttonPrompt = null;
        buttonPromptUpdate = null;
    }

    /**
     * Flatten the image to 32 colors.
     */
    function postProcess() {
        var imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        var colors = {};
        var r, g, b, a;
        var key;

        for (var i = 0; i < imgData.data.length; i += 4) {
            r = imgData.data[i];
            g = imgData.data[i+1];
            b = imgData.data[i+2];
            key = (r   << 16) |
                (g << 8) |
                (b <<  4);
            //console.log(key.toString(16));
            colors[key] = colors[key] || 1;
            colors[key]++;
        }

        if (Object.keys(colors).length > 32) {
            console.log(colors);
            alert('TOO MANY COLORS! GOT ' + Object.keys(colors).length);
        }
        //this.ctx.putImageData(imgData, 0, 0);
    }
}());
