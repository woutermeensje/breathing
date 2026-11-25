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
    const STANDAARD_PATROON = 'lang-uit';
    const patronen = {
        'lang-uit': { in: 4, uit: 7 },
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

    function tekenVierkant(x, y, halveZijde, faseIndex, voortgang, faseKleur) {
        const links = x - halveZijde;
        const rechts = x + halveZijde;
        const boven = y - halveZijde;
        const onder = y + halveZijde;
        const hoeken = [[links, onder], [links, boven], [rechts, boven], [rechts, onder]];

        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = kleurStraks;
        ctx.strokeRect(links, boven, halveZijde * 2, halveZijde * 2);

        const [beginX, beginY] = hoeken[faseIndex];
        const [eindX, eindY] = hoeken[(faseIndex + 1) % hoeken.length];
        ctx.strokeStyle = faseKleur;
        ctx.lineWidth = 4;

        ctx.beginPath();
        ctx.moveTo(beginX, beginY);
        ctx.lineTo(eindX, eindY);
        ctx.globalAlpha = .25;
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.moveTo(beginX, beginY);
        ctx.lineTo(beginX + (eindX - beginX) * voortgang, beginY + (eindY - beginY) * voortgang);
        ctx.stroke();
    }

    function teken(patroon, fase, faseIndex = 0, voortgang = 0) {
        const breedte = canvas.clientWidth;
        const hoogte = canvas.clientHeight;
        const x = breedte / 2;
        const y = hoogte / 2;
        const halveZijde = Math.min(breedte, hoogte) * .40;
        const verloop = (1 - Math.cos(Math.PI * voortgang)) / 2;
        const niveau = fase.van + (fase.tot - fase.van) * verloop;
        const straal = halveZijde * (.28 + .44 * niveau);

        ctx.clearRect(0, 0, breedte, hoogte);
        if (patroon === 'box') {
            tekenVierkant(x, y, halveZijde, faseIndex, voortgang, fase.kleur);
        }

        ctx.beginPath();
        ctx.arc(x, y, straal, 0, Math.PI * 2);
        ctx.fillStyle = fase.kleur;
        ctx.fill();

        const licht = ctx.createRadialGradient(x - straal * .35, y - straal * .4, 0, x, y, straal);
        licht.addColorStop(0, 'rgba(255, 255, 255, .35)');
        licht.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = licht;
        ctx.fill();
    }

    function tekenRust() {
        teken(patroonEl.value, ademfases.in);
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

        const { patroon, fases, cyclus, duur, startTijd, einde } = sessie;
        const verstreken = (nu - startTijd) / 1000 - AANLOOP;

        if (verstreken >= einde) {
            toonTijd(einde, duur);
            stop('Done. Nice work.');
            return;
        }

        if (verstreken < 0) {
            tekenRust();
            toonFase('Starting in', ` ${Math.ceil(-verstreken)}`);
        } else {
            const cyclusTijd = verstreken % cyclus;
            const faseIndex = fases.findIndex((fase) => cyclusTijd < fase.eind);
            const fase = fases[faseIndex];
            const faseTijd = cyclusTijd - fase.begin;
            teken(patroon, fase, faseIndex, faseTijd / fase.seconden);
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
