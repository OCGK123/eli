// 게임 상수
const INITIAL_HEALTH = 30;
const MAX_HAND_SIZE = 7;
const MAX_BOARD_SIZE = 5;
const MIN_DECK_SIZE = 30;
const MAX_MANA = 10;

// 게임 상태
let gameState = {
    connectionEstablished: false,
    gameStarted: false,
    currentTurn: null,
    turnNumber: 0,
    player: {
        id: null,
        name: '',
        health: INITIAL_HEALTH,
        maxMana: 0,
        currentMana: 0,
        deck: [],
        hand: [],
        board: Array(MAX_BOARD_SIZE).fill(null),
        graveyard: []
    },
    opponent: {
        id: null,
        name: '',
        health: INITIAL_HEALTH,
        maxMana: 0,
        currentMana: 0,
        deckCount: MIN_DECK_SIZE,
        handCount: 0,
        board: Array(MAX_BOARD_SIZE).fill(null),
        graveyardCount: 0
    },
    selectedCard: null,
    targetingMode: false,
    gameOver: false,
    winner: null
};

// P2P 연결
let peer;
let conn;
let roomId;
let isHost = false;

// DOM 요소
const loginScreen = document.getElementById('loginScreen');
const gameContainer = document.getElementById('gameContainer');
const playerNameInput = document.getElementById('playerName');
const createRoomBtn = document.getElementById('createRoom');
const joinRoomBtn = document.getElementById('joinRoom');
const roomIdGroup = document.getElementById('roomIdGroup');
const roomIdInput = document.getElementById('roomId');
const connectToRoomBtn = document.getElementById('connectToRoom');
const connectionStatus = document.getElementById('connectionStatus');
const turnIndicator = document.getElementById('turnIndicator');
const endTurnBtn = document.getElementById('endTurnBtn');
const playerNameDisplay = document.getElementById('playerNameDisplay');
const opponentName = document.getElementById('opponentName');
const playerHealth = document.getElementById('playerHealth');
const opponentHealth = document.getElementById('opponentHealth');
const playerMana = document.getElementById('playerMana');
const opponentMana = document.getElementById('opponentMana');
const playerHand = document.getElementById('playerHand');
const opponentHand = document.getElementById('opponentHand');
const playerCardSlots = document.getElementById('playerCardSlots');
const opponentCardSlots = document.getElementById('opponentCardSlots');
const playerAvatar = document.getElementById('playerAvatar');
const opponentAvatar = document.getElementById('opponentAvatar');
const opponentDeckCount = document.getElementById('opponentDeckCount');
const opponentGraveyardCount = document.getElementById('opponentGraveyardCount');
const gameLog = document.getElementById('gameLog');
const gameLogToggle = document.getElementById('game-log-toggle');
const cardModal = document.getElementById('cardModal');
const modalCardTitle = document.getElementById('modalCardTitle');
const modalCardPreview = document.getElementById('modalCardPreview');
const modalCardDescription = document.getElementById('modalCardDescription');
const closeCardModal = document.getElementById('closeCardModal');
const gameOverModal = document.getElementById('gameOverModal');
const winnerAnnouncement = document.getElementById('winnerAnnouncement');
const playAgainBtn = document.getElementById('playAgainBtn');
const exitGameBtn = document.getElementById('exitGameBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');

// 이벤트 리스너 설정
window.addEventListener('load', initGame);
createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', () => {
    roomIdGroup.style.display = 'block';
});
connectToRoomBtn.addEventListener('click', joinRoom);
endTurnBtn.addEventListener('click', endTurn);
gameLogToggle.addEventListener('click', toggleGameLog);
closeCardModal.addEventListener('click', () => cardModal.style.display = 'none');
playAgainBtn.addEventListener('click', resetGame);
exitGameBtn.addEventListener('click', exitGame);

// 게임 초기화
function initGame() {
    // 카드 데이터 로드
    loadCards();
    
    // 게임 로그 토글
    gameLog.style.display = 'none';
    
    // 비활성화된 버튼
    endTurnBtn.disabled = true;
}

// 카드 데이터 로드
function loadCards() {
    fetch('cards.json')
        .then(response => response.json())
        .then(data => {
            window.cardDatabase = data;
        })
        .catch(error => {
            console.error('카드 데이터를 불러오는 데 실패했습니다:', error);
            // 백업 카드 데이터 로드
            window.cardDatabase = backupCardData;
        });
}

// 방 생성
function createRoom() {
    const playerName = playerNameInput.value.trim();
    if (!playerName) {
        alert('닉네임을 입력해주세요.');
        return;
    }
    
    isHost = true;
    gameState.player.name = playerName;
    playerAvatar.textContent = playerName.charAt(0).toUpperCase();
    playerNameDisplay.textContent = playerName;
    
    showLoadingOverlay('방 생성 중...');
    
    // PeerJS 초기화
    peer = new Peer();
    
    peer.on('open', id => {
        roomId = id;
        alert(`방 코드: ${roomId}\n이 코드를 상대방에게 공유하세요.`);
        hideLoadingOverlay();
        connectionStatus.textContent = '상대방 대기 중...';
        connectionStatus.className = 'connection-status connecting';
    });
    
    peer.on('connection', connection => {
        conn = connection;
        setupConnection();
    });
    
    peer.on('error', error => {
        console.error('PeerJS 오류:', error);
        hideLoadingOverlay();
        alert('연결 오류가 발생했습니다. 다시 시도해주세요.');
    });
}

// 방 참가
function joinRoom() {
    const playerName = playerNameInput.value.trim();
    const roomIdValue = roomIdInput.value.trim();
    
    if (!playerName) {
        alert('닉네임을 입력해주세요.');
        return;
    }
    
    if (!roomIdValue) {
        alert('방 코드를 입력해주세요.');
        return;
    }
    
    isHost = false;
    gameState.player.name = playerName;
    playerAvatar.textContent = playerName.charAt(0).toUpperCase();
    playerNameDisplay.textContent = playerName;
    
    showLoadingOverlay('방 접속 중...');
    
    // PeerJS 초기화
    peer = new Peer();
    
    peer.on('open', id => {
        gameState.player.id = id;
        
        // 방에 연결
        conn = peer.connect(roomIdValue);
        setupConnection();
    });
    
    peer.on('error', error => {
        console.error('PeerJS 오류:', error);
        hideLoadingOverlay();
        alert('연결 오류가 발생했습니다. 방 코드를 확인해주세요.');
    });
}

