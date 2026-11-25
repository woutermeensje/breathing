<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Breathing Pattern — breathe at your own pace</title>
    <link rel="icon" href="{{ asset('favicon.svg') }}" type="image/svg+xml">
    <link rel="icon" href="{{ asset('favicon.ico') }}" sizes="32x32">
    <link rel="apple-touch-icon" href="{{ asset('apple-touch-icon.png') }}">
    <meta name="theme-color" content="#FBFAF8">
    <meta name="description" content="Follow a calm breathing wave at your own pace. Choose a pattern and set the timing for each phase.">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">

    <link rel="stylesheet" href="{{ asset('css/forms.css') }}">
    <link rel="stylesheet" href="{{ asset('css/app.css') }}">
</head>
<body>
    <main class="wrap">
        <header class="kop">
            <h1 class="logo"><img src="{{ asset('favicon.svg') }}" alt="" width="34" height="34">Breathing <span>Pattern</span></h1>
            <p>Follow the dot. Up: breathe in. Down: breathe out. Flat: hold your breath.</p>
        </header>

        <section class="blok adem-blok" aria-label="Breathing guide">
            <div class="patroon-keuze">
                <label for="patroon">Breathing pattern</label>
                <select id="patroon" aria-describedby="patroon-hulp">
                    <option value="coherent">Coherent breathing</option>
                    <option value="box">Box breathing</option>
                    <option value="4-7-8">4–7–8 breathing</option>
                </select>
                <p class="hulp" id="patroon-hulp" hidden>Start at the bottom left and follow the square clockwise: up is in, across is hold, down is out.</p>
            </div>
            <div class="status">
                <span><span id="fase" aria-live="polite">Ready to start</span><span id="fase-tellen" aria-hidden="true"></span></span>
                <span id="tijd">0:00</span>
            </div>
            <canvas id="adem-animatie" aria-hidden="true"></canvas>
            <div class="knoppen">
                <button type="button" class="btn btn-primair" id="start"><i class="ph ph-play"></i><span>Start</span></button>
            </div>
        </section>

        <section class="blok instellingen">
            <form id="instellingen" onsubmit="return false">
                <div class="instellingen-grid">
                    <div>
                        <label for="in">Breathe in (s)</label>
                        <input type="number" id="in" min="1" max="20" step="0.5" value="4">
                    </div>
                    <div hidden>
                        <label for="vast-in">Hold after inhale (s)</label>
                        <input type="number" id="vast-in" min="1" max="20" step="0.5" value="4" disabled>
                    </div>
                    <div>
                        <label for="uit">Breathe out (s)</label>
                        <input type="number" id="uit" min="1" max="20" step="0.5" value="7">
                    </div>
                    <div hidden>
                        <label for="vast-uit">Hold after exhale (s)</label>
                        <input type="number" id="vast-uit" min="1" max="20" step="0.5" value="4" disabled>
                    </div>
                    <div>
                        <label for="duur">Duration (min)</label>
                        <input type="number" id="duur" min="0" max="120" step="1" value="5" aria-describedby="duur-hulp">
                        <p class="hulp" id="duur-hulp">0 = no time limit</p>
                    </div>
                </div>
                <p class="hulp" id="tempo"></p>
            </form>
        </section>
    </main>

    <script src="{{ asset('js/ademhaling.js') }}"></script>
</body>
</html>
