(() => {
    const canvas = document.getElementById('adem-animatie');
    const ctx = canvas.getContext('2d');
    const patroonEl = document.getElementById('patroon');
    const patroonHulp = document.getElementById('patroon-hulp');
    const faseEl = document.getElementById('fase');
    const faseTellenEl = document.getElementById('fase-tellen');
    const tijdEl = document.getElementById('tijd');
    const tempoEl = document.getElementById('tempo');
    const startBtn = document.getElementById('start');
    const duurEl = document.getElementById('duur');
    const velden = {
        in: document.getElementById('in'),
        vastIn: document.getElementById('vast-in'),
        uit: document.getElementById('uit'),
        vastUit: document.getElementById('vast-uit'),
    };

    const AANLOOP = 3;
    const STANDAARD_PATROON = 'coherent';
    const patronen = {
        box: { in: 4, vastIn: 4, uit: 4, vastUit: 4 },
        coherent: { in: 5, uit: 5 },
        '4-7-8': { in: 4, vastIn: 7, uit: 8 },
    };
    const css = getComputedStyle(document.documentElement);
    const kleurIn = css.getPropertyValue('--kleur-in').trim();
    const kleurUit = css.getPropertyValue('--kleur-uit').trim();
    const kleurVast = css.getPropertyValue('--kleur-vast').trim();
    const kleurStraks = css.getPropertyValue('--kleur-straks').trim();
    const ademfases = {
        in: { tekst: 'Breathe in', kleur: kleurIn, van: 0, tot: 1 },
        vastIn: { tekst: 'Hold after inhale', kleur: kleurVast, van: 1, tot: 1 },
        uit: { tekst: 'Breathe out', kleur: kleurUit, van: 1, tot: 0 },
        vastUit: { tekst: 'Hold after exhale', kleur: kleurVast, van: 0, tot: 0 },
    };

    let sessie = null;
    let frame = 0;
    let wakeLock = null;

    function leesOpslag() {
        try {
            return JSON.parse(localStorage.getItem('ademhaling')) || {};
        } catch {
            return {};
        }
    }

    const opgeslagen = leesOpslag();
    // 'Extended exhale' bestaat niet meer: dat is nu gewoon coherent ademen met eigen tellen.
    if (opgeslagen.patroon === 'lang-uit') opgeslagen.patroon = STANDAARD_PATROON;
    const tijden = { ...opgeslagen.tijden };
    // Oudere versies bewaarden alleen de twee tijden voor het oorspronkelijke patroon.
    tijden[STANDAARD_PATROON] ??= { in: opgeslagen.in, uit: opgeslagen.uit };

    function leesGetal(veld, waarde, standaard) {
        const getal = Number.parseFloat(waarde);
        return Number.isFinite(getal) ? Math.min(Number(veld.max), Math.max(Number(veld.min), getal)) : standaard;
    }

    function toonPatroon() {
        const patroon = patroonEl.value;
        const standaardTijden = patronen[patroon];
        patroonHulp.hidden = patroon !== 'box';

        for (const [naam, veld] of Object.entries(velden)) {
            const zichtbaar = Object.hasOwn(standaardTijden, naam);
            veld.parentElement.hidden = !zichtbaar;
            veld.disabled = !zichtbaar || sessie !== null;
            if (zichtbaar) {
                veld.value = leesGetal(veld, tijden[patroon]?.[naam], standaardTijden[naam]);
            }
        }
    }

    function leesInstellingen() {
        const patroon = patroonEl.value;
        let cyclus = 0;
        const fases = Object.entries(patronen[patroon]).map(([naam, standaard]) => {
            const veld = velden[naam];
            const seconden = leesGetal(veld, veld.value, standaard);
            const begin = cyclus;
            cyclus += seconden;
            return { ...ademfases[naam], naam, seconden, begin, eind: cyclus };
        });
        return { patroon, fases, cyclus, duur: leesGetal(duurEl, duurEl.value, 5) };
    }

    function bewaarInstellingen({ patroon, fases, duur }) {
        tijden[patroon] = Object.fromEntries(fases.map(({ naam, seconden }) => [naam, seconden]));
        try {
            localStorage.setItem('ademhaling', JSON.stringify({ patroon, tijden, duur }));
        } catch {
            // De oefening werkt ook wanneer de browser opslag blokkeert.
        }
    }

    function verversInstellingen() {
        const instellingen = leesInstellingen();
        const seconden = new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(instellingen.cyclus);
        const perMinuut = (60 / instellingen.cyclus).toFixed(1);

        tempoEl.textContent = `One cycle takes ${seconden} seconds · ${perMinuut} breaths per minute.`;
        bewaarInstellingen(instellingen);
        tekenRust();
    }

    function formaat() {
        const dpr = window.devicePixelRatio || 1;
        const breedte = Math.round(canvas.clientWidth * dpr);
        const hoogte = Math.round(canvas.clientHeight * dpr);
        if (canvas.width === breedte && canvas.height === hoogte) return;

        canvas.width = breedte;
        canvas.height = hoogte;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const ZICHTBAAR = 24;   // seconden golf die je tegelijk ziet
    const BOL_X = .3;       // positie van het bolletje op de golf (deel van de breedte)
    const ease = (v) => (1 - Math.cos(Math.PI * v)) / 2;

    // Waar zit je op tijdstip t: welke fase, hoe ver in die fase en hoe hoog op de golf
    function faseOp(t, { fases, cyclus }) {
        if (t < 0) return { index: -1, fase: null, voortgang: 0, niveau: 0 };
        const cyclusTijd = t % cyclus;
        let index = fases.findIndex((fase) => cyclusTijd < fase.eind);
        if (index === -1) index = fases.length - 1;
        const fase = fases[index];
        const voortgang = Math.min(1, (cyclusTijd - fase.begin) / fase.seconden);
        return { index, fase, voortgang, niveau: fase.van + (fase.tot - fase.van) * ease(voortgang) };
    }

    function tekenGolf(instellingen, t) {
        const breedte = canvas.clientWidth;
        const hoogte = canvas.clientHeight;
        const marge = 18;
        const pxPerSec = breedte / Math.max(ZICHTBAAR, instellingen.cyclus * 1.6);
        const bolX = breedte * BOL_X;
        const y = (niveau) => hoogte - marge - niveau * (hoogte - 2 * marge);
        const tijdOp = (x) => t + (x - bolX) / pxPerSec;
        const punt = (x) => [x, y(faseOp(tijdOp(x), instellingen).niveau)];
        const kleurVan = (x) => faseOp(tijdOp(x), instellingen).fase?.kleur ?? kleurUit;

        ctx.lineWidth = 1;
        ctx.strokeStyle = '#eeeeee';
        for (const niveau of [0, 1]) {
            ctx.beginPath();
            ctx.moveTo(0, y(niveau) + .5);
            ctx.lineTo(breedte, y(niveau) + .5);
            ctx.stroke();
        }

        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Afgelegd deel: per fase in de eigen kleur
        let kleur = kleurVan(0);
        ctx.beginPath();
        ctx.moveTo(...punt(0));
        for (let x = 2; x <= bolX; x += 2) {
            ctx.lineTo(...punt(x));
            const volgende = kleurVan(x);
            if (volgende !== kleur) {
                ctx.strokeStyle = kleur;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(...punt(x));
                kleur = volgende;
            }
        }
        ctx.lineTo(...punt(bolX));
        ctx.strokeStyle = kleur;
        ctx.stroke();

        // Wat nog komt: zacht beige
        ctx.beginPath();
        ctx.moveTo(...punt(bolX));
        for (let x = bolX + 2; x <= breedte; x += 2) ctx.lineTo(...punt(x));
        ctx.strokeStyle = kleurStraks;
        ctx.stroke();

        const nu = faseOp(t, instellingen);
        tekenBolletje(bolX, y(nu.niveau), nu.fase?.kleur ?? kleurIn);
    }

    function tekenVierkant(instellingen, t) {
        const breedte = canvas.clientWidth;
        const hoogte = canvas.clientHeight;
        const halveZijde = Math.min(breedte, hoogte) / 2 - 30;
        const x = breedte / 2;
        const y = hoogte / 2;
        const links = x - halveZijde;
        const rechts = x + halveZijde;
        const boven = y - halveZijde;
        const onder = y + halveZijde;
        // Linksonder beginnen, met de klok mee: omhoog = in, rechts = vast, omlaag = uit, links = vast
        const hoeken = [[links, onder], [links, boven], [rechts, boven], [rechts, onder]];
        const nu = faseOp(t, instellingen);

        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = kleurStraks;
        ctx.strokeRect(links, boven, halveZijde * 2, halveZijde * 2);

        const zijde = (i, deel) => {
            const [bx, by] = hoeken[i];
            const [ex, ey] = hoeken[(i + 1) % 4];
            return [bx + (ex - bx) * deel, by + (ey - by) * deel];
        };

        // Zijdes die je deze ronde al gehad hebt, en het stuk van de huidige zijde
        for (let i = 0; i <= nu.index; i++) {
            ctx.beginPath();
            ctx.moveTo(...hoeken[i]);
            ctx.lineTo(...zijde(i, i < nu.index ? 1 : nu.voortgang));
            ctx.strokeStyle = instellingen.fases[i].kleur;
            ctx.stroke();
        }

        // Kleine labels langs de zijdes
        ctx.font = '300 13px "Work Sans", sans-serif';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Hold', x, boven - 21);
        ctx.fillText('Hold', x, onder + 22);
        ctx.save();
        ctx.translate(links - 21, y);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('In', 0, 0);
        ctx.restore();
        ctx.save();
        ctx.translate(rechts + 21, y);
        ctx.rotate(Math.PI / 2);
        ctx.fillText('Out', 0, 0);
        ctx.restore();

        const [px, py] = nu.index === -1 ? hoeken[0] : zijde(nu.index, nu.voortgang);
        tekenBolletje(px, py, nu.fase?.kleur ?? kleurIn);
    }

    function tekenBolletje(x, y, kleur) {
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fillStyle = kleur;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
    }

    function teken(instellingen, t) {
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        if (instellingen.patroon === 'box') {
            tekenVierkant(instellingen, t);
        } else {
            tekenGolf(instellingen, t);
        }
    }

    function tekenRust() {
        teken(leesInstellingen(), -AANLOOP);
    }

    function toonFase(tekst, tellen = '', naam = '') {
        if (faseEl.textContent !== tekst) faseEl.textContent = tekst;
        if (faseTellenEl.textContent !== tellen) faseTellenEl.textContent = tellen;
        faseEl.dataset.fase = naam;
    }

    function toonTijd(seconden, duur) {
        const klok = (tijd) => `${Math.floor(tijd / 60)}:${String(Math.floor(tijd % 60)).padStart(2, '0')}`;
        const verstreken = klok(seconden);
        const tekst = duur > 0 ? `${verstreken} / ${klok(duur * 60)}` : verstreken;
        if (tijdEl.textContent !== tekst) tijdEl.textContent = tekst;
    }

    function loop(nu) {
        if (!sessie) return;

        const { fases, cyclus, duur, startTijd, einde } = sessie;
        const verstreken = (nu - startTijd) / 1000 - AANLOOP;

        if (verstreken >= einde) {
            toonTijd(einde, duur);
            stop('Done. Nice work.');
            return;
        }

        teken(sessie, verstreken);
        if (verstreken < 0) {
            toonFase('Starting in', ` ${Math.ceil(-verstreken)}`);
        } else {
            const cyclusTijd = verstreken % cyclus;
            const fase = fases.find((f) => cyclusTijd < f.eind) ?? fases[fases.length - 1];
            const faseTijd = cyclusTijd - fase.begin;
            toonFase(fase.tekst, ` · ${Math.ceil(fase.seconden - faseTijd)}`, fase.naam);
            toonTijd(verstreken, duur);
        }

        frame = requestAnimationFrame(loop);
    }

    async function houdSchermAan(actieveSessie) {
        try {
            const lock = await navigator.wakeLock?.request('screen');
            if (!lock) return;

            if (sessie !== actieveSessie || (wakeLock && !wakeLock.released)) {
                await lock.release();
            } else {
                wakeLock = lock;
            }
        } catch {
            // De browser kan een schermvergrendeling weigeren.
        }
    }

    function zetBediening(vast) {
        patroonEl.disabled = vast;
        duurEl.disabled = vast;
        for (const veld of Object.values(velden)) {
            veld.disabled = vast || veld.parentElement.hidden;
        }

        const icoon = startBtn.querySelector('i');
        icoon.classList.toggle('ph-play', !vast);
        icoon.classList.toggle('ph-stop', vast);
        startBtn.querySelector('span').textContent = vast ? 'Stop' : 'Start';
    }

    function start() {
        const instellingen = leesInstellingen();
        const { duur, cyclus } = instellingen;
        // Maak de volledige ademcyclus af zodra de ingestelde duur is bereikt.
        const einde = duur > 0 ? Math.ceil(duur * 60 / cyclus) * cyclus : Infinity;

        bewaarInstellingen(instellingen);
        toonPatroon();
        duurEl.value = duur;
        sessie = { ...instellingen, startTijd: performance.now(), einde };
        zetBediening(true);
        toonTijd(0, duur);
        loop(sessie.startTijd);
        houdSchermAan(sessie);
    }

    function stop(melding = 'Ready to start') {
        sessie = null;
        cancelAnimationFrame(frame);
        zetBediening(false);
        toonFase(melding);
        wakeLock?.release().catch(() => {});
        wakeLock = null;
        tekenRust();
    }

    function wisselSessie() {
        if (sessie) {
            stop();
        } else {
            start();
        }
    }

    startBtn.addEventListener('click', wisselSessie);
    document.addEventListener('keydown', (event) => {
        if (event.code !== 'Space' || event.target.closest?.('input, select, button')) return;

        event.preventDefault();
        if (!event.repeat) wisselSessie();
    });
    patroonEl.addEventListener('change', () => {
        toonPatroon();
        toonFase('Ready to start');
        tijdEl.textContent = '0:00';
        verversInstellingen();
    });
    for (const veld of [...Object.values(velden), duurEl]) {
        veld.addEventListener('input', verversInstellingen);
    }
    window.addEventListener('resize', () => {
        formaat();
        if (!sessie) tekenRust();
    });
    document.addEventListener('visibilitychange', () => {
        if (sessie && document.visibilityState === 'visible' && (!wakeLock || wakeLock.released)) {
            houdSchermAan(sessie);
        }
    });

    patroonEl.value = Object.hasOwn(patronen, opgeslagen.patroon) ? opgeslagen.patroon : STANDAARD_PATROON;
    duurEl.value = leesGetal(duurEl, opgeslagen.duur, 5);
    toonPatroon();
    formaat();
    verversInstellingen();
})();