// 연결 설정
function setupConnection() {
    conn.on('open', () => {
        connectionStatus.textContent = '연결됨';
        connectionStatus.className = 'connection-status connected';
        gameState.connectionEstablished = true;
        
        // 게임 화면으로 전환
        loginScreen.style.display = 'none';
        gameContainer.style.display = 'block';
        hideLoadingOverlay();
        
        // 플레이어 정보 전송
        sendData({
            type: 'player_info',
            name: gameState.player.name,
            id: peer.id
        });
        
        // 호스트인 경우 게임 시작
        if (isHost) {
            initializeGame();
        }
    });
    
    conn.on('data', data => {
        handleReceivedData(data);
    });
    
    conn.on('close', () => {
        connectionStatus.textContent = '연결 끊김';
        connectionStatus.className = 'connection-status disconnected';
        gameState.connectionEstablished = false;
        addGameLog('상대방과의 연결이 끊어졌습니다.');
    });
    
    conn.on('error', error => {
        console.error('연결 오류:', error);
        connectionStatus.textContent = '연결 오류';
        connectionStatus.className = 'connection-status disconnected';
    });
}

// 데이터 전송
function sendData(data) {
    if (conn && gameState.connectionEstablished) {
        conn.send(data);
    }
}

// 수신된 데이터 처리
function handleReceivedData(data) {
    console.log('받은 데이터:', data);
    
    switch (data.type) {
        case 'player_info':
            gameState.opponent.name = data.name;
            gameState.opponent.id = data.id;
            opponentName.textContent = data.name;
            opponentAvatar.textContent = data.name.charAt(0).toUpperCase();
            break;
            
        case 'game_init':
            // 비호스트 플레이어에게 게임 초기 상태 설정
            if (!isHost) {
                gameState.currentTurn = data.startingPlayer;
                gameState.player.deck = data.playerDeck;
                
                // 초기 카드 드로우
                for (let i = 0; i < data.initialCards; i++) {
                    drawCard(gameState.player);
                }
                
                updateGameUI();
                
                // 게임 시작 알림
                addGameLog('게임이 시작되었습니다!');
                if (gameState.currentTurn === peer.id) {
                    addGameLog('당신의 턴입니다.');
                    updateTurnIndicator(true);
                } else {
                    addGameLog('상대방의 턴입니다.');
                    updateTurnIndicator(false);
                }
                
                gameState.gameStarted = true;
            }
            break;
            
        case 'draw_card':
            // 상대방이 카드를 드로우함
            gameState.opponent.handCount++;
            opponentHand.innerHTML = '';
            
            // 상대방 손에 있는 카드 수만큼 뒷면 카드 추가
            for (let i = 0; i < gameState.opponent.handCount; i++) {
                const cardBack = createCardBack();
                opponentHand.appendChild(cardBack);
            }
            
            // 상대방 덱 수 갱신
            gameState.opponent.deckCount--;
            opponentDeckCount.textContent = gameState.opponent.deckCount;
            
            addGameLog(`${gameState.opponent.name}님이 카드를 뽑았습니다.`);
            break;
            
        case 'play_card':
            // 상대방이 카드를 플레이함
            const playedCard = data.card;
            const boardIndex = data.boardIndex;
            
            // 상대방 손에서 카드 제거
            gameState.opponent.handCount--;
            opponentHand.innerHTML = '';
            
            // 상대방 손에 있는 카드 수만큼 뒷면 카드 추가
            for (let i = 0; i < gameState.opponent.handCount; i++) {
                const cardBack = createCardBack();
                opponentHand.appendChild(cardBack);
            }
            
            // 상대방 필드에 카드 추가
            gameState.opponent.board[boardIndex] = playedCard;
            
            // 상대방 마나 갱신
            gameState.opponent.currentMana -= playedCard.cost;
            opponentMana.textContent = `${gameState.opponent.currentMana}/${gameState.opponent.maxMana}`;
            
            // 상대방 필드 UI 업데이트
            updateBoardUI(gameState.opponent, opponentCardSlots);
            
            addGameLog(`${gameState.opponent.name}님이 ${playedCard.name} 카드를 플레이했습니다.`);
            
            // 카드 효과 처리
            handleCardEffects(playedCard, false);
            break;
            
        case 'end_turn':
            // 상대방 턴 종료
            gameState.currentTurn = peer.id;
            gameState.turnNumber++;
            
            // 내 턴 시작 처리
            startTurn();
            
            addGameLog(`${gameState.opponent.name}님이 턴을 종료했습니다. 당신의 턴입니다.`);
            break;
            
        case 'attack':
            // 상대방 공격 처리
            const attackerIndex = data.attackerIndex;
            const defenderIndex = data.defenderIndex;
            const isPlayerTarget = data.isPlayerTarget;
            
            const attacker = gameState.opponent.board[attackerIndex];
            
            if (isPlayerTarget) {
                // 플레이어 직접 공격
                gameState.player.health -= attacker.attack;
                playerHealth.textContent = gameState.player.health;
                
                addGameLog(`${gameState.opponent.name}님의 ${attacker.name}(이)가 당신을 직접 공격했습니다. (${attacker.attack} 데미지)`);
                
                // 플레이어 사망 체크
                checkPlayerDeath();
            } else {
                // 미니언 공격
                const defender = gameState.player.board[defenderIndex];
                
                defender.health -= attacker.attack;
                attacker.health -= defender.attack;
                
                addGameLog(`${gameState.opponent.name}님의 ${attacker.name}(이)가 당신의 ${defender.name}(을)를 공격했습니다.`);
                
                // 미니언 사망 체크
                checkMinionDeath(gameState.opponent, attackerIndex);
                checkMinionDeath(gameState.player, defenderIndex);
                
                // 보드 업데이트
                updateBoardUI(gameState.opponent, opponentCardSlots);
                updateBoardUI(gameState.player, playerCardSlots);
            }
            break;
            
        case 'direct_damage':
            // 직접 데미지 처리
            const damage = data.damage;
            const target = data.target;
            
            if (target === 'player') {
                gameState.player.health -= damage;
                playerHealth.textContent = gameState.player.health;
                
                addGameLog(`${gameState.opponent.name}님이 당신에게 ${damage} 데미지를 입혔습니다.`);
                
                // 플레이어 사망 체크
                checkPlayerDeath();
            } else if (target === 'minion') {
                const minionIndex = data.minionIndex;
                gameState.player.board[minionIndex].health -= damage;
                
                addGameLog(`${gameState.opponent.name}님이 당신의 미니언에게 ${damage} 데미지를 입혔습니다.`);
                
                // 미니언 사망 체크
                checkMinionDeath(gameState.player, minionIndex);
                
                // 보드 업데이트
                updateBoardUI(gameState.player, playerCardSlots);
            }
            break;
            
        case 'heal':
            // 힐 처리
            const healAmount = data.amount;
            const healTarget = data.target;
            
            if (healTarget === 'opponent') {
                gameState.opponent.health = Math.min(INITIAL_HEALTH, gameState.opponent.health + healAmount);
                opponentHealth.textContent = gameState.opponent.health;
                
                addGameLog(`${gameState.opponent.name}님이 자신을 ${healAmount} 만큼 치유했습니다.`);
            } else if (healTarget === 'minion') {
                const minionIndex = data.minionIndex;
                const minion = gameState.opponent.board[minionIndex];
                minion.health = Math.min(minion.maxHealth, minion.health + healAmount);
                
                addGameLog(`${gameState.opponent.name}님이 미니언을 ${healAmount} 만큼 치유했습니다.`);
                
                // 보드 업데이트
                updateBoardUI(gameState.opponent, opponentCardSlots);
            }
            break;
            
        case 'game_over':
            // 게임 종료
            gameState.gameOver = true;
            gameState.winner = data.winner;
            
            // 게임 오버 모달 표시
            showGameOverScreen();
            break;
            
        case 'play_again_request':
            // 다시 플레이 요청
            if (confirm(`${gameState.opponent.name}님이 다시 플레이하자고 요청했습니다. 수락하시겠습니까?`)) {
                sendData({ type: 'play_again_accept' });
                resetGame();
            } else {
                sendData({ type: 'play_again_decline' });
            }
            break;
            
        case 'play_again_accept':
            // 다시 플레이 수락
            resetGame();
            break;
            
        case 'play_again_decline':
            // 다시 플레이 거절
            alert(`${gameState.opponent.name}님이 다시 플레이 요청을 거절했습니다.`);
            break;
    }
}

