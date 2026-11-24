<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Breathing wave: follow your rhythm</title>
    <meta name="description" content="Follow a calm wave: up is breathing in, down is breathing out. Set your own counts, for example 4 in and 7 out.">

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
            <h1>Breathing wave</h1>
            <p>Wave goes up: breathe in. Wave goes down: breathe out. Let the dot set your pace.</p>
        </header>

        <section class="blok golf-blok">
            <div class="status">
                <span id="fase">Ready to start</span>
                <span id="tijd">0:00</span>
            </div>
            <canvas id="golf" aria-label="Breathing wave"></canvas>
        </section>

        <section class="blok instellingen">
            <form id="instellingen" onsubmit="return false">
                <div class="grid-3">
                    <div>
                        <label for="in">Breathe in (seconds)</label>
                        <input type="number" id="in" min="1" max="20" step="0.5" value="4">
                    </div>
                    <div>
                        <label for="uit">Breathe out (seconds)</label>
                        <input type="number" id="uit" min="1" max="20" step="0.5" value="7">
                    </div>
                    <div>
                        <label for="duur">Duration (minutes)</label>
                        <input type="number" id="duur" min="0" max="120" step="1" value="5">
                        <p class="hulp">0 = no time limit</p>
                    </div>
                </div>
                <p class="hulp" id="tempo"></p>
                <div class="knoppen">
                    <button type="button" class="btn btn-primair" id="start"><i class="ph ph-play"></i><span>Start</span></button>
                </div>
            </form>
        </section>
    </main>

    <script src="{{ asset('js/ademhaling.js') }}"></script>
</body>
</html>
