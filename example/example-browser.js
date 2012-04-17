(function () {

var modelFilename = 'ja-hiragana.model.json';

ZINNIA.model.loadFromJSONFile(modelFilename, function (err, model) {
    if (err) throw err;

    var recognizer = ZINNIA.recognizer.fromModel(model);

    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');

    var strokes = [ ];
    var curStroke = null;

    var lastX = null, lastY = null;

    function render(x, y) {
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.closePath();
    }

    function down(x, y) {
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';

        curStroke = [ ];

        lastX = x;
        lastY = y;
        render(x, y);
    }

    function move(x, y) {
        curStroke.push(x, y);

        render(x, y);
        lastX = x;
        lastY = y;
    }

    function up(x, y) {
        strokes.push(curStroke);
        curStroke = null;

        var c = recognizer.classify({
            width: canvas.width,
            height: canvas.height,
            strokes: strokes
        }, 10);

        console.log("Classified:");
        c.forEach(function (o) {
            console.log("  " + o.code + "  (" + o.bias + ")");
        });

        render(x, y);
    }

    function downE(pseudoEvent) {
        down(
            pseudoEvent.clientX - canvas.offsetLeft,
            pseudoEvent.clientY - canvas.offsetTop
        );
    }

    function moveE(pseudoEvent) {
        move(
            pseudoEvent.clientX - canvas.offsetLeft,
            pseudoEvent.clientY - canvas.offsetTop
        );
    }

    function upE(pseudoEvent) {
        up(
            pseudoEvent.clientX - canvas.offsetLeft,
            pseudoEvent.clientY - canvas.offsetTop
        );
    }

    canvas.addEventListener('mousedown', function on_mousedown(event) {
        downE(event);
        event.preventDefault();
    }, false);

    canvas.addEventListener('mousemove', function on_mousemove(event) {
        if (curStroke) {
            moveE(event);
            event.preventDefault();
        }
    }, false);

    canvas.addEventListener('mouseup', function on_mouseup(event) {
        upE(event);
        event.preventDefault();
    }, false);

    // ...

    canvas.addEventListener('touchstart', function on_touchdown(event) {
        var t = event.targetTouches[0];
        downE(t);
        event.preventDefault();
    }, false);

    canvas.addEventListener('touchmove', function on_touchmove(event) {
        var t = event.targetTouches[0];
        if (curStroke) {
            moveE(t);
            event.preventDefault();
        }
    }, false);

    canvas.addEventListener('touchend', function on_touchup(event) {
        var t = event.changedTouches[0];
        upE(t);
        event.preventDefault();
    }, false);

    document.getElementById('clear').addEventListener('click', function on_click() {
        strokes = [ ];
        lastX = null;
        lastY = null;
        canvas.width = canvas.width;
    }, false);
});

}());