// 게임 초기화
function initializeGame() {
    // 게임 상태 초기화
    gameState.gameStarted = true;
    gameState.turnNumber = 1;
    
    // 카드 덱 생성
    createDeck();
    
    // 선 플레이어 결정 (호스트가 결정)
    const startingPlayer = Math.random() < 0.5 ? peer.id : gameState.opponent.id;
    gameState.currentTurn = startingPlayer;
    
    // 초기 카드 드로우
    const initialCards = 3;
    for (let i = 0; i < initialCards; i++) {
        drawCard(gameState.player);
    }
    
    // 플레이어에게 게임 초기 상태 알림
    const opponentDeck = createRandomDeck();
    
    sendData({
        type: 'game_init',
        startingPlayer: startingPlayer,
        playerDeck: opponentDeck,
        initialCards: initialCards
    });
    
    // 게임 시작 처리
    updateGameUI();
    
    // 게임 시작 알림
    addGameLog('게임이 시작되었습니다!');
    if (gameState.currentTurn === peer.id) {
        addGameLog('당신의 턴입니다.');
        updateTurnIndicator(true);
        startTurn();
    } else {
        addGameLog('상대방의 턴입니다.');
        updateTurnIndicator(false);
    }
}

// 덱 생성
function createDeck() {
    // 카드 데이터베이스에서 랜덤하게 카드 선택
    const cards = window.cardDatabase.slice();
    const deck = [];
    
    // 각 카드를 덱에 추가 (최소 30장)
    while (deck.length < MIN_DECK_SIZE) {
        const randomIndex = Math.floor(Math.random() * cards.length);
        const card = JSON.parse(JSON.stringify(cards[randomIndex])); // 깊은 복사
        
        // 카드 능력치 랜덤 변화 (±20%)
        if (card.type === 'minion') {
            const attackVariation = Math.random() * 0.4 - 0.2; // -20% ~ +20%
            const healthVariation = Math.random() * 0.4 - 0.2; // -20% ~ +20%
            
            card.attack = Math.max(1, Math.round(card.attack * (1 + attackVariation)));
            card.health = Math.max(1, Math.round(card.health * (1 + healthVariation)));
            card.maxHealth = card.health;
        } else if (card.type === 'spell' && card.damage) {
            const damageVariation = Math.random() * 0.4 - 0.2; // -20% ~ +20%
            card.damage = Math.max(1, Math.round(card.damage * (1 + damageVariation)));
        }
        
        deck.push(card);
    }
    
    // 덱 셔플
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    gameState.player.deck = deck;
}

// 랜덤 덱 생성 (상대방용)
function createRandomDeck() {
    // 카드 데이터베이스에서 랜덤하게 카드 선택
    const cards = window.cardDatabase.slice();
    const deck = [];
    
    // 각 카드를 덱에 추가 (최소 30장)
    while (deck.length < MIN_DECK_SIZE) {
        const randomIndex = Math.floor(Math.random() * cards.length);
        const card = JSON.parse(JSON.stringify(cards[randomIndex])); // 깊은 복사
        
        // 카드 능력치 랜덤 변화 (±20%)
        if (card.type === 'minion') {
            const attackVariation = Math.random() * 0.4 - 0.2; // -20% ~ +20%
            const healthVariation = Math.random() * 0.4 - 0.2; // -20% ~ +20%
            
            card.attack = Math.max(1, Math.round(card.attack * (1 + attackVariation)));
            card.health = Math.max(1, Math.round(card.health * (1 + healthVariation)));
            card.maxHealth = card.health;
        } else if (card.type === 'spell' && card.damage) {
            const damageVariation = Math.random() * 0.4 - 0.2; // -20% ~ +20%
            card.damage = Math.max(1, Math.round(card.damage * (1 + damageVariation)));
        }
        
        deck.push(card);
    }
    
    // 덱 셔플
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
}

// 카드 드로우
function drawCard(player) {
    if (player.deck.length === 0) {
        // 덱 고갈 데미지
        player.health -= 2;
        playerHealth.textContent = player.health;
        addGameLog('덱이 비어있어 2 데미지를 입었습니다!');
        checkPlayerDeath();
        return;
    }
    
    if (player.hand.length >= MAX_HAND_SIZE) {
        // 손패가 꽉 찼을 때
        const burnedCard = player.deck.shift();
        player.graveyard.push(burnedCard);
        addGameLog(`손패가 꽉 차서 ${burnedCard.name} 카드가 버려졌습니다.`);
        return;
    }
    
    // 덱에서 카드 한 장 드로우
    const card = player.deck.shift();
    player.hand.push(card);
    
    // 손패 UI 업데이트
    updateHandUI();
    
    // 서버에 카드 드로우 알림
    sendData({ type: 'draw_card' });
}

