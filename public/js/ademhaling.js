(() => {
    const canvas = document.getElementById('golf');
    const ctx = canvas.getContext('2d');
    const faseEl = document.getElementById('fase');
    const tijdEl = document.getElementById('tijd');
    const tempoEl = document.getElementById('tempo');
    const startBtn = document.getElementById('start');
    const velden = {
        in: document.getElementById('in'),
        uit: document.getElementById('uit'),
        duur: document.getElementById('duur'),
    };

    const AANLOOP = 3;        // seconden vlakke lijn voordat je begint
    const ZICHTBAAR = 24;     // seconden die je op het scherm ziet
    const BOL_X = 0.3;        // positie van het bolletje (deel van de breedte)
    const css = getComputedStyle(document.documentElement);
    const kleur = {
        in: css.getPropertyValue('--kleur-in').trim() || '#E39B2D',
        uit: css.getPropertyValue('--kleur-uit').trim() || '#C2502F',
        straks: css.getPropertyValue('--kleur-straks').trim() || '#EADFD4',
    };

    let bezig = false;
    let startTijd = 0;
    let wakeLock = null;

    // Instellingen onthouden in de browser
    const opgeslagen = JSON.parse(localStorage.getItem('ademhaling') || '{}');
    for (const k in velden) if (opgeslagen[k] !== undefined) velden[k].value = opgeslagen[k];

    function instellingen() {
        const getal = (el, min, max, std) => {
            const v = parseFloat(el.value);
            return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : std;
        };
        return {
            in: getal(velden.in, 1, 20, 4),
            uit: getal(velden.uit, 1, 20, 7),
            duur: getal(velden.duur, 0, 120, 5),
        };
    }

    function toonTempo() {
        const s = instellingen();
        const perMinuut = 60 / (s.in + s.uit);
        tempoEl.textContent = `One breath takes ${fmt(s.in + s.uit)} seconds: ${perMinuut.toFixed(1)} breaths per minute.`;
        localStorage.setItem('ademhaling', JSON.stringify(s));
    }
    const fmt = (n) => String(n);

    // Hoogte van de golf op tijdstip t (0 = onder, 1 = boven)
    function niveau(t, s) {
        if (t < 0) return 0;
        const p = t % (s.in + s.uit);
        if (p < s.in) return (1 - Math.cos(Math.PI * p / s.in)) / 2;
        return (1 + Math.cos(Math.PI * (p - s.in) / s.uit)) / 2;
    }

    // Welke fase op tijdstip t: 'in' of 'uit' (de aanloop telt als 'uit', de rustlijn)
    function fase(t, s) {
        if (t < 0) return 'uit';
        return t % (s.in + s.uit) < s.in ? 'in' : 'uit';
    }

    function formaat() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function teken(t) {
        const s = instellingen();
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const marge = 18;
        const pxPerSec = w / ZICHTBAAR;
        const bolX = w * BOL_X;
        const y = (n) => h - marge - n * (h - 2 * marge);

        ctx.clearRect(0, 0, w, h);

        // Hulplijnen boven en onder
        ctx.strokeStyle = '#eeeeee';
        ctx.lineWidth = 1;
        [0, 1].forEach((n) => {
            ctx.beginPath();
            ctx.moveTo(0, y(n) + .5);
            ctx.lineTo(w, y(n) + .5);
            ctx.stroke();
        });

        // Golf: afgelegd deel in amber (in) en terracotta (uit), wat komt in zacht beige
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const punt = (x) => [x, y(niveau(t + (x - bolX) / pxPerSec, s))];
        const tijdOp = (x) => t + (x - bolX) / pxPerSec;

        let huidig = fase(tijdOp(0), s);
        ctx.beginPath();
        ctx.moveTo(...punt(0));
        for (let x = 2; x <= bolX; x += 2) {
            const f = fase(tijdOp(x), s);
            ctx.lineTo(...punt(x));
            if (f !== huidig) {
                ctx.strokeStyle = kleur[huidig];
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(...punt(x));
                huidig = f;
            }
        }
        ctx.lineTo(...punt(bolX));
        ctx.strokeStyle = kleur[huidig];
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(...punt(bolX));
        for (let x = bolX + 2; x <= w; x += 2) ctx.lineTo(...punt(x));
        ctx.strokeStyle = kleur.straks;
        ctx.stroke();

        // Bolletje
        ctx.beginPath();
        ctx.arc(bolX, y(niveau(t, s)), 11, 0, Math.PI * 2);
        ctx.fillStyle = kleur[fase(t, s)];
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
    }

    function werkStatusBij(t) {
        const s = instellingen();
        faseEl.dataset.fase = t < 0 ? '' : fase(t, s);
        if (t < 0) {
            faseEl.textContent = `Starting in ${Math.ceil(-t)}`;
            tijdEl.textContent = '0:00';
            return;
        }
        const p = t % (s.in + s.uit);
        faseEl.textContent = p < s.in
            ? `Breathe in · ${Math.floor(p) + 1}`
            : `Breathe out · ${Math.floor(p - s.in) + 1}`;

        const sec = Math.floor(t);
        const klok = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
        tijdEl.textContent = s.duur > 0 ? `${klok} / ${s.duur}:00` : klok;
    }

    function loop() {
        if (!bezig) return;
        const t = (performance.now() - startTijd) / 1000 - AANLOOP;
        const s = instellingen();

        // Stop netjes aan het eind van een uitademing zodra de duur voorbij is
        if (s.duur > 0 && t >= s.duur * 60) {
            const cyclus = s.in + s.uit;
            const einde = Math.ceil((s.duur * 60) / cyclus) * cyclus;
            if (t >= einde) {
                stop('Done. Nice work.');
                return;
            }
        }

        teken(t);
        werkStatusBij(t);
        requestAnimationFrame(loop);
    }

    async function start() {
        bezig = true;
        startTijd = performance.now();
        Object.values(velden).forEach((v) => (v.disabled = true));
        startBtn.innerHTML = '<i class="ph ph-stop"></i><span>Stop</span>';
        try { wakeLock = await navigator.wakeLock?.request('screen'); } catch (e) { /* niet ondersteund */ }
        requestAnimationFrame(loop);
    }

    function stop(melding = 'Ready to start') {
        bezig = false;
        Object.values(velden).forEach((v) => (v.disabled = false));
        startBtn.innerHTML = '<i class="ph ph-play"></i><span>Start</span>';
        faseEl.textContent = melding;
        faseEl.dataset.fase = '';
        wakeLock?.release().catch(() => {});
        wakeLock = null;
        teken(-AANLOOP);
    }

    startBtn.addEventListener('click', () => (bezig ? stop() : start()));
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
            e.preventDefault();
            bezig ? stop() : start();
        }
    });
    Object.values(velden).forEach((v) => v.addEventListener('input', () => { toonTempo(); teken(-AANLOOP); }));
    window.addEventListener('resize', () => { formaat(); if (!bezig) teken(-AANLOOP); });

    // Scherm-vergrendeling opnieuw aanvragen als je terugkomt op het tabblad
    document.addEventListener('visibilitychange', async () => {
        if (bezig && document.visibilityState === 'visible' && (!wakeLock || wakeLock.released)) {
            try { wakeLock = await navigator.wakeLock?.request('screen'); } catch (e) {}
        }
    });

    formaat();
    toonTempo();
    teken(-AANLOOP);
})();
