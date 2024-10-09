document.addEventListener('DOMContentLoaded', () => {
    const VF = Vex.Flow;
    let renderer, context, stave, notes = [], currentNoteIndex = 0;
    let selectedScale = null;
    let targetPitches = [];
    let tempo = 60;
    let animationTimeoutId, metronomeIntervalId, waveSurfer, isPlaying = false;
    let highscore = localStorage.getItem('highscore') ? parseInt(localStorage.getItem('highscore')) : 0;

    // 要素の取得
    const menu = document.getElementById('menu');
    const optionsArea = document.getElementById('options-area');
    const gameArea = document.getElementById('game-area');
    const highscoreArea = document.getElementById('highscore-area');

    const startGameButton = document.getElementById('start-game');
    const optionsButton = document.getElementById('options-button');
    const backToMenuOptions = document.getElementById('back-to-menu-options');
    const viewHighscoreButton = document.getElementById('view-highscore');
    const backToMenuGame = document.getElementById('back-to-menu-game');
    const backToMenuHighscore = document.getElementById('back-to-menu-highscore');

    const selectScaleButton = document.getElementById('select-scale');
    const startPerformanceButton = document.getElementById('start-performance');

    const frequencyDisplay = document.getElementById('frequency');
    const scoreBoard = document.getElementById('score');
    const tempoSlider = document.getElementById('tempo');
    const tempoValue = document.getElementById('tempo-value');
    const usernameInput = document.getElementById('username');
    const highscoreList = document.getElementById('highscore-list');

    const metronomeSoundSelect = document.getElementById('metronome-sound');
    const metronomeVolumeSlider = document.getElementById('metronome-volume');
    const volumeValueDisplay = document.getElementById('volume-value');
    const fontSizeSelect = document.getElementById('font-size');
    const backgroundStyleSelect = document.getElementById('background-style');
    const testMetronomeButton = document.getElementById('test-metronome-sound');

    const scaleTilesContainer = document.querySelector('.scale-tiles');

    let score = 0;
    let audioContextObj;
    let analyser;
    let dataArray;
    let source;
    let isTuning = false;
    let userName = '';

    // メトロノーム音源の設定
    const metronomeSounds = {
        'metronome1.mp3': 'sounds/metronome1.mp3',
        'metronome2.mp3': 'sounds/metronome2.mp3',
        'metronome3.mp3': 'sounds/metronome3.mp3'
    };

    let currentMetronomeSound = new Audio(metronomeSounds['metronome1.mp3']);
    currentMetronomeSound.volume = parseFloat(metronomeVolumeSlider.value);

    // 初期アンロック用のフラグ
    let isAudioUnlocked = false;

    // イベントリスナーの設定
    startGameButton.addEventListener('click', () => {
        userName = usernameInput.value.trim();
        if (userName === '') {
            alert('ユーザーネームを入力してください。');
            return;
        }
        showSection(gameArea);
        initializeScaleTiles();
    });

    optionsButton.addEventListener('click', () => {
        showSection(optionsArea);
    });

    backToMenuOptions.addEventListener('click', () => {
        applyOptions();
        showSection(menu);
    });

    viewHighscoreButton.addEventListener('click', () => {
        updateHighscoreDisplay();
        showSection(highscoreArea);
    });

    backToMenuGame.addEventListener('click', () => {
        stopTuning();
        resetLayoutAfterPerformance();
        showSection(menu);
    });

    backToMenuHighscore.addEventListener('click', () => {
        showSection(menu);
    });

    selectScaleButton.addEventListener('click', () => {
        if (!selectedScale) {
            alert('音階を選択してください。');
            return;
        }
        showSection(gameArea);
        document.getElementById('tuning-area').classList.remove('hidden');
        setupVexFlow();
    });

    startPerformanceButton.addEventListener('click', () => {
        if (!selectedScale) {
            alert('音階を選択してください。');
            return;
        }
        if (!isAudioUnlocked) {
            alert('まず画面をタップしてマイクを有効にしてください。');
            return;
        }
        startTuning();
        changeLayoutForPerformance();
    });

    tempoSlider.addEventListener('input', () => {
        tempo = parseInt(tempoSlider.value);
        tempoValue.textContent = tempo;
        if (isTuning) {
            clearInterval(metronomeIntervalId);
            startMetronome();
        }
    });

    metronomeSoundSelect.addEventListener('change', () => {
        const selectedSound = metronomeSoundSelect.value;
        currentMetronomeSound = new Audio(metronomeSounds[selectedSound]);
        currentMetronomeSound.volume = parseFloat(metronomeVolumeSlider.value);
    });

    metronomeVolumeSlider.addEventListener('input', () => {
        const volume = parseFloat(metronomeVolumeSlider.value);
        volumeValueDisplay.textContent = volume.toFixed(2);
        currentMetronomeSound.volume = volume;
    });

    fontSizeSelect.addEventListener('change', () => {
        document.body.classList.remove('small', 'medium', 'large');
        document.body.classList.add(fontSizeSelect.value);
    });

    backgroundStyleSelect.addEventListener('change', () => {
        const selectedBackground = backgroundStyleSelect.value;
        document.body.style.backgroundImage = `url('images/background_${selectedBackground}.png')`;
    });

    // メトロノーム音のテストボタンのイベントリスナー
    testMetronomeButton.addEventListener('click', () => {
        const selectedSound = metronomeSoundSelect.value || 'metronome1.mp3';
        const testSound = new Audio(metronomeSounds[selectedSound]);
        testSound.volume = parseFloat(metronomeVolumeSlider.value);
        // 3拍間、テンポに合わせて鳴らす
        let beats = 3;
        let interval = 60000 / tempo;
        let beatCount = 0;
        const playBeat = () => {
            if (beatCount < beats) {
                testSound.currentTime = 0;
                testSound.play();
                beatCount++;
                setTimeout(playBeat, interval);
            }
        };
        playBeat();
    });

    // セクションの表示を切り替える関数
    function showSection(section) {
        document.querySelectorAll('.section').forEach(el => {
            if (el === section) {
                el.classList.add('visible');
                el.classList.remove('hidden');
            } else {
                el.classList.remove('visible');
                el.classList.add('hidden');
            }
        });
    }

    // 音階選択タイルの初期化
    function initializeScaleTiles() {
        scaleTilesContainer.innerHTML = ''; // 既存のタイルをクリア

        Object.keys(scalesData).forEach(scaleName => {
            const tile = document.createElement('div');
            tile.classList.add('scale-tile');
            tile.textContent = scaleName;

            tile.addEventListener('click', () => {
                document.querySelectorAll('.scale-tile').forEach(t => t.classList.remove('selected'));
                tile.classList.add('selected');
                selectedScale = scaleName;
                selectScaleButton.disabled = false;
            });

            scaleTilesContainer.appendChild(tile);
        });
    }

    // オプションを適用する関数
    function applyOptions() {
        // メトロノーム音量の表示更新
        volumeValueDisplay.textContent = metronomeVolumeSlider.value;
    }

    // ハイスコアの表示更新
    function updateHighscoreDisplay() {
        const highscores = JSON.parse(localStorage.getItem('highscores')) || [];
        if (highscores.length === 0) {
            highscoreList.textContent = 'ハイスコアはまだありません。';
            return;
        }
        highscoreList.innerHTML = highscores.map(entry =>
            `<p>${entry.username}: ${entry.score} 点</p>`).join('');
    }

    // VexFlowを使って楽譜をセットアップ
    function setupVexFlow(isPreview = false) {
        const vexflowContainer = document.getElementById('vexflow-container');
        vexflowContainer.innerHTML = ''; // 既存のレンダラーをクリア

        renderer = new VF.Renderer(vexflowContainer, VF.Renderer.Backends.SVG);
        renderer.resize(800, 200);
        context = renderer.getContext();

        stave = new VF.Stave(10, 40, 780);
        stave.addClef("treble").addTimeSignature("4/4");

        // 調号の追加
        const scaleData = scalesData[selectedScale];
        let keySignature = '';
        if (scaleData.type === 'メジャースケール') {
            keySignature = selectedScale.replace('メジャー','');
        } else if (scaleData.type === '短調') {
            keySignature = selectedScale.replace('マイナー','');
        }
        stave.addKeySignature(keySignature);
        stave.setContext(context).draw();

        // ノートの生成
        const scaleNotes = scaleData.notes.filter(note => isWithinViolinRange(note));
        notes = [];
        targetPitches = scaleNotes.map(note => getFrequency(note));

        // 2小節の音階（上昇と下降）
        const fullScale = scaleNotes.concat(scaleNotes.slice(0, -1).reverse());
        fullScale.forEach(noteName => {
            let duration = '8';
            // VexFlowのキー形式に変換（例: C4 → 'c/4', Bb3 → 'bb/3')
            let key = noteName[0].toLowerCase();
            if (noteName.includes('#')) {
                key += '#';
            } else if (noteName.includes('b')) {
                key += 'b';
            }
            key += '/' + noteName.slice(-1); // ノートのオクターブ番号

            let staveNote = new VF.StaveNote({
                clef: "treble",
                keys: [key],
                duration: duration
            });
            // シャープやフラットの処理
            if (noteName.includes('#')) {
                staveNote.addAccidental(0, new VF.Accidental('#'));
            } else if (noteName.includes('b')) {
                staveNote.addAccidental(0, new VF.Accidental('b'));
            }
            notes.push(staveNote);
        });

        // ビームを追加（八分音符の場合）
        let beams = VF.Beam.generateBeams(notes);
        VF.Formatter.FormatAndDraw(context, stave, notes);
        beams.forEach(function(beam) {
            beam.setContext(context).draw();
        });

        currentNoteIndex = 0;
        if (isPlaying && !isPreview) {
            highlightCurrentNote();
        }
    }

    // バイオリンの音域チェック（G3～G6）
    function isWithinViolinRange(note) {
        const noteFrequency = getFrequency(note);
        return noteFrequency >= 196.00 && noteFrequency <= 1567.98; // バイオリンの範囲（G3～G6）
    }

    // 周波数取得関数
    function getFrequency(note) {
        return noteFrequencies[note] || 0;
    }

    // 現在のノートをハイライト
    function highlightCurrentNote() {
        if (currentNoteIndex >= notes.length) {
            // 終了時に余裕を持たせて停止
            setTimeout(() => {
                stopTuning();
                resetLayoutAfterPerformance();
                alert('演奏が終了しました。お疲れ様でした！');
            }, 2000);
            return;
        }
        const svg = document.getElementById('vexflow-container').querySelector('svg');
        const allNotes = svg.querySelectorAll('.vf-note');
        allNotes.forEach((note, index) => {
            if (index === currentNoteIndex) {
                note.style.fill = '#D33F49'; // ハイライト色
            } else {
                note.style.fill = '#000000'; // 通常色
            }
        });
    }

    // ノートのアニメーションとハイライトの同期
    function animateNotes() {
        highlightCurrentNote();
        currentNoteIndex++;
        animationTimeoutId = setTimeout(() => {
            requestAnimationFrame(animateNotes);
        }, (60000 / tempo) * 0.5); // 八分音符の間隔
    }

    // メトロノームの開始
    function startMetronome() {
        if (metronomeIntervalId) clearInterval(metronomeIntervalId);
        const interval = (60000 / tempo) * 0.5; // 八分音符の間隔
        metronomeIntervalId = setInterval(() => {
            currentMetronomeSound.currentTime = 0;
            currentMetronomeSound.play();
        }, interval);
    }

    // 演奏時のレイアウト変更
    function changeLayoutForPerformance() {
        document.body.style.backgroundColor = '#fff';
        document.querySelector('.container').style.backgroundColor = 'rgba(255, 255, 255, 1)';
        isPlaying = true;
    }

    // 演奏終了後のレイアウトリセット
    function resetLayoutAfterPerformance() {
        document.body.style.backgroundColor = '';
        document.querySelector('.container').style.backgroundColor = 'rgba(255, 255, 255, 0.85)';
        isPlaying = false;
    }

    // チューニングの開始
    function startTuning() {
        if (isTuning) return; // 既にチューニング中なら無視
        isTuning = true;
        score = 0;
        scoreBoard.textContent = score;
        animateNotes();
        startMetronome();

        // Web Audio APIを使用してマイク入力を取得
        startAudioContext();
    }

    // オーディオコンテキストの開始
    function startAudioContext() {
        audioContextObj = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContextObj.createAnalyser();
        analyser.fftSize = 2048;
        dataArray = new Float32Array(analyser.fftSize);

        // マイクアクセスの許可を得る
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            source = audioContextObj.createMediaStreamSource(stream);
            source.connect(analyser);
            detectPitch();
            setupWaveform(stream);
            isAudioUnlocked = true; // アンロック完了
        }).catch(err => {
            console.error('マイクにアクセスできませんでした:', err);
            alert('マイクにアクセスできませんでした。設定を確認してください。');
            isTuning = false;
            stopAnimation();
            stopMetronome();
        });
    }

    // WaveSurfer.jsで音の波形を表示
    function setupWaveform(stream) {
        const waveformContainer = document.getElementById('waveform-container');
        waveformContainer.innerHTML = ''; // 既存の波形をクリア

        waveSurfer = WaveSurfer.create({
            container: '#waveform-container',
            waveColor: '#D33F49',
            progressColor: '#D33F49',
            cursorColor: '#D33F49',
            height: 150,
            responsive: true,
            interact: false,
            backend: 'WebAudio',
            plugins: [
                WaveSurfer.microphone.create()
            ]
        });

        waveSurfer.microphone.on('deviceReady', function(stream) {
            console.log('マイクが準備できました。');
        });

        waveSurfer.microphone.on('deviceError', function(code) {
            console.warn('マイクエラー:', code);
        });

        waveSurfer.microphone.start();
    }

    // ピッチ検出とスコア更新
    function detectPitch() {
        if (!isTuning) return;
        analyser.getFloatTimeDomainData(dataArray);
        const pitch = autoCorrelate(dataArray, audioContextObj.sampleRate);
        if (pitch !== -1) {
            frequencyDisplay.textContent = pitch.toFixed(2);
            const targetPitch = targetPitches[currentNoteIndex % targetPitches.length];
            updateScore(calculateScore(pitch, targetPitch));
        }
        requestAnimationFrame(detectPitch);
    }

    // チューニングの停止
    function stopTuning() {
        isTuning = false;
        stopAnimation();
        stopMetronome();
        if (audioContextObj) {
            audioContextObj.close();
        }
        if (waveSurfer) {
            waveSurfer.microphone.stop();
            waveSurfer.destroy();
        }
    }

    // ノートアニメーションの停止
    function stopAnimation() {
        clearTimeout(animationTimeoutId);
        // ノートの色をリセット
        const svg = document.getElementById('vexflow-container').querySelector('svg');
        if (svg) {
            const allNotes = svg.querySelectorAll('.vf-note');
            allNotes.forEach(note => {
                note.style.fill = '#000000';
            });
        }
    }

    // メトロノームの停止
    function stopMetronome() {
        if (metronomeIntervalId) clearInterval(metronomeIntervalId);
    }

    // スコアの更新
    function updateScore(newScore) {
        score = Math.round(newScore);
        scoreBoard.textContent = score;
        if (score > highscore) {
            highscore = score;
            localStorage.setItem('highscore', highscore);
            saveHighscore(userName, highscore);
        }
    }

    // スコア計算
    function calculateScore(pitch, targetPitch) {
        const diff = Math.abs(pitch - targetPitch);
        return Math.max(0, 100 - diff); // 差が小さいほど高いスコア
    }

    // スコアをローカルストレージに保存
    function saveHighscore(username, score) {
        let highscores = JSON.parse(localStorage.getItem('highscores')) || [];
        highscores.push({ username, score });
        // ハイスコアを降順にソート
        highscores.sort((a, b) => b.score - a.score);
        localStorage.setItem('highscores', JSON.stringify(highscores));
    }

    // 音程検出（Auto-Correlationアルゴリズム）
    function autoCorrelate(buffer, sampleRate) {
        let SIZE = buffer.length;
        let rms = 0;
        for (let i = 0; i < SIZE; i++) {
            rms += buffer[i] * buffer[i];
        }
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) return -1; // ノイズが小さい場合は検出を無視

        let r1 = 0, r2 = SIZE - 1, thres = 0.2;
        for (let i = 0; i < SIZE / 2; i++) {
            if (Math.abs(buffer[i]) < thres) {
                r1 = i;
                break;
            }
        }
        for (let i = 1; i < SIZE / 2; i++) {
            if (Math.abs(buffer[SIZE - i]) < thres) {
                r2 = SIZE - i;
                break;
            }
        }

        buffer = buffer.slice(r1, r2);
        SIZE = buffer.length;

        let c = new Array(SIZE).fill(0);
        for (let i = 0; i < SIZE; i++) {
            for (let j = 0; j < SIZE - i; j++) {
                c[i] += buffer[j] * buffer[j + i];
            }
        }

        let d = 0;
        while (c[d] > c[d + 1]) {
            d++;
        }
        let maxval = -1, maxpos = -1;
        for (let i = d; i < SIZE; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }

        let T0 = maxpos;
        return sampleRate / T0;
    }

    // 初期ハイスコア表示の更新
    updateHighscoreDisplay();

    // 高スコア表示ボタンのクリック
    backToMenuHighscore.addEventListener('click', () => {
        showSection(menu);
    });

    // ハイスコア画面からメニューに戻るボタンのクリック
    backToMenuGame.addEventListener('click', () => {
        stopTuning();
        resetLayoutAfterPerformance();
        showSection(menu);
    });

    // メニューに戻るボタンのクリック
    backToMenuOptions.addEventListener('click', () => {
        applyOptions();
        showSection(menu);
    });

    // 高スコア表示ボタンのクリック
    viewHighscoreButton.addEventListener('click', () => {
        updateHighscoreDisplay();
        showSection(highscoreArea);
    });
});