// 턴 시작
function startTurn() {
    // 마나 충전
    if (gameState.player.maxMana < MAX_MANA) {
        gameState.player.maxMana++;
    }
    gameState.player.currentMana = gameState.player.maxMana;
    
    // 턴 시작 시 카드 드로우
    drawCard(gameState.player);
    
    // 미니언 공격 가능 상태로 초기화
    for (let i = 0; i < gameState.player.board.length; i++) {
        if (gameState.player.board[i]) {
            gameState.player.board[i].canAttack = true;
        }
    }
    
    // UI 업데이트
    updateGameUI();
    updateTurnIndicator(true);
    endTurnBtn.disabled = false;
}

// 턴 종료
function endTurn() {
    if (gameState.currentTurn !== peer.id || gameState.gameOver) {
        return;
    }
    
    // 턴 종료 상태 업데이트
    gameState.currentTurn = gameState.opponent.id;
    
    // 마나 업데이트 (상대방)
    if (gameState.opponent.maxMana < MAX_MANA) {
        gameState.opponent.maxMana++;
    }
    gameState.opponent.currentMana = gameState.opponent.maxMana;
    
    // UI 업데이트
    updateGameUI();
    updateTurnIndicator(false);
    endTurnBtn.disabled = true;
    
    // 서버에 턴 종료 알림
    sendData({ type: 'end_turn' });
    
    addGameLog('턴을 종료했습니다.');
}

// 턴 표시기 업데이트
function updateTurnIndicator(isPlayerTurn) {
    if (isPlayerTurn) {
        turnIndicator.textContent = '내 턴';
        turnIndicator.style.backgroundColor = 'var(--primary-color)';
    } else {
        turnIndicator.textContent = '상대방 턴';
        turnIndicator.style.backgroundColor = 'var(--accent-color)';
    }
}

// 손패 UI 업데이트
function updateHandUI() {
    playerHand.innerHTML = '';
    
    for (let i = 0; i < gameState.player.hand.length; i++) {
        const card = gameState.player.hand[i];
        const cardElement = createCardElement(card, i);
        
        cardElement.addEventListener('click', () => {
            if (gameState.currentTurn !== peer.id) {
                return; // 내 턴이 아니면 카드를 플레이할 수 없음
            }
            
            if (gameState.targetingMode) {
                return; // 타겟팅 모드일 때는 카드 플레이 불가
            }
            
            // 비용 체크
            if (card.cost > gameState.player.currentMana) {
                addGameLog('마나가 부족합니다!');
                return;
            }
            
            // 카드 타입에 따른 처리
            if (card.type === 'minion') {
                // 필드가 꽉 찼는지 확인
                const emptySlot = gameState.player.board.indexOf(null);
                if (emptySlot === -1) {
                    addGameLog('필드가 꽉 찼습니다!');
                    return;
                }
                
                // 미니언 카드 플레이
                playMinionCard(i, emptySlot);
            } else if (card.type === 'spell') {
                // 스펠 카드 타겟팅 필요 여부 확인
                if (card.targetRequired) {
                    selectSpellTarget(i);
                } else {
                    // 타겟 없는 스펠 카드 바로 플레이
                    playSpellCard(i);
                }
            }
        });
        
        playerHand.appendChild(cardElement);
    }
}

// 보드 UI 업데이트
function updateBoardUI(playerObj, boardElement) {
    const slots = boardElement.querySelectorAll('.card-slot');
    
    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        slot.innerHTML = '';
        
        const card = playerObj.board[i];
        if (card) {
            const cardElement = createCardElement(card);
            slot.appendChild(cardElement);
            
            // 내 카드인 경우 이벤트 추가
            if (playerObj === gameState.player && gameState.currentTurn === peer.id) {
                if (card.canAttack) {
                    cardElement.classList.add('can-attack');
                    
                    cardElement.addEventListener('click', () => {
                        if (!card.canAttack) return;
                        
                        // 공격 타겟 선택 모드
                        selectAttackTarget(i);
                    });
                }
            }
        }
    }
}

// 게임 UI 업데이트
function updateGameUI() {
    // 마나 업데이트
    playerMana.textContent = `${gameState.player.currentMana}/${gameState.player.maxMana}`;
    opponentMana.textContent = `${gameState.opponent.currentMana}/${gameState.opponent.maxMana}`;
    
    // 체력 업데이트
    playerHealth.textContent = gameState.player.health;
    opponentHealth.textContent = gameState.opponent.health;
    
    // 손패 업데이트
    updateHandUI();
    
    // 보드 업데이트
    updateBoardUI(gameState.player, playerCardSlots);
    updateBoardUI(gameState.opponent, opponentCardSlots);
    
    // 덱 & 무덤 카운트 업데이트
    opponentDeckCount.textContent = gameState.opponent.deckCount;
    opponentGraveyardCount.textContent = gameState.opponent.graveyardCount;
}

// 미니언 카드 플레이
function playMinionCard(handIndex, boardIndex) {
    const card = gameState.player.hand[handIndex];
    
    // 카드 손에서 필드로 이동
    gameState.player.hand.splice(handIndex, 1);
    gameState.player.board[boardIndex] = card;
    
    // 소환 시 공격 불가 (혹시 돌진이 있는 경우 별도 처리)
    card.canAttack = card.charge || false;
    
    // 마나 사용
    gameState.player.currentMana -= card.cost;
    
    // UI 업데이트
    updateGameUI();
    
    // 카드 플레이 효과 처리
    handleCardEffects(card, true);
    
    // 서버에 카드 플레이 알림
    sendData({
        type: 'play_card',
        card: card,
        boardIndex: boardIndex
    });
    
    addGameLog(`${card.name} 카드를 플레이했습니다.`);
}

// 스펠 타겟 선택
function selectSpellTarget(handIndex) {
    const card = gameState.player.hand[handIndex];
    
    // 타겟팅 모드 활성화
    gameState.targetingMode = true;
    gameState.selectedCard = { index: handIndex, card: card };
    
    // 타겟팅 UI 활성화
    document.body.classList.add('targeting-mode');
    
    addGameLog(`${card.name} 카드의 대상을 선택하세요.`);
    
    // 적 히어로 타겟팅 가능
    opponentAvatar.classList.add('valid-target');
    opponentAvatar.addEventListener('click', handleSpellTargetSelection);
    
    // 적 미니언 타겟팅 가능
    const opponentSlots = opponentCardSlots.querySelectorAll('.card-slot');
    opponentSlots.forEach((slot, index) => {
        if (gameState.opponent.board[index]) {
            slot.classList.add('valid-target');
            slot.dataset.targetIndex = index;
            slot.addEventListener('click', handleSpellTargetSelection);
        }
    });
    
    // 내 미니언 타겟팅 가능 (힐링 스펠 등의 경우)
    if (card.canTargetFriendly) {
        const playerSlots = playerCardSlots.querySelectorAll('.card-slot');
        playerSlots.forEach((slot, index) => {
            if (gameState.player.board[index]) {
                slot.classList.add('valid-target');
                slot.dataset.targetIndex = index;
                slot.addEventListener('click', handleSpellTargetSelection);
            }
        });
        
        // 내 히어로 타겟팅 가능
        playerAvatar.classList.add('valid-target');
        playerAvatar.addEventListener('click', handleSpellTargetSelection);
    }
    
    // 취소 이벤트 (오른쪽 클릭)
    document.addEventListener('contextmenu', cancelTargeting);
}

// 스펠 타겟 선택 처리
function handleSpellTargetSelection(event) {
    event.stopPropagation();
    
    const target = event.currentTarget;
    const handIndex = gameState.selectedCard.index;
    const card = gameState.selectedCard.card;
    
    // 타겟팅 모드 비활성화
    cancelTargeting();
    
    // 타겟 유형 결정
    let targetType, targetIndex;
    
    if (target === opponentAvatar) {
        targetType = 'opponent';
    } else if (target === playerAvatar) {
        targetType = 'player';
    } else {
        // 미니언 타겟
        targetType = target.closest('#opponentCardSlots') ? 'opponent_minion' : 'player_minion';
        targetIndex = parseInt(target.dataset.targetIndex);
    }
    
    // 스펠 효과 적용
    applySpellEffect(card, targetType, targetIndex);
    
    // 카드 사용 처리
    gameState.player.hand.splice(handIndex, 1);
    gameState.player.currentMana -= card.cost;
    gameState.player.graveyard.push(card);
    
    // UI 업데이트
    updateGameUI();
    
    addGameLog(`${card.name} 카드를 사용했습니다.`);
}

// 타겟팅 취소
function cancelTargeting(event) {
    if (event) {
        event.preventDefault();
    }
    
    gameState.targetingMode = false;
    gameState.selectedCard = null;
    
    // 타겟팅 UI 비활성화
    document.body.classList.remove('targeting-mode');
    
    // 모든 타겟 클래스 제거
    document.querySelectorAll('.valid-target').forEach(el => {
        el.classList.remove('valid-target');
        el.removeEventListener('click', handleSpellTargetSelection);
    });
    
    // 취소 이벤트 제거
    document.removeEventListener('contextmenu', cancelTargeting);
}

// 타겟 없는 스펠 카드 플레이
function playSpellCard(handIndex) {
    const card = gameState.player.hand[handIndex];
    
    // 카드 효과 적용
    applySpellEffect(card);
    
    // 카드 손에서 제거
    gameState.player.hand.splice(handIndex, 1);
    gameState.player.graveyard.push(card);
    
    // 마나 사용
    gameState.player.currentMana -= card.cost;
    
    // UI 업데이트
    updateGameUI();
    
    addGameLog(`${card.name} 카드를 사용했습니다.`);
}

// 스펠 효과 적용
function applySpellEffect(card, targetType, targetIndex) {
    // 카드 효과 타입에 따른 처리
    switch (card.effect) {
        case 'damage':
            // 데미지 효과
            const damage = card.damage || 0;
            
            if (targetType === 'opponent') {
                // 상대 히어로에게 데미지
                gameState.opponent.health -= damage;
                opponentHealth.textContent = gameState.opponent.health;
                
                // 서버에 데미지 알림
                sendData({
                    type: 'direct_damage',
                    damage: damage,
                    target: 'opponent'
                });
                
                addGameLog(`${card.name}(으)로 상대방에게 ${damage} 데미지를 입혔습니다.`);
                
                // 게임 종료 체크
                if (gameState.opponent.health <= 0) {
                    gameOver(peer.id);
                }
            } else if (targetType === 'opponent_minion') {
                // 상대 미니언에게 데미지
                const targetMinion = gameState.opponent.board[targetIndex];
                targetMinion.health -= damage;
                
                // 서버에 데미지 알림
                sendData({
                    type: 'direct_damage',
                    damage: damage,
                    target: 'minion',
                    minionIndex: targetIndex
                });
                
                addGameLog(`${card.name}(으)로 상대방의 ${targetMinion.name}에게 ${damage} 데미지를 입혔습니다.`);
                
                // 미니언 사망 체크
                checkMinionDeath(gameState.opponent, targetIndex);
            }
            break;
            
        case 'heal':
            // 힐링 효과
            const healAmount = card.heal || 0;
            
            if (targetType === 'player') {
                // 자신의 히어로 힐링
                gameState.player.health = Math.min(INITIAL_HEALTH, gameState.player.health + healAmount);
                playerHealth.textContent = gameState.player.health;
                
                addGameLog(`${card.name}(으)로 자신을 ${healAmount} 만큼 치유했습니다.`);
            } else if (targetType === 'player_minion') {
                // 자신의 미니언 힐링
                const targetMinion = gameState.player.board[targetIndex];
                targetMinion.health = Math.min(targetMinion.maxHealth, targetMinion.health + healAmount);
                
                addGameLog(`${card.name}(으)로 ${targetMinion.name}을(를) ${healAmount} 만큼 치유했습니다.`);
            }
            break;
            
        case 'aoe_damage':
            // 광역 데미지 효과
            const aoeDamage = card.damage || 0;
            
            // 상대방 모든 미니언에게 데미지
            for (let i = 0; i < gameState.opponent.board.length; i++) {
                if (gameState.opponent.board[i]) {
                    gameState.opponent.board[i].health -= aoeDamage;
                    
                    // 미니언 사망 체크
                    checkMinionDeath(gameState.opponent, i);
                }
            }
            
            // 서버에 광역 데미지 알림
            sendData({
                type: 'aoe_damage',
                damage: aoeDamage
            });
            
            addGameLog(`${card.name}(으)로 상대방의 모든 미니언에게 ${aoeDamage} 데미지를 입혔습니다.`);
            break;
            
        case 'draw':
            // 카드 드로우 효과
            const drawCount = card.drawCount || 1;
            
            for (let i = 0; i < drawCount; i++) {
                drawCard(gameState.player);
            }
            
            addGameLog(`${card.name}(으)로 카드를 ${drawCount}장 뽑았습니다.`);
            break;
            
        // 더 많은 효과 타입 추가 가능
    }
    
    // UI 업데이트
    updateGameUI();
}

// 공격 타겟 선택
function selectAttackTarget(attackerIndex) {
    // 타겟팅 모드 활성화
    gameState.targetingMode = true;
    gameState.selectedCard = { index: attackerIndex, isAttacker: true };
    
    // 타겟팅 UI 활성화
    document.body.classList.add('targeting-mode');
    
    const attackerCard = gameState.player.board[attackerIndex];
    addGameLog(`${attackerCard.name}(으)로 공격할 대상을 선택하세요.`);
    
    // 상대방 히어로 타겟팅 가능
    opponentAvatar.classList.add('valid-target');
    opponentAvatar.addEventListener('click', handleAttackTargetSelection);
    
    // 상대방 미니언 타겟팅 가능
    const opponentSlots = opponentCardSlots.querySelectorAll('.card-slot');
    opponentSlots.forEach((slot, index) => {
        if (gameState.opponent.board[index]) {
            slot.classList.add('valid-target');
            slot.dataset.targetIndex = index;
            slot.addEventListener('click', handleAttackTargetSelection);
        }
    });
    
    // 취소 이벤트 (오른쪽 클릭)
    document.addEventListener('contextmenu', cancelTargeting);
}

// 공격 타겟 선택 처리
function handleAttackTargetSelection(event) {
    event.stopPropagation();
    
    const target = event.currentTarget;
    const attackerIndex = gameState.selectedCard.index;
    const attacker = gameState.player.board[attackerIndex];
    
    // 타겟팅 모드 비활성화
    cancelTargeting();
    
    // 공격자 공격 불가 상태로 변경
    attacker.canAttack = false;
    
    // 타겟 유형 결정
    if (target === opponentAvatar) {
        // 상대 히어로 직접 공격
        gameState.opponent.health -= attacker.attack;
        opponentHealth.textContent = gameState.opponent.health;
        
        // 서버에 공격 알림
        sendData({
            type: 'attack',
            attackerIndex: attackerIndex,
            isPlayerTarget: true
        });
        
        addGameLog(`${attacker.name}(으)로 상대방을 직접 공격했습니다. (${attacker.attack} 데미지)`);
        
        // 게임 종료 체크
        if (gameState.opponent.health <= 0) {
            gameOver(peer.id);
        }
    } else {
        // 상대 미니언 공격
        const defenderIndex = parseInt(target.dataset.targetIndex);
        const defender = gameState.opponent.board[defenderIndex];
        
        // 데미지 처리
        defender.health -= attacker.attack;
        attacker.health -= defender.attack;
        
        // 서버에 공격 알림
        sendData({
            type: 'attack',
            attackerIndex: attackerIndex,
            defenderIndex: defenderIndex,
            isPlayerTarget: false
        });
        
        addGameLog(`${attacker.name}(으)로 상대방의 ${defender.name}을(를) 공격했습니다.`);
        
        // 미니언 사망 체크
        checkMinionDeath(gameState.player, attackerIndex);
        checkMinionDeath(gameState.opponent, defenderIndex);
    }
    
    // UI 업데이트
    updateGameUI();
}

// 미니언 사망 체크
function checkMinionDeath(playerObj, index) {
    const minion = playerObj.board[index];
    
    if (minion && minion.health <= 0) {
        // 미니언 사망 처리
        playerObj.graveyard.push(minion);
        playerObj.board[index] = null;
        
        if (playerObj === gameState.player) {
            addGameLog(`당신의 ${minion.name}(이)가 사망했습니다.`);
        } else {
            gameState.opponent.graveyardCount++;
            opponentGraveyardCount.textContent = gameState.opponent.graveyardCount;
            addGameLog(`상대방의 ${minion.name}(이)가 사망했습니다.`);
        }
    }
}

// 플레이어 사망 체크
function checkPlayerDeath() {
    if (gameState.player.health <= 0) {
        gameOver(gameState.opponent.id);
    }
}

// 게임 종료
function gameOver(winnerId) {
    gameState.gameOver = true;
    gameState.winner = winnerId;
    
    // 게임 오버 화면 표시
    showGameOverScreen();
    
    // 상대방에게 게임 종료 알림
    sendData({
        type: 'game_over',
        winner: winnerId
    });
}

// 게임 오버 화면 표시
function showGameOverScreen() {
    const isPlayerWin = gameState.winner === peer.id;
    
    winnerAnnouncement.textContent = isPlayerWin ? '승리!' : '패배...';
    winnerAnnouncement.style.color = isPlayerWin ? 'var(--earth-color)' : 'var(--fire-color)';
    
    gameOverModal.style.display = 'flex';
}

// 게임 초기화 (다시 플레이)
function resetGame() {
    // 게임 상태 초기화
    gameState.gameOver = false;
    gameState.winner = null;
    gameState.turnNumber = 0;
    gameState.currentTurn = null;
    gameState.targetingMode = false;
    gameState.selectedCard = null;
    
    // 플레이어 상태 초기화
    gameState.player.health = INITIAL_HEALTH;
    gameState.player.maxMana = 0;
    gameState.player.currentMana = 0;
    gameState.player.deck = [];
    gameState.player.hand = [];
    gameState.player.board = Array(MAX_BOARD_SIZE).fill(null);
    gameState.player.graveyard = [];
    
    // 상대방 상태 초기화
    gameState.opponent.health = INITIAL_HEALTH;
    gameState.opponent.maxMana = 0;
    gameState.opponent.currentMana = 0;
    gameState.opponent.deckCount = MIN_DECK_SIZE;
    gameState.opponent.handCount = 0;
    gameState.opponent.board = Array(MAX_BOARD_SIZE).fill(null);
    gameState.opponent.graveyardCount = 0;
    
    // UI 초기화
    playerHealth.textContent = INITIAL_HEALTH;
    opponentHealth.textContent = INITIAL_HEALTH;
    playerMana.textContent = '0/0';
    opponentMana.textContent = '0/0';
    opponentDeckCount.textContent = MIN_DECK_SIZE;
    opponentGraveyardCount.textContent = 0;
    
    playerHand.innerHTML = '';
    opponentHand.innerHTML = '';
    
    const playerSlots = playerCardSlots.querySelectorAll('.card-slot');
    const opponentSlots = opponentCardSlots.querySelectorAll('.card-slot');
    
    playerSlots.forEach(slot => {
        slot.innerHTML = '';
    });
    
    opponentSlots.forEach(slot => {
        slot.innerHTML = '';
    });
    
    // 게임 로그 초기화
    gameLog.innerHTML = '';
    
    // 모달 닫기
    gameOverModal.style.display = 'none';
    
    // 호스트인 경우 게임 재시작
    if (isHost) {
        initializeGame();
    }
    
    // 다시 플레이 요청 보내기
    if (!isHost) {
        sendData({ type: 'play_again_request' });
    }
}

// 게임 나가기
function exitGame() {
    if (conn) {
        conn.close();
    }
    
    if (peer) {
        peer.destroy();
    }
    
    // 로그인 화면으로 돌아가기
    loginScreen.style.display = 'flex';
    gameContainer.style.display = 'none';
    gameOverModal.style.display = 'none';
    
    // URL 리프레시
    window.location.reload();
}

// 카드 효과 처리
function handleCardEffects(card, isPlayerCard) {
    if (card.onPlay) {
        switch (card.onPlay) {
            case 'draw':
                // 카드 드로우 효과
                if (isPlayerCard) {
                    drawCard(gameState.player);
                    addGameLog(`${card.name}의 효과로 카드를 1장 뽑았습니다.`);
                }
                break;
                
            case 'damage_enemy':
                // 적 히어로에게 데미지
                const damage = card.effectValue || 1;
                
                if (isPlayerCard) {
                    gameState.opponent.health -= damage;
                    opponentHealth.textContent = gameState.opponent.health;
                    
                    addGameLog(`${card.name}의 효과로 상대방에게 ${damage} 데미지를 입혔습니다.`);
                    
                    // 게임 종료 체크
                    if (gameState.opponent.health <= 0) {
                        gameOver(peer.id);
                    }
                } else {
                    gameState.player.health -= damage;
                    playerHealth.textContent = gameState.player.health;
                    
                    addGameLog(`${card.name}의 효과로 ${damage} 데미지를 입었습니다.`);
                    
                    // 플레이어 사망 체크
                    checkPlayerDeath();
                }
                break;
                
            case 'heal_self':
                // 자신의 히어로 힐링
                const heal = card.effectValue || 1;
                
                if (isPlayerCard) {
                    gameState.player.health = Math.min(INITIAL_HEALTH, gameState.player.health + heal);
                    playerHealth.textContent = gameState.player.health;
                    
                    addGameLog(`${card.name}의 효과로 자신을 ${heal} 만큼 치유했습니다.`);
                } else {
                    gameState.opponent.health = Math.min(INITIAL_HEALTH, gameState.opponent.health + heal);
                    opponentHealth.textContent = gameState.opponent.health;
                    
                    addGameLog(`${card.name}의 효과로 상대방이 ${heal} 만큼 치유했습니다.`);
                }
                break;
                
            // 더 많은 효과 추가 가능
        }
    }
}

// 카드 엘리먼트 생성
function createCardElement(card, handIndex) {
    const cardElement = document.createElement('div');
    cardElement.className = 'card';
    cardElement.dataset.index = handIndex !== undefined ? handIndex : '';
    
    const cardFront = document.createElement('div');
    cardFront.className = 'card-face card-front';
    
    // 카드 헤더 (비용, 속성)
    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header';
    
    const cardCost = document.createElement('div');
    cardCost.className = 'card-cost';
    cardCost.textContent = card.cost;
    
    const cardElement = document.createElement('div');
    cardElement.className = `card-element element-${card.element}`;
    
    cardHeader.appendChild(cardCost);
    cardHeader.appendChild(cardElement);
    
    // 카드 이미지
    const cardImage = document.createElement('div');
    cardImage.className = 'card-image';
    cardImage.textContent = card.imageDescription || '엘레멘탈';
    
    // 카드 제목
    const cardTitle = document.createElement('div');
    cardTitle.className = 'card-title';
    cardTitle.textContent = card.name;
    
    // 카드 설명
    const cardDescription = document.createElement('div');
    cardDescription.className = 'card-description';
    cardDescription.textContent = card.description;
    
    // 카드 하단부 (공격력, 체력 - 미니언만)
    const cardFooter = document.createElement('div');
    cardFooter.className = 'card-footer';
    
    if (card.type === 'minion') {
        const cardAttack = document.createElement('div');
        cardAttack.className = 'card-attack';
        cardAttack.textContent = card.attack;
        
        const cardHealth = document.createElement('div');
        cardHealth.className = 'card-health';
        cardHealth.textContent = card.health;
        
        cardFooter.appendChild(cardAttack);
        cardFooter.appendChild(cardHealth);
    } else {
        // 스펠 카드인 경우 효과 아이콘
        const cardEffectIcon = document.createElement('div');
        cardEffectIcon.className = 'card-effect';
        cardEffectIcon.textContent = '✨';
        cardFooter.appendChild(cardEffectIcon);
    }
    
    // 카드 조립
    cardFront.appendChild(cardHeader);
    cardFront.appendChild(cardImage);
    cardFront.appendChild(cardTitle);
    cardFront.appendChild(cardDescription);
    cardFront.appendChild(cardFooter);
    
    cardElement.appendChild(cardFront);
    
    // 카드 상세보기 이벤트
    cardElement.addEventListener('dblclick', () => {
        showCardDetail(card);
    });
    
    return cardElement;
}

// 카드 뒷면 생성
function createCardBack() {
    const cardElement = document.createElement('div');
    cardElement.className = 'card';
    
    const cardBack = document.createElement('div');
    cardBack.className = 'card-face card-back';
    cardBack.textContent = '?';
    
    cardElement.appendChild(cardBack);
    
    return cardElement;
}

// 카드 상세보기
function showCardDetail(card) {
    modalCardTitle.textContent = card.name;
    modalCardDescription.textContent = card.description;
    
    // 카드 프리뷰 생성
    modalCardPreview.innerHTML = '';
    const cardPreview = createCardElement(card);
    cardPreview.style.transform = 'scale(1.5)';
    modalCardPreview.appendChild(cardPreview);
    
    // 모달 표시
    cardModal.style.display = 'flex';
}

// 게임 로그 추가
function addGameLog(message) {
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    const timestamp = new Date().toLocaleTimeString();
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    gameLog.appendChild(logEntry);
    gameLog.scrollTop = gameLog.scrollHeight;
}

// 게임 로그 토글
function toggleGameLog() {
    if (gameLog.style.display === 'none') {
        gameLog.style.display = 'block';
    } else {
        gameLog.style.display = 'none';
    }
}

// 로딩 오버레이 표시
function showLoadingOverlay(message) {
    loadingText.textContent = message || '로딩 중...';
    loadingOverlay.style.display = 'flex';
}

// 로딩 오버레이 숨김
function hideLoadingOverlay() {
    loadingOverlay.style.display = 'none';
}

// 백업 카드 데이터 (JSON을 불러오지 못할 경우)
const backupCardData = [
    // 화염 카드
    {
        "id": "fire1",
        "name": "화염의 정령",
        "type": "minion",
        "element": "fire",
        "cost": 2,
        "attack": 3,
        "health": 2,
        "description": "불타는 화염의 정령입니다. 전장에서 적들을 태웁니다.",
        "imageDescription": "🔥",
        "rarity": "common"
    },
    {
        "id": "fire2",
        "name": "화염구",
        "type": "spell",
        "element": "fire",
        "cost": 1,
        "description": "3의 피해를 대상에게 줍니다.",
        "imageDescription": "🔥",
        "effect": "damage",
        "damage": 3,
        "targetRequired": true,
        "rarity": "common"
    },
    {
        "id": "fire3",
        "name": "용암 거인",
        "type": "minion",
        "element": "fire",
        "cost": 5,
        "attack": 6,
        "health": 5,
        "description": "등장 시 모든 적 미니언에게 1의 피해를 줍니다.",
        "imageDescription": "🌋",
        "onPlay": "damage_enemy",
        "effectValue": 1,
        "rarity": "rare"
    },
    
    // 물 카드
    {
        "id": "water1",
        "name": "물의 정령",
        "type": "minion",
        "element": "water",
        "cost": 2,
        "attack": 2,
        "health": 3,
        "description": "시원한 물의 정령입니다. 바다의 힘을 담고 있습니다.",
        "imageDescription": "💧",
        "rarity": "common"
    },
    {
        "id": "water2",
        "name": "치유의 물결",
        "type": "spell",
        "element": "water",
        "cost": 2,
        "description": "4의 생명력을 회복합니다.",
        "imageDescription": "💧",
        "effect": "heal",
        "heal": 4,
        "targetRequired": true,
        "canTargetFriendly": true,
        "rarity": "common"
    },
    {
        "id": "water3",
        "name": "심해의 지배자",
        "type": "minion",
        "element": "water",
        "cost": 6,
        "attack": 5,
        "health": 7,
        "description": "등장 시 2의 생명력을 회복합니다.",
        "imageDescription": "🌊",
        "onPlay": "heal_self",
        "effectValue": 2,
        "rarity": "rare"
    },
    
    // 땅 카드
    {
        "id": "earth1",
        "name": "바위 정령",
        "type": "minion",
        "element": "earth",
        "cost": 3,
        "attack": 2,
        "health": 5,
        "description": "단단한 바위 정령입니다. 방어에 특화되어 있습니다.",
        "imageDescription": "🪨",
        "rarity": "common"
    },
    {
        "id": "earth2",
        "name": "지진",
        "type": "spell",
        "element": "earth",
        "cost": 4,
        "description": "모든 미니언에게 2의 피해를 줍니다.",
        "imageDescription": "🪨",
        "effect": "aoe_damage",
        "damage": 2,
        "rarity": "rare"
    },
    {
        "id": "earth3",
        "name": "대지의 수호자",
        "type": "minion",
        "element": "earth",
        "cost": 7,
        "attack": 4,
        "health": 9,
        "description": "등장 시 카드를 한 장 뽑습니다.",
        "imageDescription": "🌄",
        "onPlay": "draw",
        "rarity": "epic"
    },
    
    // 바람 카드
    {
        "id": "air1",
        "name": "바람 정령",
        "type": "minion",
        "element": "air",
        "cost": 1,
        "attack": 1,
        "health": 2,
        "description": "자유로운 바람의 정령입니다. 빠른 속도로 공격합니다.",
        "imageDescription": "💨",
        "charge": true,
        "rarity": "common"
    },
    {
        "id": "air2",
        "name": "돌풍",
        "type": "spell",
        "element": "air",
        "cost": 3,
        "description": "카드를 2장 뽑습니다.",
        "imageDescription": "💨",
        "effect": "draw",
        "drawCount": 2,
        "rarity": "rare"
    },
    {
        "id": "air3",
        "name": "폭풍의 군주",
        "type": "minion",
        "element": "air",
        "cost": 5,
        "attack": 4,
        "health": 4,
        "description": "돌진. 이 카드는 공격 후에도 피해를 입지 않습니다.",
        "imageDescription": "🌪️",
        "charge": true,
        "rarity": "epic"
    },
    
    // 마법 카드
    {
        "id": "arcane1",
        "name": "마법 정령",
        "type": "minion",
        "element": "arcane",
        "cost": 2,
        "attack": 2,
        "health": 2,
        "description": "신비한 마법의 정령입니다. 강력한 마법 에너지를 담고 있습니다.",
        "imageDescription": "✨",
        "onPlay": "draw",
        "rarity": "common"
    },
    {
        "id": "arcane2",
        "name": "마나 폭발",
        "type": "spell",
        "element": "arcane",
        "cost": 5,
        "description": "대상에게 5의 피해를 줍니다. 카드를 한 장 뽑습니다.",
        "imageDescription": "✨",
        "effect": "damage",
        "damage": 5,
        "targetRequired": true,
        "onPlay": "draw",
        "rarity": "rare"
    },
    {
        "id": "arcane3",
        "name": "신비의 현자",
        "type": "minion",
        "element": "arcane",
        "cost": 7,
        "attack": 3,
        "health": 6,
        "description": "등장 시 카드를 2장 뽑습니다.",
        "imageDescription": "🧙",
        "onPlay": "draw",
        "drawCount": 2,
        "rarity": "epic"
    }
];
